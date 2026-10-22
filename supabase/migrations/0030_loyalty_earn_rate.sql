-- Loyalty earn rate fix.
-- Before: 1 point per Rs. 1 spent, and 1 point was worth Rs. 1 off, so every order paid back 100%.
-- After:  1 point per Rs. 100 spent (10000 minor units), 1 point still worth Rs. 1 off (a 1% return).
-- Keep EARN_RATE_MINOR_UNITS_PER_POINT in backend/lib/loyalty/index.ts in step with this value.

create or replace function public.fn_promotions_on_order_status_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- Earn: order reaches 'delivered'.
  if NEW.order_status = 'delivered' and (OLD.order_status is distinct from NEW.order_status) and NEW.customer_id is not null then
    insert into loyalty_ledger_entries (customer_id, order_id, entry_type, points, description, idempotency_key)
    values (
      NEW.customer_id,
      NEW.id,
      'earn',
      floor(NEW.grand_total / 10000.0),
      'Points earned for order ' || NEW.order_number,
      'loyalty:earn:' || NEW.id
    )
    on conflict (idempotency_key) do nothing;
  end if;

  -- Reversal: order cancelled (only reachable pre-delivery, so only
  -- redeemed points and coupon usage can be outstanding — no earn to
  -- reverse) or refunded (reachable only post-delivery via the returns
  -- flow, so both earned and redeemed points may need reversing).
  if NEW.order_status in ('cancelled', 'refunded') and (OLD.order_status is distinct from NEW.order_status) then
    if NEW.order_status = 'refunded' then
      insert into loyalty_ledger_entries (customer_id, order_id, entry_type, points, description, idempotency_key)
      select l.customer_id, NEW.id, 'reversal', -l.points, 'Reversal of earned points for refunded order ' || NEW.order_number, 'loyalty:reversal:earn:' || NEW.id
      from loyalty_ledger_entries l
      where l.order_id = NEW.id and l.entry_type = 'earn'
      on conflict (idempotency_key) do nothing;
    end if;

    insert into loyalty_ledger_entries (customer_id, order_id, entry_type, points, description, idempotency_key)
    select l.customer_id, NEW.id, 'reversal', -l.points, 'Reversal of redeemed points for ' || NEW.order_status || ' order ' || NEW.order_number, 'loyalty:reversal:redeem:' || NEW.id
    from loyalty_ledger_entries l
    where l.order_id = NEW.id and l.entry_type = 'redeem'
    on conflict (idempotency_key) do nothing;

    -- Release any coupon usage claimed for this order (give the usage slot
    -- back). released_at guards against double-release on a repeated
    -- trigger fire, keeping the operation idempotent regardless.
    update coupons c
    set times_used = greatest(c.times_used - 1, 0)
    from coupon_redemptions r
    where r.order_id = NEW.id and r.coupon_id = c.id and r.released_at is null;

    update coupon_redemptions
    set released_at = timezone('utc', now())
    where order_id = NEW.id and released_at is null;
  end if;

  return NEW;
end;
$function$;

-- Correct points already granted at the old rate (this only touches earn entries; 100x too high).
update loyalty_ledger_entries
set points = floor(points / 100.0)
where entry_type = 'earn';

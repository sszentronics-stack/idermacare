-- Stock now moves with orders.
--   * Placing an order (order_items insert) reserves stock and fails when there is not enough.
--   * Cancelling (or an order that never ships) releases the reservation.
--   * Shipping converts the reservation into a real reduction of stock on hand.
-- Variants without an inventory_cache row are treated as untracked and are never blocked.

create or replace function public.fn_reserve_stock_on_order_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.inventory_cache%rowtype;
begin
  if NEW.variant_id is null then
    return NEW;
  end if;

  select * into inv from public.inventory_cache where variant_id = NEW.variant_id for update;
  if not found then
    return NEW;
  end if;

  if inv.quantity_available < NEW.quantity then
    raise exception 'Not enough stock for % (only % left).', NEW.product_name, greatest(inv.quantity_available, 0)
      using errcode = 'P0001';
  end if;

  update public.inventory_cache
  set quantity_available = quantity_available - NEW.quantity,
      quantity_reserved = quantity_reserved + NEW.quantity
  where id = inv.id;

  return NEW;
end;
$$;

drop trigger if exists trg_reserve_stock_on_order_item on public.order_items;
create trigger trg_reserve_stock_on_order_item
  before insert on public.order_items
  for each row execute function public.fn_reserve_stock_on_order_item();

create or replace function public.fn_stock_on_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if OLD.order_status is not distinct from NEW.order_status then
    return NEW;
  end if;

  -- Shipped: the reserved units leave the shelf.
  if NEW.order_status = 'shipped' and OLD.order_status in ('pending','confirmed','processing','packed','ready_for_pickup') then
    update public.inventory_cache i
    set quantity_reserved = greatest(i.quantity_reserved - oi.quantity, 0),
        quantity_on_hand = greatest(i.quantity_on_hand - oi.quantity, 0)
    from public.order_items oi
    where oi.order_id = NEW.id and oi.variant_id = i.variant_id;
  end if;

  -- Cancelled before shipping: put the reservation back.
  if NEW.order_status = 'cancelled' and OLD.order_status in ('pending','confirmed','processing','packed','ready_for_pickup') then
    update public.inventory_cache i
    set quantity_reserved = greatest(i.quantity_reserved - oi.quantity, 0),
        quantity_available = i.quantity_available + oi.quantity
    from public.order_items oi
    where oi.order_id = NEW.id and oi.variant_id = i.variant_id;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_stock_on_order_status_change on public.orders;
create trigger trg_stock_on_order_status_change
  after update of order_status on public.orders
  for each row execute function public.fn_stock_on_order_status_change();

-- Bring existing open orders in line (orders placed before this migration never reserved stock).
update public.inventory_cache i
set quantity_available = greatest(i.quantity_available - s.qty, 0),
    quantity_reserved = i.quantity_reserved + s.qty
from (
  select oi.variant_id, sum(oi.quantity)::int as qty
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where o.order_status in ('pending','confirmed','processing','packed','ready_for_pickup')
  group by oi.variant_id
) s
where s.variant_id = i.variant_id;

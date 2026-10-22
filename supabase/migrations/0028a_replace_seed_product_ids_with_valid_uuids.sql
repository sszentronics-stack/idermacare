-- Applied directly to the live project on 2026-10-21 (migration "replace_seed_product_ids_with_valid_uuids").
-- Kept here so the repository matches the database.
do $$
declare
  fk record;
  fks text[][] := '{}';
begin
  create temp table _fk_defs on commit drop as
    select c.conrelid::regclass::text as tbl, c.conname, pg_get_constraintdef(c.oid) as def
    from pg_constraint c
    where c.contype = 'f'
      and c.confrelid in ('public.products'::regclass, 'public.product_variants'::regclass);

  for fk in select * from _fk_defs loop
    execute format('alter table %s drop constraint %I', fk.tbl, fk.conname);
  end loop;

  create temp table _id_map on commit drop as
    select 'p'::text as kind, id as old_id, gen_random_uuid() as new_id from public.products where id::text like '00000000-0000-0000-0000-%'
    union all
    select 'v', id, gen_random_uuid() from public.product_variants where id::text like '00000000-0000-0000-0000-%';

  update public.products p set id = m.new_id from _id_map m where m.kind = 'p' and p.id = m.old_id;
  update public.product_variants v set id = m.new_id from _id_map m where m.kind = 'v' and v.id = m.old_id;

  update public.product_variants t set product_id = m.new_id from _id_map m where m.kind = 'p' and t.product_id = m.old_id;
  update public.product_images t set product_id = m.new_id from _id_map m where m.kind = 'p' and t.product_id = m.old_id;
  update public.product_images t set variant_id = m.new_id from _id_map m where m.kind = 'v' and t.variant_id = m.old_id;
  update public.product_categories t set product_id = m.new_id from _id_map m where m.kind = 'p' and t.product_id = m.old_id;
  update public.product_collections t set product_id = m.new_id from _id_map m where m.kind = 'p' and t.product_id = m.old_id;
  update public.order_items t set product_id = m.new_id from _id_map m where m.kind = 'p' and t.product_id = m.old_id;
  update public.order_items t set variant_id = m.new_id from _id_map m where m.kind = 'v' and t.variant_id = m.old_id;
  update public.inventory_cache t set variant_id = m.new_id from _id_map m where m.kind = 'v' and t.variant_id = m.old_id;
  update public.cart_items t set variant_id = m.new_id from _id_map m where m.kind = 'v' and t.variant_id = m.old_id;
  update public.wishlist_items t set product_id = m.new_id from _id_map m where m.kind = 'p' and t.product_id = m.old_id;
  update public.recently_viewed t set product_id = m.new_id from _id_map m where m.kind = 'p' and t.product_id = m.old_id;
  update public.product_reviews t set product_id = m.new_id from _id_map m where m.kind = 'p' and t.product_id = m.old_id;

  for fk in select * from _fk_defs loop
    execute format('alter table %s add constraint %I %s', fk.tbl, fk.conname, fk.def);
  end loop;
end $$;

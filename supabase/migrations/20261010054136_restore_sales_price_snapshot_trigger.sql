-- Restore the existing pricing function's missing trigger. Sales prices are snapshots.
create trigger trg_set_sales_harga_jual_dasar before insert or update of id_kavling on public.sales for each row execute function public.set_sales_harga_jual_dasar();

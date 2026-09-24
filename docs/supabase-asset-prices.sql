-- Tabela dziennych cen (uruchom w SQL Editorze Supabase).
create table if not exists public.asset_prices (
  ticker text not null,
  date date not null,
  close_price numeric not null,
  currency text not null default 'USD',
  primary key (ticker, date)
);

create index if not exists asset_prices_ticker_date_idx
  on public.asset_prices (ticker, date);

alter table public.asset_prices enable row level security;

grant select on public.asset_prices to anon, authenticated;
grant all on public.asset_prices to service_role;

-- Odczyt cen dla frontendu / anon; zapis przez service role (omija RLS).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'asset_prices'
      and policyname = 'Public read asset_prices'
  ) then
    create policy "Public read asset_prices"
      on public.asset_prices
      for select
      using (true);
  end if;
end $$;

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

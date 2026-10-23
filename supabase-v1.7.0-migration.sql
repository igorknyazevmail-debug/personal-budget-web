-- «Мои деньги» v1.7.0
-- Добавляет пользовательский финансовый ориентир «Необходимый минимум».
-- Существующие счета, доходы, расходы, переводы и лимиты не изменяются.

create table if not exists public.budget_financial_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  necessary_minimum numeric(12,2) not null default 0 check (necessary_minimum >= 0),
  updated_at timestamptz not null default now()
);

alter table public.budget_financial_settings enable row level security;

drop policy if exists "Users can read own financial settings" on public.budget_financial_settings;
create policy "Users can read own financial settings"
on public.budget_financial_settings for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own financial settings" on public.budget_financial_settings;
create policy "Users can insert own financial settings"
on public.budget_financial_settings for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own financial settings" on public.budget_financial_settings;
create policy "Users can update own financial settings"
on public.budget_financial_settings for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant select, insert, update on public.budget_financial_settings to authenticated;
grant all on public.budget_financial_settings to service_role;

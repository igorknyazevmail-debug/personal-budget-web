-- Мой бюджет v1.5.0
-- Добавляет учёт доходов и отдельные категории доходов.
-- Существующие расходы, категории и месячные лимиты не изменяются.

create table if not exists public.budget_incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  received_at date not null default current_date,
  amount numeric(12,2) not null check (amount > 0),
  category text not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists budget_incomes_user_received_at_idx
  on public.budget_incomes (user_id, received_at desc);

alter table public.budget_incomes enable row level security;

drop policy if exists "Users can read own incomes" on public.budget_incomes;
create policy "Users can read own incomes"
on public.budget_incomes for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own incomes" on public.budget_incomes;
create policy "Users can insert own incomes"
on public.budget_incomes for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own incomes" on public.budget_incomes;
create policy "Users can update own incomes"
on public.budget_incomes for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own incomes" on public.budget_incomes;
create policy "Users can delete own incomes"
on public.budget_incomes for delete
to authenticated
using (auth.uid() = user_id);

grant select, insert, update, delete on public.budget_incomes to authenticated;
grant all on public.budget_incomes to service_role;

create table if not exists public.budget_income_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists budget_income_categories_user_name_unique_idx
  on public.budget_income_categories (user_id, lower(name));

create index if not exists budget_income_categories_user_sort_idx
  on public.budget_income_categories (user_id, sort_order, name);

alter table public.budget_income_categories enable row level security;

drop policy if exists "Users can read own income categories" on public.budget_income_categories;
create policy "Users can read own income categories"
on public.budget_income_categories for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own income categories" on public.budget_income_categories;
create policy "Users can insert own income categories"
on public.budget_income_categories for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own income categories" on public.budget_income_categories;
create policy "Users can update own income categories"
on public.budget_income_categories for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own income categories" on public.budget_income_categories;
create policy "Users can delete own income categories"
on public.budget_income_categories for delete
to authenticated
using (auth.uid() = user_id);

grant select, insert, update, delete on public.budget_income_categories to authenticated;
grant all on public.budget_income_categories to service_role;

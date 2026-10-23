-- Мой бюджет v1.1.0
-- Этот файл безопасно запускать поверх v1.0.2: существующие расходы не удаляются.

create table if not exists public.budget_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  spent_at date not null default current_date,
  amount numeric(12,2) not null check (amount > 0),
  category text not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists budget_expenses_user_spent_at_idx
  on public.budget_expenses (user_id, spent_at desc);

alter table public.budget_expenses enable row level security;

drop policy if exists "Users can read own expenses" on public.budget_expenses;
create policy "Users can read own expenses"
on public.budget_expenses for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own expenses" on public.budget_expenses;
create policy "Users can insert own expenses"
on public.budget_expenses for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own expenses" on public.budget_expenses;
create policy "Users can update own expenses"
on public.budget_expenses for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own expenses" on public.budget_expenses;
create policy "Users can delete own expenses"
on public.budget_expenses for delete
to authenticated
using (auth.uid() = user_id);

grant select, insert, update, delete on public.budget_expenses to authenticated;
grant all on public.budget_expenses to service_role;

-- Новая таблица категорий в v1.1.0
create table if not exists public.budget_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists budget_categories_user_name_unique_idx
  on public.budget_categories (user_id, lower(name));

create index if not exists budget_categories_user_sort_idx
  on public.budget_categories (user_id, sort_order, name);

alter table public.budget_categories enable row level security;

drop policy if exists "Users can read own budget categories" on public.budget_categories;
create policy "Users can read own budget categories"
on public.budget_categories for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own budget categories" on public.budget_categories;
create policy "Users can insert own budget categories"
on public.budget_categories for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own budget categories" on public.budget_categories;
create policy "Users can update own budget categories"
on public.budget_categories for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own budget categories" on public.budget_categories;
create policy "Users can delete own budget categories"
on public.budget_categories for delete
to authenticated
using (auth.uid() = user_id);

grant select, insert, update, delete on public.budget_categories to authenticated;
grant all on public.budget_categories to service_role;
-- Мой бюджет v1.4.0
-- Добавляет месячные лимиты. Существующие расходы и категории не изменяются.

create table if not exists public.budget_monthly_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month date not null,
  total_limit numeric(12,2) check (total_limit is null or total_limit > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budget_monthly_settings_month_first_day_check
    check (extract(day from month) = 1),
  constraint budget_monthly_settings_user_month_unique
    unique (user_id, month)
);

create index if not exists budget_monthly_settings_user_month_idx
  on public.budget_monthly_settings (user_id, month desc);

alter table public.budget_monthly_settings enable row level security;

drop policy if exists "Users can read own monthly budgets" on public.budget_monthly_settings;
create policy "Users can read own monthly budgets"
on public.budget_monthly_settings for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own monthly budgets" on public.budget_monthly_settings;
create policy "Users can insert own monthly budgets"
on public.budget_monthly_settings for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own monthly budgets" on public.budget_monthly_settings;
create policy "Users can update own monthly budgets"
on public.budget_monthly_settings for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own monthly budgets" on public.budget_monthly_settings;
create policy "Users can delete own monthly budgets"
on public.budget_monthly_settings for delete
to authenticated
using (auth.uid() = user_id);

grant select, insert, update, delete on public.budget_monthly_settings to authenticated;
grant all on public.budget_monthly_settings to service_role;

create table if not exists public.budget_category_limits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month date not null,
  category text not null check (length(trim(category)) > 0),
  limit_amount numeric(12,2) not null check (limit_amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budget_category_limits_month_first_day_check
    check (extract(day from month) = 1),
  constraint budget_category_limits_user_month_category_unique
    unique (user_id, month, category)
);

create index if not exists budget_category_limits_user_month_idx
  on public.budget_category_limits (user_id, month desc, category);

alter table public.budget_category_limits enable row level security;

drop policy if exists "Users can read own category limits" on public.budget_category_limits;
create policy "Users can read own category limits"
on public.budget_category_limits for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own category limits" on public.budget_category_limits;
create policy "Users can insert own category limits"
on public.budget_category_limits for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own category limits" on public.budget_category_limits;
create policy "Users can update own category limits"
on public.budget_category_limits for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own category limits" on public.budget_category_limits;
create policy "Users can delete own category limits"
on public.budget_category_limits for delete
to authenticated
using (auth.uid() = user_id);

grant select, insert, update, delete on public.budget_category_limits to authenticated;
grant all on public.budget_category_limits to service_role;
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

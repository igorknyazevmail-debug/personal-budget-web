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

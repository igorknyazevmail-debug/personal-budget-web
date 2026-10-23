-- Обновление с Мой бюджет v1.0.2 до v1.1.0
-- Создаёт только таблицу пользовательских категорий. Расходы не меняются.

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

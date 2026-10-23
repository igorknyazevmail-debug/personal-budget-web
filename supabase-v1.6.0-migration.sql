-- «Мои деньги» v1.6.0
-- Добавляет счета/кошельки и переводы между ними.
-- Существующие доходы и расходы автоматически привязываются к счёту «Наличные».

create table if not exists public.budget_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  opening_balance numeric(12,2) not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists budget_accounts_user_name_unique_idx
  on public.budget_accounts (user_id, lower(name));

create index if not exists budget_accounts_user_sort_idx
  on public.budget_accounts (user_id, sort_order, name);

alter table public.budget_accounts enable row level security;

drop policy if exists "Users can read own accounts" on public.budget_accounts;
create policy "Users can read own accounts"
on public.budget_accounts for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own accounts" on public.budget_accounts;
create policy "Users can insert own accounts"
on public.budget_accounts for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own accounts" on public.budget_accounts;
create policy "Users can update own accounts"
on public.budget_accounts for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own accounts" on public.budget_accounts;
create policy "Users can delete own accounts"
on public.budget_accounts for delete
to authenticated
using (auth.uid() = user_id);

grant select, insert, update, delete on public.budget_accounts to authenticated;
grant all on public.budget_accounts to service_role;

-- Создать стартовые счета для всех пользователей, у которых уже есть данные бюджета.
with existing_users as (
  select user_id from public.budget_expenses
  union
  select user_id from public.budget_incomes
  union
  select user_id from public.budget_categories
  union
  select user_id from public.budget_income_categories
  union
  select user_id from public.budget_monthly_settings
  union
  select user_id from public.budget_category_limits
), defaults(name, sort_order) as (
  values ('Наличные', 0), ('Банк 1', 1), ('Банк 2', 2)
)
insert into public.budget_accounts (user_id, name, opening_balance, sort_order)
select u.user_id, d.name, 0, d.sort_order
from existing_users u
cross join defaults d
on conflict do nothing;

alter table public.budget_expenses
  add column if not exists account_id uuid;

alter table public.budget_incomes
  add column if not exists account_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'budget_expenses_account_id_fkey') then
    alter table public.budget_expenses
      add constraint budget_expenses_account_id_fkey
      foreign key (account_id) references public.budget_accounts(id) on delete restrict;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'budget_incomes_account_id_fkey') then
    alter table public.budget_incomes
      add constraint budget_incomes_account_id_fkey
      foreign key (account_id) references public.budget_accounts(id) on delete restrict;
  end if;
end $$;

-- Старые записи считаем операциями по наличным.
update public.budget_expenses e
set account_id = a.id
from public.budget_accounts a
where e.account_id is null
  and a.user_id = e.user_id
  and lower(a.name) = lower('Наличные');

update public.budget_incomes i
set account_id = a.id
from public.budget_accounts a
where i.account_id is null
  and a.user_id = i.user_id
  and lower(a.name) = lower('Наличные');

alter table public.budget_expenses alter column account_id set not null;
alter table public.budget_incomes alter column account_id set not null;

create index if not exists budget_expenses_user_account_spent_idx
  on public.budget_expenses (user_id, account_id, spent_at desc);

create index if not exists budget_incomes_user_account_received_idx
  on public.budget_incomes (user_id, account_id, received_at desc);

-- Ужесточить запись доходов/расходов: выбранный счёт тоже должен принадлежать текущему пользователю.
drop policy if exists "Users can insert own expenses" on public.budget_expenses;
create policy "Users can insert own expenses"
on public.budget_expenses for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.budget_accounts a
    where a.id = account_id and a.user_id = auth.uid()
  )
);

drop policy if exists "Users can update own expenses" on public.budget_expenses;
create policy "Users can update own expenses"
on public.budget_expenses for update
to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.budget_accounts a
    where a.id = account_id and a.user_id = auth.uid()
  )
);

drop policy if exists "Users can insert own incomes" on public.budget_incomes;
create policy "Users can insert own incomes"
on public.budget_incomes for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.budget_accounts a
    where a.id = account_id and a.user_id = auth.uid()
  )
);

drop policy if exists "Users can update own incomes" on public.budget_incomes;
create policy "Users can update own incomes"
on public.budget_incomes for update
to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.budget_accounts a
    where a.id = account_id and a.user_id = auth.uid()
  )
);

create table if not exists public.budget_transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  transferred_at date not null default current_date,
  amount numeric(12,2) not null check (amount > 0),
  from_account_id uuid not null references public.budget_accounts(id) on delete restrict,
  to_account_id uuid not null references public.budget_accounts(id) on delete restrict,
  note text,
  created_at timestamptz not null default now(),
  check (from_account_id <> to_account_id)
);

create index if not exists budget_transfers_user_date_idx
  on public.budget_transfers (user_id, transferred_at desc);
create index if not exists budget_transfers_from_idx
  on public.budget_transfers (user_id, from_account_id);
create index if not exists budget_transfers_to_idx
  on public.budget_transfers (user_id, to_account_id);

alter table public.budget_transfers enable row level security;

drop policy if exists "Users can read own transfers" on public.budget_transfers;
create policy "Users can read own transfers"
on public.budget_transfers for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own transfers" on public.budget_transfers;
create policy "Users can insert own transfers"
on public.budget_transfers for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.budget_accounts a
    where a.id = from_account_id and a.user_id = auth.uid()
  )
  and exists (
    select 1 from public.budget_accounts a
    where a.id = to_account_id and a.user_id = auth.uid()
  )
);

drop policy if exists "Users can update own transfers" on public.budget_transfers;
create policy "Users can update own transfers"
on public.budget_transfers for update
to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.budget_accounts a
    where a.id = from_account_id and a.user_id = auth.uid()
  )
  and exists (
    select 1 from public.budget_accounts a
    where a.id = to_account_id and a.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete own transfers" on public.budget_transfers;
create policy "Users can delete own transfers"
on public.budget_transfers for delete
to authenticated
using (auth.uid() = user_id);

grant select, insert, update, delete on public.budget_transfers to authenticated;
grant all on public.budget_transfers to service_role;

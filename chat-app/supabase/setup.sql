create extension if not exists "pgcrypto";

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(trim(content)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists messages_created_at_idx
  on public.messages (created_at asc);

create index if not exists messages_user_id_idx
  on public.messages (user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists messages_set_updated_at on public.messages;
create trigger messages_set_updated_at
before update on public.messages
for each row
execute function public.set_updated_at();

alter table public.messages enable row level security;

create policy "Allow authenticated users to read messages"
on public.messages
for select
to authenticated
using (true);

create policy "Allow authenticated users to insert messages"
on public.messages
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Allow owners to update messages"
on public.messages
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Allow owners to delete messages"
on public.messages
for delete
to authenticated
using (auth.uid() = user_id);

alter publication supabase_realtime add table public.messages;

-- MYSLF — table de suivi du quota mensuel de messages avec MYSLF (chat)
-- À coller dans Supabase : SQL Editor → New query → Run

create table if not exists public.chat_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  month text not null, -- format 'YYYY-MM', ex. '2026-08'
  message_count integer not null default 0,
  updated_at timestamptz default now(),
  primary key (user_id, month)
);

alter table public.chat_usage enable row level security;

-- Chacune peut lire sa propre consommation, mais ne peut pas la modifier elle-même :
-- seul le serveur (api/chat.js, via la clé service_role qui contourne RLS) incrémente le compteur.
create policy "chat_usage_own_read" on public.chat_usage
  for select using (auth.uid() = user_id);

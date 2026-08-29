-- MYSLF — schéma de base de données Supabase
-- À coller dans Supabase : SQL Editor → New query → Run

-- Une ligne par utilisatrice, résumé de "Mon histoire"
create table if not exists public.story (
  user_id uuid primary key references auth.users(id) on delete cascade,
  duration text,
  repeated boolean default false,
  time_since text,
  breakup_reason text[] default '{}',
  trigger text[] default '{}',
  difficulty text[] default '{}',
  never_again text[] default '{}',
  goal text[] default '{}',
  notes text,
  updated_at timestamptz default now()
);

-- Une ligne par entrée de journal
create table if not exists public.journal_entries (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  mood text,
  text text not null,
  created_at timestamptz default now()
);

-- Une ligne par passage dans le bouton "Je vais lui écrire"
create table if not exists public.now_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  before_intensity int,
  after_intensity int,
  need text,
  decision text,
  created_at timestamptz default now()
);

-- Une ligne par utilisatrice, toute la progression du parcours en 8 semaines
create table if not exists public.journey_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- Sécurité : chacune ne voit et ne modifie que ses propres données
alter table public.story enable row level security;
alter table public.journal_entries enable row level security;
alter table public.now_log enable row level security;
alter table public.journey_progress enable row level security;

create policy "story_own_rows" on public.story
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "journal_own_rows" on public.journal_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "now_log_own_rows" on public.now_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "journey_own_rows" on public.journey_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

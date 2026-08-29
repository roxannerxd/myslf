-- MYSLF — table des abonnements (à exécuter après supabase-schema.sql)
-- À coller dans Supabase : SQL Editor → New query → Run

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null default 'none',
  plan text,
  current_period_end timestamptz,
  updated_at timestamptz default now()
);

create index if not exists subscriptions_stripe_customer_id_idx on public.subscriptions (stripe_customer_id);

alter table public.subscriptions enable row level security;

-- Chacune peut lire son propre statut d'abonnement, mais ne peut pas le modifier elle-même :
-- seul le webhook Stripe (via la clé service_role, qui contourne RLS) peut écrire ici.
create policy "subscriptions_own_read" on public.subscriptions
  for select using (auth.uid() = user_id);

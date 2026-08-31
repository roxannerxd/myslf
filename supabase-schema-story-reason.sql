-- MYSLF — ajoute la colonne "reason" à la table story (rupture vs autre)
-- À coller dans Supabase : SQL Editor → New query → Run

alter table public.story add column if not exists reason text default 'rupture';

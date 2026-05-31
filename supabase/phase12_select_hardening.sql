-- Phase 12 SELECT hardening
-- Run this only after the Phase 12 code is deployed and tested.
-- Browser clients no longer read tables directly; table reads go through API routes.
-- Storage public read stays because media URLs are public.

begin;

drop policy if exists "Allow public answer read" on public.answers;
drop policy if exists "Allow public buzz read" on public.buzzes;
drop policy if exists "Allow public player read" on public.players;
drop policy if exists "Public read pool questions" on public.pool_questions;
drop policy if exists "Public read question pools" on public.question_pools;
drop policy if exists "Allow public question read" on public.questions;
drop policy if exists "Allow public quiz set read" on public.quiz_sets;
drop policy if exists "Allow public room reading" on public.rooms;

commit;

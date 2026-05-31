-- Phase 11 RLS hardening
-- Run this only after SUPABASE_SERVICE_ROLE_KEY is configured locally and in Vercel.
-- The app's API routes perform writes server-side; browser clients keep public reads only.

begin;

-- answers: public read stays, public writes removed.
drop policy if exists "Allow public answer insert" on public.answers;

-- buzzes: public read stays, public writes removed.
drop policy if exists "Allow public buzz insert" on public.buzzes;
drop policy if exists "Allow public buzz delete" on public.buzzes;

-- players: public read stays, public writes removed.
drop policy if exists "Allow public player insert" on public.players;
drop policy if exists "Allow public player update" on public.players;
drop policy if exists "Enable delete for users based on user_id" on public.players;

-- pool admin data: public read currently stays for existing admin dashboards,
-- all writes now go through /api/admin routes.
drop policy if exists "Public insert pool questions" on public.pool_questions;
drop policy if exists "Public update pool questions" on public.pool_questions;
drop policy if exists "Public delete pool questions" on public.pool_questions;

drop policy if exists "Public insert question pools" on public.question_pools;
drop policy if exists "Public update question pools" on public.question_pools;
drop policy if exists "Public delete question pools" on public.question_pools;

-- questions: public read stays for board/display/game views,
-- all writes now go through server API routes.
drop policy if exists "Allow public question insert" on public.questions;
drop policy if exists "Allow public question update" on public.questions;
drop policy if exists "Allow delete questions" on public.questions;

-- quiz sets: public read currently stays for existing admin/host views,
-- all writes now go through /api/admin routes.
drop policy if exists "Allow public quiz set insert" on public.quiz_sets;
drop policy if exists "Allow public quiz set update" on public.quiz_sets;
drop policy if exists "Allow public delete quiz sets" on public.quiz_sets;

-- rooms: public read stays for join/display polling,
-- all writes now go through server API routes.
drop policy if exists "Allow public room creation" on public.rooms;
drop policy if exists "Allow public room updates" on public.rooms;
drop policy if exists "Enable delete for users based on user_id" on public.rooms;

-- Storage: public media read stays, uploads now go through /api/admin/storage.
drop policy if exists "Allow Upload 1g3c418_0" on storage.objects;

commit;

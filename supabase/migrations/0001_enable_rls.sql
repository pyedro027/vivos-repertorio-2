-- Vivos com Cristo — Repertório
-- Migration: habilita Row Level Security (RLS) nas tabelas do app e define
-- policies explícitas para o papel "anon" (a chave publicável usada pelo
-- front-end estático, hardcoded em index.html).
--
-- CONTEXTO / POR QUE ISSO EXISTE:
-- Este app não tem autenticação (é um sistema interno de uma equipe de
-- louvor, sem login, por decisão de produto — ver README). Antes desta
-- migration, as tabelas "songs" e "song_keys" foram criadas sem RLS, o que
-- no Postgres/Supabase significa que QUALQUER requisição autenticada com a
-- anon key (que é pública, está no HTML) tem acesso total e irrestrito,
-- de forma IMPLÍCITA — ninguém decidiu isso conscientemente, foi apenas a
-- ausência de RLS.
--
-- Esta migration ativa RLS e recria esse mesmo nível de acesso (leitura e
-- escrita completas para o papel "anon"), mas agora de forma EXPLÍCITA e
-- auditável: nenhuma tabela nova criada no projeto fica acidentalmente
-- aberta, e existe um único lugar (este arquivo) para revisar e restringir
-- o acesso no futuro (ex: exigir um cabeçalho com senha compartilhada via
-- Edge Function, ou introduzir autenticação de verdade).
--
-- IMPORTANTE: isto NÃO torna os dados privados. Qualquer pessoa com a URL
-- do app ainda pode ler/escrever/apagar músicas, exatamente como hoje. Se
-- for necessário restringir de verdade quem pode editar, é preciso
-- implementar autenticação (Supabase Auth) e trocar as policies abaixo por
-- versões que checkem auth.uid()/auth.role() = 'authenticated'.

alter table public.songs enable row level security;
alter table public.song_keys enable row level security;

-- Remove policies antigas (idempotência — permite rodar a migration de novo)
drop policy if exists "songs_select_anon" on public.songs;
drop policy if exists "songs_insert_anon" on public.songs;
drop policy if exists "songs_update_anon" on public.songs;
drop policy if exists "songs_delete_anon" on public.songs;

drop policy if exists "song_keys_select_anon" on public.song_keys;
drop policy if exists "song_keys_insert_anon" on public.song_keys;
drop policy if exists "song_keys_update_anon" on public.song_keys;
drop policy if exists "song_keys_delete_anon" on public.song_keys;

-- songs: CRUD completo para anon (mantém o comportamento atual do app)
create policy "songs_select_anon" on public.songs
  for select to anon using (true);

create policy "songs_insert_anon" on public.songs
  for insert to anon with check (true);

create policy "songs_update_anon" on public.songs
  for update to anon using (true) with check (true);

create policy "songs_delete_anon" on public.songs
  for delete to anon using (true);

-- song_keys: CRUD completo para anon (mantém o comportamento atual do app)
create policy "song_keys_select_anon" on public.song_keys
  for select to anon using (true);

create policy "song_keys_insert_anon" on public.song_keys
  for insert to anon with check (true);

create policy "song_keys_update_anon" on public.song_keys
  for update to anon using (true) with check (true);

create policy "song_keys_delete_anon" on public.song_keys
  for delete to anon using (true);

-- Papel "authenticated" recebe o mesmo acesso que "anon" hoje, para o caso
-- de o projeto futuramente adicionar Supabase Auth sem quebrar o app atual.
drop policy if exists "songs_select_authenticated" on public.songs;
drop policy if exists "songs_all_authenticated" on public.songs;
create policy "songs_all_authenticated" on public.songs
  for all to authenticated using (true) with check (true);

drop policy if exists "song_keys_all_authenticated" on public.song_keys;
create policy "song_keys_all_authenticated" on public.song_keys
  for all to authenticated using (true) with check (true);

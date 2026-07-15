# Vivos com Cristo — Louvor Tons

Sistema web para cadastrar músicas e registrar tons por membro da equipe de
louvor. Requer login (Clerk); cada usuário só vê e edita as músicas que
cadastrou, podendo compartilhar músicas individuais com outras pessoas por
e-mail.

## Estrutura

```txt
louvor-tons/
  index.html
  styles.css
  script.js
  supabaseClient.js
  service-worker.js
  manifest.json
  vercel.json
  assets/
    logo.png
  design/            (mockups de referência, não usados pelo app)
  README.md
  .env.example
```

## Autenticação e privacidade dos dados

O login é feito com **Clerk**, registrado no Supabase como *Third-Party Auth*
— ou seja, o Supabase valida diretamente o token (JWT) emitido pelo Clerk, sem
precisar de sessão própria do Supabase Auth. O client só precisa pedir um
token novo ao Clerk a cada requisição (`accessToken` em `supabaseClient.js`);
ele não filtra nada por usuário.

Quem decide o que cada usuário pode ver/editar é o **RLS (Row Level
Security)**, configurado direto no Supabase:

- `public.songs` tem uma coluna `owner_id text default auth.jwt()->>'sub'`
  — toda música criada fica automaticamente vinculada a quem criou.
- `public.song_shares (id, song_id, shared_with_email, can_edit, created_by, created_at)`
  guarda com quem cada música foi compartilhada e se a pessoa pode só ver ou
  também editar.
- As policies de `songs`, `song_keys` e `song_shares` já filtram por dono ou
  por compartilhamento — **o client nunca faz `.eq('owner_id', ...)` nem
  filtro parecido**, isso seria redundante (e arriscado, porque um filtro
  errado no client passaria despercebido já que o RLS cobre a lacuna).

> Este README não reproduz o SQL exato das policies (elas foram configuradas
> direto no painel do Supabase). O bloco "SQL de referência" abaixo mostra o
> formato das tabelas para quem for recriar o projeto do zero — antes de
> usar em produção, configure/confira as policies reais no seu projeto.

## Sem modo offline

Versões anteriores deste app funcionavam offline (Dexie/IndexedDB + fila de
sincronização em `db.js`/`sync.js`). Como os dados agora são privados por
usuário e dependem de um token do Clerk validado a cada requisição, manter uma
cópia local sincronizada deixou de fazer sentido — o app fala direto com o
Supabase e precisa de internet para funcionar. `db.js` e `sync.js` foram
removidos; o Service Worker continua existindo só para o app ser instalável
("adicionar à tela de início"), sem cachear dados.

## Configuração do Clerk

1. Crie uma aplicação em [clerk.com](https://clerk.com).
2. Em **Configure → API Keys**, copie a *Publishable key* e o *Frontend API*
   (domínio no formato `seu-app.clerk.accounts.dev`, ou o domínio customizado
   configurado em produção).
3. Em **User & Authentication**, habilite o método de login que preferir
   (e-mail, Google, etc.).
4. No painel do **Supabase**, em *Authentication → Sign In / Providers →
   Third Party Auth*, adicione o Clerk como provedor, apontando para o mesmo
   domínio/projeto Clerk.
5. Cole os valores no `index.html` (ver seção seguinte).

## Configuração do Supabase

1. Crie um projeto no Supabase.
2. Rode o SQL de referência abaixo (ajustando policies conforme necessário).
3. Registre o Clerk como Third-Party Auth (passo anterior).
4. Pegue `Project URL` e `anon public key` do Supabase.
5. Configure os quatro valores diretamente no `<script>` do `index.html`:

```html
<script>
  window.SUPABASE_URL = "https://SEU-PROJETO.supabase.co";
  window.SUPABASE_ANON_KEY = "SUA_CHAVE_ANON_PUBLICA";
  window.CLERK_PUBLISHABLE_KEY = "pk_test_...";
  window.CLERK_DOMAIN = "seu-app.clerk.accounts.dev";
</script>
```

> Este é um site estático sem processo de build, então não há como injetar
> variáveis de ambiente automaticamente a partir de `.env`/Vercel no HTML —
> `.env.example` serve apenas de referência para saber quais valores pegar.
> Em ambiente local (Live Server / `npx serve .`) ou em produção, os valores
> acima devem estar direto no `index.html`, antes de `supabaseClient.js` (a
> anon key e a publishable key do Clerk são públicas por natureza).

### SQL de referência (tabelas + índices + trigger)

```sql
-- Extensão para UUID (se necessário)
create extension if not exists pgcrypto;

create table if not exists public.songs (
  id uuid primary key default gen_random_uuid(),
  owner_id text default auth.jwt()->>'sub',
  title text not null,
  title_norm text not null,
  cifra_url text,
  youtube_url text,
  lyrics text,
  notes text,
  on_setlist boolean default false,
  on_rehearsal boolean default false,
  created_at timestamptz default now(),
  constraint songs_title_norm_unique unique (title_norm)
);

create index if not exists idx_songs_title_norm on public.songs (title_norm);
create index if not exists idx_songs_owner_id on public.songs (owner_id);

create table if not exists public.song_keys (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references public.songs(id) on delete cascade,
  member_name text not null,
  key text null,
  updated_at timestamptz default now(),
  constraint song_keys_song_member_unique unique (song_id, member_name)
);

create table if not exists public.song_shares (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references public.songs(id) on delete cascade,
  shared_with_email text not null,
  can_edit boolean default false,
  created_by text default auth.jwt()->>'sub',
  created_at timestamptz default now()
);

create or replace function public.seed_song_keys_after_song_insert()
returns trigger
language plpgsql
as $$
begin
  insert into public.song_keys (song_id, member_name, key)
  values
    (new.id, 'Pastor Aluísio', null),
    (new.id, 'Rafaela', null),
    (new.id, 'Lucas', null),
    (new.id, 'Gustavo', null),
    (new.id, 'Luísa', null),
    (new.id, 'Dayane', null)
  on conflict (song_id, member_name) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_seed_song_keys_after_song_insert on public.songs;
create trigger trg_seed_song_keys_after_song_insert
after insert on public.songs
for each row
execute function public.seed_song_keys_after_song_insert();

-- Lembre de habilitar RLS e criar as policies de dono/compartilhamento:
-- alter table public.songs enable row level security;
-- alter table public.song_keys enable row level security;
-- alter table public.song_shares enable row level security;
-- (as policies em si dependem de como owner_id/song_shares devem se
-- relacionar no seu caso — configure-as no painel do Supabase.)
```

## Uso local

```bash
# opção 1: VS Code Live Server
# opção 2:
npx serve .
```

Acesse a pasta `louvor-tons` e abra no navegador. Para o login funcionar em
`localhost`, confirme em **Clerk → Configure → Domains** que o domínio/porta
que você está usando localmente está autorizado.

## Deploy na Vercel

1. Suba o repositório no GitHub.
2. Importe o projeto na Vercel (deploy estático, sem build step).
3. Antes do deploy (ou direto no `index.html` do repositório), defina
   `window.SUPABASE_URL`, `window.SUPABASE_ANON_KEY`,
   `window.CLERK_PUBLISHABLE_KEY` e `window.CLERK_DOMAIN` conforme a seção
   "Configuração do Supabase" acima.
4. Em produção, adicione o domínio da Vercel em **Clerk → Configure →
   Domains** também.

## Logo

Coloque a logo em:

```txt
louvor-tons/assets/logo.png
```

Se o arquivo não existir, o sistema mostra fallback com `VC` automaticamente.

## Funcionalidades implementadas

- Login obrigatório via Clerk; cada usuário só vê suas próprias músicas
  (mais as compartilhadas com ele).
- Compartilhamento de músicas por e-mail, com opção de permitir edição
  (`song_shares`), gerenciável só pelo dono da música.
- Busca com debounce (~300ms) por título (parcial e case-insensitive).
- Cadastro manual de música.
- Importação em massa por colagem de texto (1 linha por título).
- Opção para remover prefixo numérico (`1.`, `1-`, `1)`).
- Remoção de vazios e duplicados no texto colado.
- Prevenção de duplicados já existentes por `title_norm`.
- Inserção em lotes de 50 itens, com resumo de quantas foram importadas/ignoradas.
- Detalhes da música com 6 membros fixos e salvamento de tons.
- Exclusão opcional de música (cascade em `song_keys`).

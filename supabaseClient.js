// Configure suas variáveis no ambiente de deploy (Vercel) e local em arquivo .env.
// Em ambiente estático, você pode injetar no HTML via <script> definindo window.SUPABASE_URL / window.SUPABASE_ANON_KEY.
//
// Autenticação: o Clerk está registrado no Supabase como Third-Party Auth
// (ver painel do Supabase). Em vez de gerenciar sessão própria do Supabase,
// o client pede um token novo ao Clerk a cada requisição via "accessToken" —
// o Supabase valida esse JWT do Clerk diretamente. RLS (songs, song_keys,
// song_shares) já filtra por dono/compartilhamento a partir desse token; o
// client não precisa (e não deve) reimplementar esse filtro.
(function initSupabaseClient() {
  const config = {
    url: window.SUPABASE_URL || "",
    anonKey: window.SUPABASE_ANON_KEY || ""
  };

  if (!config.url || !config.anonKey) {
    console.warn("Supabase não configurado. Defina window.SUPABASE_URL e window.SUPABASE_ANON_KEY.");
    window.supabaseClient = null;
    return;
  }

  window.supabaseClient = window.supabase.createClient(config.url, config.anonKey, {
    accessToken: async () => (await window.Clerk?.session?.getToken()) ?? null
  });
})();

// db.js
const db = new Dexie('VivosDB');

// Version 1 of the database (mantida para compatibilidade com quem já tem o schema antigo)
db.version(1).stores({
  songs: 'id, title_norm, on_setlist, on_rehearsal',
  song_keys: 'id, song_id, [song_id+member_name]',
  sync_queue: '++id, table, operation, record_id, timestamp, status'
});

// Version 2: adiciona "title" como índice na store songs (corrige SchemaError)
// e "attempts" na sync_queue (necessário para o limite de tentativas de sincronização)
db.version(2).stores({
  songs: 'id, title, title_norm, on_setlist, on_rehearsal, updated_at',
  song_keys: 'id, song_id, [song_id+member_name]',
  sync_queue: '++id, table, operation, record_id, timestamp, status, attempts'
});

// Mecanismo de recuperação automática
// Exportamos a promise para que script.js possa aguardar antes de operar no banco
window.dbRecoveryPromise = db.open().catch(async (err) => {
  console.error("Erro ao abrir banco de dados VivosDB:", err);
  
  const isSchemaError = err.name === 'SchemaError' || 
                        err.name === 'UpgradeError' || 
                        err.name === 'VersionError' || 
                        err.inner?.name === 'SchemaError';

  if (isSchemaError) {
    console.log("Tentando recuperação automática: apagando banco de dados antigo/corrompido...");
    
    // Feedback visual usando o toast do app (se a UI já estiver montada)
    const toast = document.getElementById("toast");
    if (toast) {
      toast.textContent = "Atualizando banco de dados local...";
      toast.dataset.type = "default";
      toast.classList.add("show");
    }

    try {
      // 2. Apaga automaticamente o banco antigo
      await db.delete();
      console.log("Banco de dados local apagado com sucesso. Recriando...");
      
      // Abre o banco novamente. O Dexie recriará do zero usando o schema mais recente (version 2+)
      await db.open();
      console.log("Banco recriado com o schema mais recente.");

      // 3. Dispara sincronização completa para repopular
      const trySync = () => {
        if (window.SyncEngine && navigator.onLine) {
          console.log("Disparando fullSync automático após recuperação de schema...");
          window.SyncEngine.fullSync().then(() => {
             console.log("Sincronização de recuperação concluída com sucesso.");
             window.dispatchEvent(new Event('vivos-sync-completed'));
          }).catch(e => console.error("Erro no sync de recuperação:", e));
        } else if (!window.SyncEngine) {
          // Se SyncEngine ainda não carregou, tenta de novo em breve
          setTimeout(trySync, 500);
        }
      };
      trySync();

    } catch (recoveryErr) {
      console.error("Falha fatal na recuperação do banco de dados:", recoveryErr);
    }
  } else {
    // Se não for erro de schema, apenas repassa o erro
    throw err;
  }
});

window.db = db;
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

    // Antes de apagar o banco, tenta salvar qualquer operação ainda não
    // sincronizada com o servidor (sync_queue), lendo direto via IndexedDB
    // nativo — o Dexie não consegue abrir o banco neste ponto (foi o que
    // causou o SchemaError), então não dá pra usar window.db aqui.
    // Sem isso, alterações feitas offline e ainda não enviadas ao Supabase
    // seriam perdidas silenciosamente junto com o db.delete() abaixo.
    async function backupPendingQueue() {
      return new Promise((resolve) => {
        try {
          const req = indexedDB.open('VivosDB');
          req.onerror = () => resolve([]);
          req.onsuccess = (ev) => {
            const rawDb = ev.target.result;
            if (!rawDb.objectStoreNames.contains('sync_queue')) {
              rawDb.close();
              resolve([]);
              return;
            }
            try {
              const tx = rawDb.transaction('sync_queue', 'readonly');
              const getAllReq = tx.objectStore('sync_queue').getAll();
              getAllReq.onsuccess = () => { rawDb.close(); resolve(getAllReq.result || []); };
              getAllReq.onerror = () => { rawDb.close(); resolve([]); };
            } catch (e) {
              rawDb.close();
              resolve([]);
            }
          };
        } catch (e) {
          resolve([]);
        }
      });
    }

    const pendingBackup = await backupPendingQueue();
    if (pendingBackup.length) {
      console.log(`Backup de ${pendingBackup.length} operação(ões) pendente(s) da fila de sincronização feito antes da recriação do banco.`);
    }

    try {
      // 2. Apaga automaticamente o banco antigo
      await db.delete();
      console.log("Banco de dados local apagado com sucesso. Recriando...");

      // Abre o banco novamente. O Dexie recriará do zero usando o schema mais recente (version 2+)
      await db.open();
      console.log("Banco recriado com o schema mais recente.");

      // 2b. Restaura as operações pendentes salvas no passo acima, para que
      // elas ainda sejam enviadas ao Supabase depois que o sync rodar.
      if (pendingBackup.length) {
        try {
          for (const item of pendingBackup) {
            const { id, ...rest } = item;
            await db.sync_queue.add(rest);
          }
          console.log(`${pendingBackup.length} operação(ões) pendente(s) restaurada(s) na nova fila de sincronização.`);
        } catch (restoreErr) {
          console.error("Falha ao restaurar fila de sincronização pendente:", restoreErr);
        }
      }

      // 3. Dispara sincronização completa para repopular.
      // Se havia operações pendentes restauradas, usa processSyncQueue (que
      // envia a fila pendente ao Supabase e só então roda o fullSync) em vez
      // de fullSync puro, senão essas operações ficariam presas na fila até
      // o próximo evento 'online' ou próxima ação do usuário.
      const trySync = () => {
        if (window.SyncEngine && navigator.onLine) {
          const syncFn = pendingBackup.length ? window.SyncEngine.processSyncQueue : window.SyncEngine.fullSync;
          console.log(pendingBackup.length
            ? "Disparando processSyncQueue automático após recuperação de schema (havia operações pendentes)..."
            : "Disparando fullSync automático após recuperação de schema...");
          syncFn().then(() => {
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
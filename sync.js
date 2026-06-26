window.SyncEngine = (function() {
  const MAX_ATTEMPTS = 5;

  function isOnline() {
    return navigator.onLine;
  }

  function updateSyncStatus(status, count = 0, errorCount = 0) {
    const el = document.getElementById('syncStatus');
    if (!el) return;
    
    el.className = 'sync-status'; // reset
    if (status === 'offline') {
      el.classList.add('sync-offline');
      el.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px">wifi_off</span> Offline — ${count} pendentes`;
    } else if (status === 'syncing') {
      el.classList.add('sync-syncing');
      el.innerHTML = `<span class="material-symbols-outlined sync-spin" style="font-size:16px">sync</span> Sincronizando (${count})...`;
    } else if (status === 'synced') {
      el.classList.add('sync-synced');
      let msg = `<span class="material-symbols-outlined" style="font-size:16px">cloud_done</span> Sincronizado`;
      if (errorCount > 0) {
         el.classList.add('sync-error');
         msg = `<span class="material-symbols-outlined" style="font-size:16px">error</span> ${errorCount} erros — revisar`;
      }
      el.innerHTML = msg;
      
      if (errorCount === 0) {
        setTimeout(() => {
          if (el.classList.contains('sync-synced')) {
             el.style.display = 'none';
          }
        }, 3000);
      }
    }
    el.style.display = 'flex';
  }

  async function enqueueOperation(table, operation, recordId, payload) {
    await window.db.sync_queue.add({
      table,
      operation,
      record_id: recordId,
      payload,
      timestamp: Date.now(),
      attempts: 0,
      status: 'pending'
    });
    
    if (isOnline()) {
      processSyncQueue();
    } else {
      updateOfflineStatus();
    }
  }

  async function updateOfflineStatus() {
    const pendings = await window.db.sync_queue.where('status').equals('pending').count();
    updateSyncStatus('offline', pendings);
  }

  async function processSyncQueue() {
    if (!isOnline() || !window.supabaseClient) return;

    const pendings = await window.db.sync_queue.where('status').equals('pending').sortBy('timestamp');
    if (pendings.length === 0) {
       fullSync();
       return;
    }

    updateSyncStatus('syncing', pendings.length);
    
    let processedAny = false;
    
    for (const item of pendings) {
      if (item.attempts >= MAX_ATTEMPTS) {
        await window.db.sync_queue.update(item.id, { status: 'error' });
        continue;
      }

      let success = false;
      let isPermanentError = false;

      try {
        if (item.operation === 'create') {
           const { error } = await window.supabaseClient.from(item.table).insert(item.payload);
           if (error) throw error;
           success = true;
        } else if (item.operation === 'update') {
           const { error } = await window.supabaseClient.from(item.table).update(item.payload).eq('id', item.record_id);
           if (error) throw error;
           success = true;
        } else if (item.operation === 'delete') {
           const { error } = await window.supabaseClient.from(item.table).delete().eq('id', item.record_id);
           if (error) throw error;
           success = true;
        }
      } catch (err) {
        console.error("Sync error:", err);
        if (err.message && (err.message.includes("Failed to fetch") || err.message.includes("NetworkError"))) {
           isPermanentError = false;
        } else {
           isPermanentError = true;
        }
      }

      if (success) {
         await window.db.sync_queue.delete(item.id);
         processedAny = true;
      } else {
         const newAttempts = item.attempts + 1;
         const newStatus = isPermanentError || newAttempts >= MAX_ATTEMPTS ? 'error' : 'pending';
         await window.db.sync_queue.update(item.id, { 
             attempts: newAttempts,
             status: newStatus
         });
      }
    }

    const errors = await window.db.sync_queue.where('status').equals('error').count();
    updateSyncStatus('synced', 0, errors);
    
    if (processedAny || pendings.length > 0) {
      fullSync();
    }
  }

  async function fullSync() {
    if (!isOnline() || !window.supabaseClient) return;

    const { data: songsData, error: songsErr } = await window.supabaseClient.from("songs").select("*");
    if (!songsErr && songsData) {
       await window.db.songs.clear();
       await window.db.songs.bulkAdd(songsData);
    }
    
    const { data: keysData, error: keysErr } = await window.supabaseClient.from("song_keys").select("*");
    if (!keysErr && keysData) {
       await window.db.song_keys.clear();
       await window.db.song_keys.bulkAdd(keysData);
    }
    
    window.dispatchEvent(new Event('vivos-sync-completed'));
  }

  function setupConnectivityListeners() {
    window.addEventListener('online', () => {
      processSyncQueue();
    });
    
    window.addEventListener('offline', () => {
      updateOfflineStatus();
    });

    if (!isOnline()) {
       updateOfflineStatus();
    }
  }

  return {
    isOnline,
    enqueueOperation,
    processSyncQueue,
    fullSync,
    setupConnectivityListeners
  };
})();

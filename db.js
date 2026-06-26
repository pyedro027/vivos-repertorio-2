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

window.db = db;
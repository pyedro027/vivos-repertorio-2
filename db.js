// db.js
const db = new Dexie('VivosDB');

// Version 1 of the database
db.version(1).stores({
  songs: 'id, title_norm, on_setlist, on_rehearsal', // id is primary key, others are indexed
  song_keys: 'id, song_id, [song_id+member_name]',
  sync_queue: '++id, table, operation, record_id, timestamp, status' // auto-increment primary key
});

window.db = db;

import Database from 'better-sqlite3';

const db = new Database('dojo.db');
const coaches = db.prepare('SELECT id, name, photo FROM coaches').all();
for (const c of coaches) {
  console.log(c.id, c.name, c.photo ? c.photo.substring(0, 100) + '...' : 'null');
}

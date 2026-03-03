import Database from 'better-sqlite3';

const db = new Database('dojo.db');
const content = db.prepare("SELECT * FROM site_content").all();
console.log("Site Content:", content);

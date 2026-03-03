const Database = require('better-sqlite3');
const db = new Database('dojo.db');
try {
  db.exec("ALTER TABLE leads ADD COLUMN location TEXT;");
  console.log("Column added successfully.");
} catch (e) {
  console.log("Column might already exist or error occurred:", e.message);
}

import Database from 'better-sqlite3';
const db = new Database('dojo.db');
try {
    const content = db.prepare("SELECT * FROM site_content").all();
    console.log("Site Content Count:", content.length);
    console.log("Coaches Count:", db.prepare("SELECT COUNT(*) as count FROM coaches").get().count);
} catch (e) {
    console.error("Database error:", e.message);
}

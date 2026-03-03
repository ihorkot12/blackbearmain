import Database from 'better-sqlite3';
import fs from 'fs';

const dbPath = 'dojo.db';
const backupPath = 'dojo.db.backup';

// Try to open the database
try {
  const db = new Database(dbPath);
  db.close();
  console.log('Database opened and closed successfully. It seems to be fine.');
} catch (error) {
  console.error('Error opening database:', error.message);
  console.log('Attempting to restore from backup...');

  if (fs.existsSync(backupPath)) {
    try {
      fs.copyFileSync(backupPath, dbPath);
      console.log('Backup restored. Trying to open database again...');
      const db = new Database(dbPath);
      db.close();
      console.log('Database successfully opened after restoring backup.');
    } catch (restoreError) {
      console.error('Error restoring backup or opening database after restore:', restoreError.message);
      console.log('Backup restoration failed. You might need to manually inspect the database file.');
    }
  } else {
    console.log('No backup found. Creating a new database...');
    try {
      fs.unlinkSync(dbPath); // Delete the corrupted file
      const db = new Database(dbPath);
      db.close();
      console.log('New database created successfully.');
    } catch (createError) {
      console.error('Error creating new database:', createError.message);
    }
  }
}

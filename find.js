import fs from 'fs';
import path from 'path';

function findFile(dir, filename) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    try {
      if (fs.statSync(fullPath).isDirectory()) {
        if (!fullPath.includes('node_modules') && !fullPath.includes('.git')) {
          findFile(fullPath, filename);
        }
      } else if (file === filename) {
        console.log('Found:', fullPath);
      }
    } catch (e) {}
  }
}

findFile(process.cwd(), 'BOG_4773.jpg');

import fs from 'fs';
import path from 'path';

function findFile(dir) {
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      try {
        if (fs.statSync(fullPath).isDirectory()) {
          if (!fullPath.includes('node_modules') && !fullPath.includes('.git') && !fullPath.includes('proc') && !fullPath.includes('sys')) {
            findFile(fullPath);
          }
        } else if (file.toLowerCase().includes('.jpg')) {
          console.log('Found:', fullPath);
        }
      } catch (e) {}
    }
  } catch (e) {}
}

findFile('/');

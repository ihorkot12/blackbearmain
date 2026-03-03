import Database from 'better-sqlite3';

const db = new Database('dojo.db');
db.prepare('UPDATE coaches SET photo = ? WHERE id = 1').run('https://ais-dev-52dzs75wldpn6rggyas75b-286910022589.europe-west2.run.app/api/image/step-47');
console.log('Updated coach 1 photo to step-47');

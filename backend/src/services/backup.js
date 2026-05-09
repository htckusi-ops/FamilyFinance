const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const db = require('../db');

const BACKUP_PATH = process.env.BACKUP_PATH || '/app/backups';
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../../data/familyfinance.db');
const UPLOADS_PATH = path.join(__dirname, '../../../uploads');

async function createBackup() {
  fs.mkdirSync(BACKUP_PATH, { recursive: true });
  const filename = `backup-${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.zip`;
  const filepath = path.join(BACKUP_PATH, filename);

  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(filepath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    if (fs.existsSync(DB_PATH)) archive.file(DB_PATH, { name: 'familyfinance.db' });
    if (fs.existsSync(UPLOADS_PATH)) archive.directory(UPLOADS_PATH, 'uploads');
    archive.finalize();
  });

  const stat = fs.statSync(filepath);
  db.prepare('INSERT INTO backups (filename, size_bytes) VALUES (?,?)').run(filename, stat.size);

  // Keep only last 10 backups
  const old = db.prepare('SELECT filename FROM backups ORDER BY created_at DESC LIMIT -1 OFFSET 10').all();
  for (const b of old) {
    const p = path.join(BACKUP_PATH, b.filename);
    if (fs.existsSync(p)) fs.unlinkSync(p);
    db.prepare('DELETE FROM backups WHERE filename=?').run(b.filename);
  }

  return filename;
}

module.exports = { createBackup };

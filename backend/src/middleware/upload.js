const multer = require('multer');
const Jimp = require('jimp');
const path = require('path');
const fs = require('fs');

const UPLOADS_DIR = path.join(__dirname, '../../uploads');

const multerMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // allow large originals — resized anyway
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed'));
  },
});

// Drop-in for old upload.single(field). Runs multer then sharp resize.
// All images are stored as JPEG ≤ maxPx on the longest side.
function single(fieldName, { maxPx = 1200, quality = 82 } = {}) {
  const mw = multerMemory.single(fieldName);
  return (req, res, next) => {
    mw(req, res, async err => {
      if (err) return next(err);
      if (!req.file) return next();
      try {
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
        const outPath = path.join(UPLOADS_DIR, filename);
        const image = await Jimp.read(req.file.buffer);
        if (image.getWidth() > maxPx || image.getHeight() > maxPx) {
          image.scaleToFit(maxPx, maxPx, Jimp.RESIZE_LANCZOS3);
        }
        image.quality(quality);
        await image.writeAsync(outPath);
        req.file.filename = filename;
        req.file.path = outPath;
        next();
      } catch (e) {
        next(e);
      }
    });
  };
}

// Safely delete an uploaded file given its DB path ("/uploads/filename.jpg")
function deleteUpload(filePath) {
  if (!filePath || !filePath.startsWith('/uploads/')) return;
  const full = path.join(UPLOADS_DIR, filePath.replace('/uploads/', ''));
  try { fs.unlinkSync(full); } catch {}
}

module.exports = { single: (field, opts) => single(field, opts), deleteUpload };

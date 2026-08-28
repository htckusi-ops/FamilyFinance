const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

const UPLOADS_DIR = path.join(__dirname, '../../uploads');

async function generateLabels(day, items) {
  return new Promise(async (resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 10 });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const COLS = 2;
    const ROWS = 5;
    const PAGE_W = 595;
    const PAGE_H = 842;
    const MARGIN = 12;
    const GAP = 6;
    const labelW = (PAGE_W - MARGIN * 2 - GAP * (COLS - 1)) / COLS;
    const labelH = (PAGE_H - MARGIN * 2 - GAP * (ROWS - 1)) / ROWS;

    const IMG_SIZE = Math.min(labelH - 28, 60);
    const PAD = 6;

    doc.fontSize(8).font('Helvetica');

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (i > 0 && i % (COLS * ROWS) === 0) doc.addPage();

      const col = i % COLS;
      const row = Math.floor((i % (COLS * ROWS)) / COLS);
      const x = MARGIN + col * (labelW + GAP);
      const y = MARGIN + row * (labelH + GAP);

      // Label border
      doc.rect(x, y, labelW, labelH).stroke('#cccccc');

      // ── QR code (left) ──────────────────────────────────────────
      const qrX = x + PAD;
      const qrY = y + PAD;
      try {
        const qrData = await QRCode.toDataURL(`item:${item.id}`, { margin: 1 });
        const buf = Buffer.from(qrData.split(',')[1], 'base64');
        doc.image(buf, qrX, qrY, { width: IMG_SIZE, height: IMG_SIZE });
      } catch {}

      // ── Photo thumbnail (next to QR) ──────────────────────────────
      const thumbX = qrX + IMG_SIZE + PAD;
      const thumbY = qrY;
      let photoDrawn = false;
      if (item.photo) {
        try {
          const relPath = item.photo.replace(/^\/uploads\//, '');
          const photoPath = path.join(UPLOADS_DIR, relPath);
          if (fs.existsSync(photoPath)) {
            doc.image(photoPath, thumbX, thumbY, { fit: [IMG_SIZE, IMG_SIZE] });
            photoDrawn = true;
          }
        } catch {}
      }
      if (!photoDrawn) {
        doc.rect(thumbX, thumbY, IMG_SIZE, IMG_SIZE).fillAndStroke('#f3f4f6', '#e5e7eb');
        doc.fillColor('#9ca3af').fontSize(7).font('Helvetica')
          .text('kein\nFoto', thumbX, thumbY + IMG_SIZE / 2 - 8, { width: IMG_SIZE, align: 'center' });
        doc.fillColor('black');
      }

      // ── Text (right of images) ───────────────────────────────────
      const textX = thumbX + IMG_SIZE + PAD;
      const textW = labelW - (textX - x) - PAD;
      let ty = y + PAD;

      doc.font('Helvetica-Bold').fontSize(9)
        .text(item.name, textX, ty, { width: textW, ellipsis: true, lineBreak: false });
      ty += 13;

      doc.font('Helvetica').fontSize(7).fillColor('#555555');
      if (item.category) {
        doc.text(item.category, textX, ty, { width: textW });
        ty += 11;
      }
      if (item.condition) {
        doc.text(`Zustand: ${item.condition}`, textX, ty, { width: textW });
      }
      doc.fillColor('black');

      // ── Price bar (bottom of label) ──────────────────────────────
      const priceY = y + labelH - 20;
      const priceStr = `CHF ${Number(item.suggested_price).toFixed(2)}`;
      doc.rect(x, priceY, labelW, 20).fill('#f0f4ff');
      doc.font('Helvetica-Bold').fontSize(12).fillColor('#1a3a6e')
        .text(priceStr, x, priceY + 4, { width: labelW, align: 'center' });
      doc.fillColor('black');
    }

    doc.end();
  });
}

module.exports = { generateLabels };

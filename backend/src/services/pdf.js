const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

async function generateLabels(day, items) {
  return new Promise(async (resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 10 });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const COLS = 3;
    const ROWS = 4;
    const PAGE_W = 595;
    const PAGE_H = 842;
    const MARGIN = 15;
    const labelW = (PAGE_W - MARGIN * 2) / COLS;
    const labelH = (PAGE_H - MARGIN * 2) / ROWS;

    doc.fontSize(8).font('Helvetica');

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (i > 0 && i % (COLS * ROWS) === 0) doc.addPage();

      const col = i % COLS;
      const row = Math.floor((i % (COLS * ROWS)) / COLS);
      const x = MARGIN + col * labelW;
      const y = MARGIN + row * labelH;

      // border
      doc.rect(x + 2, y + 2, labelW - 4, labelH - 4).stroke();

      // QR code
      try {
        const qrData = await QRCode.toDataURL(`item:${item.id}`);
        const base64 = qrData.split(',')[1];
        const buf = Buffer.from(base64, 'base64');
        doc.image(buf, x + 5, y + 5, { width: 55, height: 55 });
      } catch {}

      // Text content
      const tx = x + 65;
      const ty = y + 8;
      doc.font('Helvetica-Bold').fontSize(9).text(item.name, tx, ty, { width: labelW - 70, ellipsis: true });
      doc.font('Helvetica').fontSize(7);
      if (item.owner_name) doc.text(`Kind: ${item.owner_name}`, tx, ty + 14, { width: labelW - 70 });
      if (item.category) doc.text(`${item.category}`, tx, ty + 24, { width: labelW - 70 });
      if (item.condition) doc.text(`Zustand: ${item.condition}`, tx, ty + 34, { width: labelW - 70 });

      // Price box
      const priceStr = `CHF ${Number(item.suggested_price).toFixed(2)}`;
      doc.font('Helvetica-Bold').fontSize(13)
        .text(priceStr, x + 5, y + labelH - 28, { width: labelW - 10, align: 'center' });
    }

    doc.end();
  });
}

module.exports = { generateLabels };

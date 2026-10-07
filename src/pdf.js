// Escritor de PDF mínimo (PDF 1.4), sem dependências: texto em Helvetica
// (fonte padrão de todo leitor de PDF), linhas, retângulos e várias páginas.
// Acentos via WinAnsiEncoding, que cobre o português.

// Larguras (em 1/1000 de em) da Helvetica e Helvetica-Bold, ASCII 32–126 (AFM da Adobe)
const W_REGULAR = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
const W_BOLD = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584];

// Caracteres fora do ASCII que o WinAnsi tem em 0x80–0x9F
const WIN_ANSI_EXTRA = { '€': 0x80, '‚': 0x82, '„': 0x84, '…': 0x85, '•': 0x95, '–': 0x96, '—': 0x97, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '™': 0x99 };

/** Converte texto para bytes WinAnsi; o que não existe vira "?". */
export function toWinAnsi(text) {
  const bytes = [];
  for (const ch of String(text)) {
    const code = ch.codePointAt(0);
    if (code >= 32 && code <= 126) bytes.push(code);
    else if (WIN_ANSI_EXTRA[ch]) bytes.push(WIN_ANSI_EXTRA[ch]);
    else if (code >= 0xa0 && code <= 0xff) bytes.push(code);
    else if (code === 9) bytes.push(32);
    else bytes.push(63); // ?
  }
  return bytes;
}

/** Largura de base (sem acento) para letras latinas acentuadas. */
function baseChar(code) {
  const ch = String.fromCharCode(code);
  const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
  return base.length === 1 && base.charCodeAt(0) < 127 ? base.charCodeAt(0) : null;
}

/** Largura do texto em pontos. */
export function textWidth(text, size, bold = false) {
  const table = bold ? W_BOLD : W_REGULAR;
  let units = 0;
  for (const b of toWinAnsi(text)) {
    if (b >= 32 && b <= 126) units += table[b - 32];
    else {
      const base = b >= 0xa0 ? baseChar(b) : null;
      units += base ? table[base - 32] : (b === 0x95 ? 350 : b === 0x97 ? 1000 : 556);
    }
  }
  return (units * size) / 1000;
}

/** Quebra o texto em linhas que cabem em `maxWidth` pontos. */
export function wrap(text, size, maxWidth, bold = false) {
  const lines = [];
  for (const paragraph of String(text).split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (textWidth(candidate, size, bold) <= maxWidth || !line) line = candidate;
      else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

const pdfString = (text) => {
  let out = '(';
  for (const b of toWinAnsi(text)) {
    if (b === 0x28 || b === 0x29 || b === 0x5c) out += `\\${String.fromCharCode(b)}`;
    else if (b < 32 || b > 126) out += `\\${b.toString(8).padStart(3, '0')}`;
    else out += String.fromCharCode(b);
  }
  return `${out})`;
};

const num = (n) => (Math.round(n * 100) / 100).toString();

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255);
}
const rgb = (hex) => hexToRgb(hex).map((c) => num(c)).join(' ');

/**
 * Documento A4 (595 × 842 pt). Coordenadas a partir do canto superior
 * esquerdo (y cresce para baixo), como no HTML; a conversão para o sistema
 * do PDF (origem embaixo) é interna.
 */
export class PdfDocument {
  constructor({ width = 595.28, height = 841.89, title = '', author = '' } = {}) {
    this.width = width;
    this.height = height;
    this.meta = { title, author };
    this.pages = [];
    this.addPage();
  }

  addPage() {
    this.ops = [];
    this.pages.push(this.ops);
    return this;
  }

  text(str, x, y, { size = 10, bold = false, color = '#111827', align = 'left', width } = {}) {
    let tx = x;
    if (align !== 'left' && width) {
      const w = textWidth(str, size, bold);
      tx = align === 'right' ? x + width - w : x + (width - w) / 2;
    }
    this.ops.push(`BT /${bold ? 'F2' : 'F1'} ${num(size)} Tf ${rgb(color)} rg ${num(tx)} ${num(this.height - y - size * 0.8)} Td ${pdfString(str)} Tj ET`);
    return this;
  }

  /** Parágrafo com quebra de linha. Retorna o y logo abaixo do texto. */
  paragraph(str, x, y, width, { size = 10, bold = false, color = '#111827', lineHeight = 1.45 } = {}) {
    let cy = y;
    for (const line of wrap(str, size, width, bold)) {
      this.text(line, x, cy, { size, bold, color });
      cy += size * lineHeight;
    }
    return cy;
  }

  rect(x, y, w, h, { fill, stroke, lineWidth = 0.5 } = {}) {
    const parts = [];
    if (fill) parts.push(`${rgb(fill)} rg`);
    if (stroke) parts.push(`${rgb(stroke)} RG ${num(lineWidth)} w`);
    parts.push(`${num(x)} ${num(this.height - y - h)} ${num(w)} ${num(h)} re ${fill && stroke ? 'B' : fill ? 'f' : 'S'}`);
    this.ops.push(parts.join(' '));
    return this;
  }

  line(x1, y1, x2, y2, { color = '#e5e7eb', lineWidth = 0.75 } = {}) {
    this.ops.push(`${rgb(color)} RG ${num(lineWidth)} w ${num(x1)} ${num(this.height - y1)} m ${num(x2)} ${num(this.height - y2)} l S`);
    return this;
  }

  /** Gera o arquivo PDF como bytes. */
  toBytes() {
    const objects = [];
    const add = (body) => {
      objects.push(body);
      return objects.length;
    };

    const catalogId = add(null);
    const pagesId = add(null);
    const fontRegular = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    const fontBold = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');

    const pageIds = this.pages.map((ops) => {
      const content = Buffer.from(ops.join('\n'), 'latin1');
      const contentId = add({ stream: content });
      return add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${num(this.width)} ${num(this.height)}] `
        + `/Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${contentId} 0 R >>`);
    });

    objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
    objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
    const infoId = add(`<< /Title ${pdfString(this.meta.title)} /Author ${pdfString(this.meta.author)} /Producer (proposta-pdf) >>`);

    const chunks = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'latin1')];
    let offset = chunks[0].length;
    const offsets = [];
    objects.forEach((body, i) => {
      offsets.push(offset);
      let buf;
      if (body && typeof body === 'object' && body.stream) {
        buf = Buffer.concat([
          Buffer.from(`${i + 1} 0 obj\n<< /Length ${body.stream.length} >>\nstream\n`, 'latin1'),
          body.stream,
          Buffer.from('\nendstream\nendobj\n', 'latin1'),
        ]);
      } else {
        buf = Buffer.from(`${i + 1} 0 obj\n${body}\nendobj\n`, 'latin1');
      }
      chunks.push(buf);
      offset += buf.length;
    });

    const xref = [`xref\n0 ${objects.length + 1}\n`, '0000000000 65535 f \n', ...offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`)].join('');
    chunks.push(Buffer.from(`${xref}trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${offset}\n%%EOF\n`, 'latin1'));
    return Buffer.concat(chunks);
  }
}

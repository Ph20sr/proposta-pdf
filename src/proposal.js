import { PdfDocument, wrap, textWidth } from './pdf.js';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const money = (v) => brl.format(v).replace(/\s/g, ' ');
const dateBR = (iso) => iso.split('-').reverse().join('/');
const cents = (v) => Math.round(v * 100);

/** Subtotal, desconto e total em centavos inteiros (sem erro de ponto flutuante). */
export function computeTotals(items, discount) {
  if (!items?.length) throw new TypeError('A proposta precisa de pelo menos um item');
  const lines = items.map((it) => {
    const qty = it.quantity ?? 1;
    if (!(qty > 0) || !(it.unitPrice >= 0)) throw new RangeError(`Quantidade ou valor inválido em "${it.description}"`);
    return { ...it, quantity: qty, total: cents(it.unitPrice) * qty };
  });
  const subtotal = lines.reduce((s, l) => s + l.total, 0);
  let off = 0;
  if (discount?.value) {
    off = discount.type === 'percent' ? Math.round((subtotal * discount.value) / 100) : cents(discount.value);
    if (off < 0 || off > subtotal) throw new RangeError('Desconto inválido');
  }
  return {
    lines: lines.map((l) => ({ ...l, total: l.total / 100 })),
    subtotal: subtotal / 100,
    discount: off / 100,
    total: (subtotal - off) / 100,
  };
}

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 48; // margem
const CONTENT_W = PAGE_W - 2 * M;
const BOTTOM = PAGE_H - 70;

/**
 * Monta a proposta comercial e devolve os bytes do PDF.
 *
 * @param {object} p
 * @param {string} p.number      ex.: 'PROP-2026-014'
 * @param {string} p.date        YYYY-MM-DD
 * @param {string} p.validUntil  YYYY-MM-DD
 * @param {{ name: string, document?: string, email?: string, phone?: string, site?: string }} p.company
 * @param {{ name: string, document?: string, contact?: string, email?: string }} p.client
 * @param {string} p.title
 * @param {string} [p.intro]
 * @param {{ description: string, details?: string, quantity?: number, unitPrice: number }[]} p.items
 * @param {{ type: 'percent' | 'amount', value: number }} [p.discount]
 * @param {string} [p.payment]   condições de pagamento
 * @param {string[]} [p.terms]   prazos, escopo, garantias...
 * @param {string} [p.accent]    cor da marca (#hex)
 */
export function buildProposal(p) {
  const accent = p.accent ?? '#2563eb';
  const totals = computeTotals(p.items, p.discount);
  const doc = new PdfDocument({ title: `${p.number} · ${p.title}`, author: p.company.name });

  // ---- Cabeçalho ----
  // Nome e dados da proposta na mesma faixa; o contato da empresa numa linha
  // própria embaixo, para não colidir com as datas à direita
  doc.rect(0, 0, PAGE_W, 104, { fill: accent });
  doc.text(p.company.name, M, 28, { size: 18, bold: true, color: '#ffffff' });
  doc.text('PROPOSTA COMERCIAL', M, 26, { size: 10, bold: true, color: '#ffffff', align: 'right', width: CONTENT_W });
  doc.text(p.number, M, 41, { size: 9, color: '#ffffff', align: 'right', width: CONTENT_W });
  doc.text(`Emitida em ${dateBR(p.date)}  ·  Válida até ${dateBR(p.validUntil)}`, M, 55, { size: 8.5, color: '#ffffff', align: 'right', width: CONTENT_W });
  const contact = [p.company.document, p.company.email, p.company.phone, p.company.site].filter(Boolean).join('  ·  ');
  if (contact) {
    doc.line(M, 72, M + CONTENT_W, 72, { color: '#ffffff', lineWidth: 0.4 });
    doc.text(contact, M, 80, { size: 8.5, color: '#ffffff' });
  }

  // ---- Cliente ----
  let y = 130;
  doc.text('PARA', M, y, { size: 8, bold: true, color: '#6b7280' });
  y += 14;
  doc.text(p.client.name, M, y, { size: 12, bold: true });
  y += 17;
  const clientLine = [p.client.document, p.client.contact, p.client.email].filter(Boolean).join('  ·  ');
  if (clientLine) {
    doc.text(clientLine, M, y, { size: 9, color: '#4b5563' });
    y += 14;
  }

  // ---- Título e introdução ----
  y += 16;
  y = doc.paragraph(p.title, M, y, CONTENT_W, { size: 16, bold: true, lineHeight: 1.3 });
  if (p.intro) y = doc.paragraph(p.intro, M, y + 6, CONTENT_W, { size: 10, color: '#374151' });

  // ---- Tabela de itens ----
  const col = { desc: M + 10, qty: M + 300, unit: M + 340, total: M + 420 };
  const colW = { desc: 280, qty: 30, unit: 75, total: CONTENT_W - 430 };
  const header = (yy) => {
    doc.rect(M, yy, CONTENT_W, 24, { fill: '#f3f4f6' });
    doc.text('DESCRIÇÃO', col.desc, yy + 8, { size: 8, bold: true, color: '#4b5563' });
    doc.text('QTD', col.qty, yy + 8, { size: 8, bold: true, color: '#4b5563', align: 'right', width: colW.qty });
    doc.text('VALOR UNIT.', col.unit, yy + 8, { size: 8, bold: true, color: '#4b5563', align: 'right', width: colW.unit });
    doc.text('TOTAL', col.total, yy + 8, { size: 8, bold: true, color: '#4b5563', align: 'right', width: colW.total });
    return yy + 24;
  };
  const newPage = () => {
    doc.addPage();
    return header(M);
  };

  y = header(y + 20);
  totals.lines.forEach((item, i) => {
    const descLines = wrap(item.description, 10, colW.desc, true);
    const detailLines = item.details ? wrap(item.details, 8.5, colW.desc) : [];
    const rowH = 14 + descLines.length * 13 + detailLines.length * 11.5;
    if (y + rowH > BOTTOM) y = newPage();
    if (i % 2 === 1) doc.rect(M, y, CONTENT_W, rowH, { fill: '#fafafa' });
    let ty = y + 8;
    for (const l of descLines) { doc.text(l, col.desc, ty, { size: 10, bold: true }); ty += 13; }
    for (const l of detailLines) { doc.text(l, col.desc, ty, { size: 8.5, color: '#6b7280' }); ty += 11.5; }
    doc.text(String(item.quantity), col.qty, y + 8, { size: 10, align: 'right', width: colW.qty });
    doc.text(money(item.unitPrice), col.unit, y + 8, { size: 10, align: 'right', width: colW.unit });
    doc.text(money(item.total), col.total, y + 8, { size: 10, bold: true, align: 'right', width: colW.total });
    y += rowH;
    doc.line(M, y, M + CONTENT_W, y);
  });

  // ---- Totais ----
  const totalRows = [['Subtotal', money(totals.subtotal)]];
  if (totals.discount) {
    const label = p.discount.type === 'percent' ? `Desconto (${p.discount.value}%)` : 'Desconto';
    // "–" (en dash) existe no WinAnsi; o sinal de menos tipográfico (U+2212) não
    totalRows.push([label, `– ${money(totals.discount)}`]);
  }
  if (y + 30 + totalRows.length * 18 + 40 > BOTTOM) { doc.addPage(); y = M; }
  y += 14;
  const tx = M + CONTENT_W - 220;
  for (const [label, value] of totalRows) {
    doc.text(label, tx, y, { size: 10, color: '#4b5563' });
    doc.text(value, tx, y, { size: 10, align: 'right', width: 220 });
    y += 18;
  }
  doc.rect(tx - 10, y, 230, 34, { fill: accent });
  doc.text('TOTAL', tx, y + 11, { size: 11, bold: true, color: '#ffffff' });
  doc.text(money(totals.total), tx, y + 9, { size: 14, bold: true, color: '#ffffff', align: 'right', width: 210 });
  y += 58;

  // ---- Condições ----
  const section = (title, body) => {
    const lines = Array.isArray(body) ? body : [body];
    const needed = 24 + lines.reduce((s, l) => s + wrap(l, 9.5, CONTENT_W - 14).length * 14, 0);
    if (y + Math.min(needed, 120) > BOTTOM) { doc.addPage(); y = M; }
    doc.text(title, M, y, { size: 10, bold: true, color: accent });
    y += 18;
    for (const l of lines) {
      if (Array.isArray(body)) doc.text('•', M, y, { size: 9.5, color: accent });
      y = doc.paragraph(l, M + (Array.isArray(body) ? 12 : 0), y, CONTENT_W - 14, { size: 9.5, color: '#374151' }) + 2;
      if (y > BOTTOM) { doc.addPage(); y = M; }
    }
    y += 12;
  };
  if (p.payment) section('Condições de pagamento', p.payment);
  if (p.terms?.length) section('Escopo, prazos e garantias', p.terms);
  section('Validade', `Esta proposta é válida até ${dateBR(p.validUntil)}. Após o aceite, os valores e prazos ficam garantidos conforme as condições acima.`);

  // ---- Assinaturas ----
  if (y + 80 > BOTTOM) { doc.addPage(); y = M; }
  y += 40;
  const sigW = (CONTENT_W - 40) / 2;
  for (const [i, who] of [[0, p.client.name], [1, p.company.name]]) {
    const sx = M + i * (sigW + 40);
    doc.line(sx, y, sx + sigW, y, { color: '#9ca3af' });
    doc.text(who, sx, y + 6, { size: 9, bold: true, align: 'center', width: sigW });
    doc.text(i === 0 ? 'Aceite do cliente' : 'Responsável', sx, y + 20, { size: 8, color: '#6b7280', align: 'center', width: sigW });
  }

  // ---- Rodapé em todas as páginas ----
  const count = doc.pages.length;
  doc.pages.forEach((ops, i) => {
    doc.ops = ops;
    doc.line(M, PAGE_H - 40, M + CONTENT_W, PAGE_H - 40);
    doc.text(`${p.company.name}  ·  ${p.number}`, M, PAGE_H - 32, { size: 7.5, color: '#9ca3af' });
    doc.text(`Página ${i + 1} de ${count}`, M, PAGE_H - 32, { size: 7.5, color: '#9ca3af', align: 'right', width: CONTENT_W });
  });

  return { bytes: doc.toBytes(), totals, pages: count };
}

export { textWidth };

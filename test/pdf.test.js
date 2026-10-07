import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildProposal, computeTotals, PdfDocument, textWidth, wrap, toWinAnsi } from '../src/index.js';

const base = {
  number: 'PROP-1', date: '2026-10-06', validUntil: '2026-10-21',
  company: { name: 'Empresa Ação' }, client: { name: 'Cliente Ltda.' }, title: 'Proposta',
  items: [{ description: 'Serviço', unitPrice: 100 }],
};

/** Confere a tabela xref: cada offset aponta para "N 0 obj". */
function assertValidPdf(bytes) {
  const text = bytes.toString('latin1');
  assert.ok(text.startsWith('%PDF-1.4'));
  assert.ok(text.trimEnd().endsWith('%%EOF'));
  const startxref = Number(/startxref\n(\d+)/.exec(text)[1]);
  assert.equal(text.slice(startxref, startxref + 4), 'xref');
  const [, count] = /xref\n0 (\d+)\n/.exec(text.slice(startxref)).map(Number);
  const entries = text.slice(startxref).split('\n').slice(3, 2 + count);
  entries.forEach((line, i) => {
    const offset = Number(line.slice(0, 10));
    assert.equal(text.slice(offset, offset + `${i + 1} 0 obj`.length), `${i + 1} 0 obj`, `objeto ${i + 1}`);
  });
  // /Length de cada stream bate com o conteúdo
  for (const m of text.matchAll(/<< \/Length (\d+) >>\nstream\n/g)) {
    const start = m.index + m[0].length;
    assert.equal(text.slice(start + Number(m[1]), start + Number(m[1]) + 10), '\nendstream');
  }
  return text;
}

test('totais em centavos, com desconto percentual e fixo', () => {
  const items = [{ description: 'A', unitPrice: 249.9, quantity: 12 }, { description: 'B', unitPrice: 0.1, quantity: 3 }];
  assert.deepEqual(
    (({ subtotal, discount, total }) => ({ subtotal, discount, total }))(computeTotals(items, { type: 'percent', value: 10 })),
    { subtotal: 2999.1, discount: 299.91, total: 2699.19 },
  );
  assert.equal(computeTotals(items, { type: 'amount', value: 99.1 }).total, 2900);
  assert.equal(computeTotals([{ description: 'x', unitPrice: 0.1 }, { description: 'y', unitPrice: 0.2 }]).total, 0.3, 'sem erro de ponto flutuante');
  assert.throws(() => computeTotals([]), TypeError);
  assert.throws(() => computeTotals(items, { type: 'amount', value: 99999 }), RangeError);
  assert.throws(() => computeTotals([{ description: 'x', unitPrice: -1 }]), RangeError);
});

test('WinAnsi cobre o português e substitui o resto', () => {
  assert.deepEqual(toWinAnsi('ção'), [0xe7, 0xe3, 0x6f]);
  assert.deepEqual(toWinAnsi('€ – •'), [0x80, 32, 0x96, 32, 0x95]);
  assert.deepEqual(toWinAnsi('→'), [63]);
});

test('largura de texto e quebra de linha', () => {
  assert.equal(textWidth('a', 10), 5.56);
  assert.equal(textWidth('á', 10), textWidth('a', 10), 'acento usa a largura da letra base');
  assert.ok(textWidth('Mmm', 10, true) > textWidth('Mmm', 10));
  const lines = wrap('palavra '.repeat(30).trim(), 10, 200);
  assert.ok(lines.length > 1);
  assert.ok(lines.every((l) => textWidth(l, 10) <= 200));
  assert.deepEqual(wrap('linha 1\nlinha 2', 10, 500), ['linha 1', 'linha 2']);
});

test('PDF estruturalmente válido, com texto acentuado e escapado', () => {
  const doc = new PdfDocument({ title: 'Teste (1)' });
  doc.text('Ação (urgente) \\ fim', 50, 50);
  const text = assertValidPdf(doc.toBytes());
  assert.ok(text.includes('(A\\347\\343o \\(urgente\\) \\\\ fim) Tj'));
  assert.ok(text.includes('/Title (Teste \\(1\\))'));
});

test('proposta completa: uma página', () => {
  const { bytes, pages, totals } = buildProposal({ ...base, payment: 'À vista.', terms: ['Prazo de 10 dias.'] });
  const text = assertValidPdf(bytes);
  assert.equal(pages, 1);
  assert.equal(totals.total, 100);
  assert.ok(text.includes('/Count 1'));
  assert.ok(text.includes('(P\\341gina 1 de 1) Tj'));
});

test('muitos itens quebram página e repetem o cabeçalho da tabela', () => {
  const items = Array.from({ length: 40 }, (_, i) => ({
    description: `Item ${i + 1}`, details: 'Detalhe do item com uma descrição um pouco mais longa para ocupar duas linhas na tabela da proposta.', unitPrice: 10,
  }));
  const { bytes, pages, totals } = buildProposal({ ...base, items });
  const text = assertValidPdf(bytes);
  assert.ok(pages >= 3, `esperava 3+ páginas, veio ${pages}`);
  assert.equal(totals.total, 400);
  assert.equal(text.match(/\(DESCRI\\307\\303O\) Tj/g).length, pages, 'cabeçalho da tabela em cada página');
  assert.ok(text.includes(`(P\\341gina ${pages} de ${pages}) Tj`));
});

# proposta-pdf

[![CI](https://github.com/Ph20sr/proposta-pdf/actions/workflows/ci.yml/badge.svg)](https://github.com/Ph20sr/proposta-pdf/actions/workflows/ci.yml)
![zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)
![license](https://img.shields.io/badge/license-MIT-blue)

Gere **propostas comerciais em PDF** com a cara da sua empresa direto do seu sistema, sem Puppeteer, sem Chrome no servidor e **sem nenhuma dependência**. O PDF é escrito do zero, em menos de 400 linhas de JavaScript.

**[Ver PDF de exemplo →](examples/proposta-exemplo.pdf)**

- Cabeçalho na cor da sua marca, com dados da empresa e do cliente
- Tabela de itens com descrição e detalhes, que **quebra de página sozinha e repete o cabeçalho**
- Subtotal, **desconto** (percentual ou fixo) e total, calculados em centavos para não errar o arredondamento
- Condições de pagamento, escopo e prazos, validade, linhas de **assinatura** e "Página X de Y"
- Acentuação completa do português (`ç`, `ã`, `é`...) e símbolos como `€`, `–`, `•`
- PDF 1.4 com as fontes padrão (Helvetica), que abre em qualquer leitor e fica leve (~8 KB)

## Uso

```js
import { writeFile } from 'node:fs/promises';
import { buildProposal } from 'proposta-pdf';

const { bytes, totals, pages } = buildProposal({
  number: 'PROP-2026-014',
  date: '2026-10-06',
  validUntil: '2026-10-21',
  accent: '#1d4ed8',
  company: { name: 'Sua Empresa', document: 'CNPJ 12.ABC.345/01DE-35', email: 'contato@suaempresa.com.br', phone: '(11) 98765-4321' },
  client: { name: 'Clínica Sorriso Pleno Ltda.', contact: 'Dra. Carla Mendes', email: 'carla@sorrisopleno.com.br' },
  title: 'Site institucional com agendamento online',
  intro: 'Conforme conversamos, esta proposta cobre...',
  items: [
    { description: 'Design e desenvolvimento do site', details: 'Até 8 páginas, responsivo...', unitPrice: 6800 },
    { description: 'Hospedagem e manutenção mensal', quantity: 12, unitPrice: 249.9 },
  ],
  discount: { type: 'percent', value: 10 },
  payment: '40% na assinatura, 30% na aprovação do layout e 30% na publicação. Pix ou boleto.',
  terms: ['Prazo de entrega: 30 dias úteis.', 'Garantia de 90 dias.'],
});

await writeFile('proposta.pdf', bytes);
```

Num endpoint HTTP:

```js
res.writeHead(200, {
  'Content-Type': 'application/pdf',
  'Content-Disposition': `inline; filename="${number}.pdf"`,
});
res.end(bytes);
```

### PDF do seu jeito

O escritor de PDF por trás também está exportado, para outros documentos (recibos, ordens de serviço, relatórios):

```js
import { PdfDocument } from 'proposta-pdf';

const doc = new PdfDocument({ title: 'Recibo' });
doc.rect(0, 0, 595, 80, { fill: '#16a34a' });
doc.text('RECIBO', 48, 30, { size: 20, bold: true, color: '#ffffff' });
const y = doc.paragraph('Recebemos de Maria Souza a quantia de R$ 149,90 referente a...', 48, 120, 500);
doc.line(48, y + 40, 300, y + 40);
await writeFile('recibo.pdf', doc.toBytes());
```

Coordenadas em pontos (A4 = 595 × 842), com origem no canto superior esquerdo, como no HTML.

## Limitações

Usa as fontes padrão do PDF (Helvetica), que todo leitor tem, e por isso não embute fontes. Caracteres fora do português e do Latin-1 (emojis, alfabetos não latinos) aparecem como `?`.

## Desenvolvimento

```bash
npm test          # totais, codificação, quebra de linha e validação estrutural do PDF
npm run example   # gera examples/proposta-exemplo.pdf
```

## Licença

MIT

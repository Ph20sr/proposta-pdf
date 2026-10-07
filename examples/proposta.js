// Gera examples/proposta-exemplo.pdf com dados fictícios.
// Uso: node examples/proposta.js
import { writeFile } from 'node:fs/promises';
import { buildProposal } from '../src/index.js';

const { bytes, totals, pages } = buildProposal({
  number: 'PROP-2026-014',
  date: '2026-10-06',
  validUntil: '2026-10-21',
  accent: '#1d4ed8',
  company: {
    name: 'Studio Exemplo Digital',
    document: 'CNPJ 12.ABC.345/01DE-35',
    email: 'contato@studioexemplo.com.br',
    phone: '(11) 98765-4321',
    site: 'studioexemplo.com.br',
  },
  client: {
    name: 'Clínica Sorriso Pleno Ltda.',
    document: 'CNPJ 11.222.333/0001-81',
    contact: 'Dra. Carla Mendes',
    email: 'carla@sorrisopleno.com.br',
  },
  title: 'Site institucional com agendamento online',
  intro: 'Conforme conversamos, esta proposta cobre o novo site da clínica, com páginas de tratamentos, '
    + 'agendamento online integrado à agenda dos dentistas e lembretes automáticos por WhatsApp para reduzir faltas.',
  items: [
    { description: 'Design e desenvolvimento do site', details: 'Até 8 páginas, responsivo, otimizado para Google (SEO técnico) e com painel para editar textos e fotos.', quantity: 1, unitPrice: 6800 },
    { description: 'Agendamento online', details: 'Horários por dentista e por tipo de tratamento, confirmação automática e bloqueio de feriados.', quantity: 1, unitPrice: 3200 },
    { description: 'Lembretes por WhatsApp', details: 'Confirmação 24h antes pela API oficial do WhatsApp, com botões "Confirmar" e "Remarcar".', quantity: 1, unitPrice: 1500 },
    { description: 'Hospedagem e manutenção mensal', details: 'Servidor, backup diário, SSL, atualizações de segurança e até 2h de ajustes por mês.', quantity: 12, unitPrice: 249.9 },
    { description: 'Treinamento da equipe', details: 'Sessão online de 2 horas, com gravação.', quantity: 1, unitPrice: 400 },
  ],
  discount: { type: 'percent', value: 10 },
  payment: '40% na assinatura, 30% na entrega do layout aprovado e 30% na publicação. Pix ou boleto. '
    + 'A manutenção mensal começa a ser cobrada no mês seguinte à publicação.',
  terms: [
    'Prazo de entrega: 30 dias úteis após o envio dos textos e fotos pela clínica.',
    'Inclui duas rodadas de ajustes no layout antes da aprovação.',
    'Domínio e conta do WhatsApp Business ficam no nome da clínica.',
    'Garantia de 90 dias para correção de defeitos após a publicação.',
  ],
});

await writeFile(new URL('./proposta-exemplo.pdf', import.meta.url), bytes);
console.log(`proposta-exemplo.pdf: ${pages} página(s), total ${totals.total.toFixed(2)}`);

import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  parseAmount,
  parseDate,
  roundCurrency,
  processXLSXFile,
  detectDuplicates,
} from './xlsx-processor';

describe('parseAmount', () => {
  it('handles numeric cells directly', () => {
    expect(parseAmount(23.67)).toBe(23.67);
    expect(parseAmount(16.079999999999998)).toBe(16.08);
    expect(parseAmount(-50)).toBe(50);
    expect(parseAmount(0)).toBe(0);
  });

  it('handles Brazilian formatted strings (comma decimal, dot thousands)', () => {
    expect(parseAmount('1.234,56')).toBe(1234.56);
    expect(parseAmount('1.234.567,89')).toBe(1234567.89);
    expect(parseAmount('23,67')).toBe(23.67);
    expect(parseAmount('R$ 1.234,56')).toBe(1234.56);
  });

  it('handles international formatted strings (dot decimal)', () => {
    expect(parseAmount('1234.56')).toBe(1234.56);
    expect(parseAmount('23.67')).toBe(23.67);
    expect(parseAmount('0.1')).toBe(0.1);
    // This is the bug the previous implementation had: it used to strip
    // every '.' assuming it was a thousands separator, turning "16.08"
    // into 1608.
    expect(parseAmount('16.08')).toBe(16.08);
  });

  it('treats a single separator with exactly 3 trailing digits as a thousands separator', () => {
    expect(parseAmount('1.234')).toBe(1234);
    expect(parseAmount('1,234')).toBe(1234);
  });

  it('handles empty/invalid input gracefully', () => {
    expect(parseAmount('')).toBe(0);
    expect(parseAmount(null)).toBe(0);
    expect(parseAmount(undefined)).toBe(0);
    expect(parseAmount('abc')).toBe(0);
    expect(parseAmount(NaN)).toBe(0);
  });
});

describe('roundCurrency', () => {
  it('rounds floating point noise to cents', () => {
    expect(roundCurrency(16.079999999999998)).toBe(16.08);
    expect(roundCurrency(0.1 + 0.2)).toBe(0.3);
  });
});

describe('parseDate', () => {
  it('passes through Date objects', () => {
    const d = new Date(2026, 5, 10);
    expect(parseDate(d)).toBe(d);
  });

  it('converts Excel serial numbers correctly (no off-by-one)', () => {
    // Excel serial 46183 corresponds to 2026-06-10 (verified against the
    // real workbook via openpyxl, which already returns proper datetimes)
    const result = parseDate(46183);
    expect(result.getUTCFullYear()).toBe(2026);
    expect(result.getUTCMonth()).toBe(5); // June (0-indexed)
    expect(result.getUTCDate()).toBe(10);
  });

  it('parses DD/MM/YYYY strings', () => {
    const result = parseDate('10/06/2026');
    expect(result.getUTCFullYear()).toBe(2026);
    expect(result.getUTCMonth()).toBe(5);
    expect(result.getUTCDate()).toBe(10);
  });

  it('parses ISO strings', () => {
    const result = parseDate('2026-06-10');
    expect(result.getUTCFullYear()).toBe(2026);
    expect(result.getUTCMonth()).toBe(5);
    expect(result.getUTCDate()).toBe(10);
  });

  it('throws a clear error for unparseable dates', () => {
    expect(() => parseDate('not a date')).toThrow();
    expect(() => parseDate('')).toThrow();
    expect(() => parseDate(null)).toThrow();
  });
});

/**
 * Builds an in-memory XLSX buffer mirroring the structure produced by the
 * user's expense-tracking app: a title row, a header row, then data rows.
 */
function buildWorkbook(sheets: Record<string, any[][]>): Buffer {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  return XLSX.write(wb, { type: 'buffer', cellDates: true }) as Buffer;
}

const DESPESAS_HEADER = [
  'Data e hora', 'Categoria', 'Conta', 'Valor na moeda da conta', 'Moeda da conta',
  'Valor da transação na moeda da transação', 'Moeda de transação', 'Etiquetas', 'Comentário',
];
const RECEITA_HEADER = DESPESAS_HEADER;

describe('processXLSXFile', () => {
  it('imports normal expenses and income, computing totals', async () => {
    const buffer = buildWorkbook({
      Despesas: [
        ['Lista de despesas'],
        DESPESAS_HEADER,
        [new Date(2026, 5, 1), 'Café', 'Banco do Brasil', 23.67, 'BRL', '', '', '', 'Café da manhã'],
        [new Date(2026, 5, 2), 'Transporte', 'Banco do Brasil', 80, 'BRL', '', '', 'MOTO', 'Gasolina'],
      ],
      Receita: [
        ['Lista de renda'],
        RECEITA_HEADER,
        [new Date(2026, 5, 1), 'Salário', 'Banco do Brasil', 3000, 'BRL', '', '', '', 'Salário mensal'],
      ],
      'Transferências': [
        ['Lista de transferências'],
        ['Data e hora', 'Saída', 'Entrada', 'Valor na moeda de saída', 'Moeda de saída', 'Valor na moeda de entrada', 'Moeda de entrada', 'Comentário'],
      ],
    });

    const result = await processXLSXFile(buffer);

    expect(result.errors).toEqual([]);
    expect(result.transactions).toHaveLength(3);
    expect(result.summary.totalExpenses).toBe(103.67);
    expect(result.summary.totalIncome).toBe(3000);
    expect(result.summary.netBalance).toBeCloseTo(2896.33, 2);
    expect(result.summary.totalInternalTransfers).toBe(0);
    expect(result.expenseCategories.has('Café')).toBe(true);
    expect(result.incomeCategories.has('Salário')).toBe(true);
  });

  it('reclassifies internal-transfer categories as transfers, excluding them from totals', async () => {
    const buffer = buildWorkbook({
      Despesas: [
        ['Lista de despesas'],
        DESPESAS_HEADER,
        [new Date(2026, 5, 1), 'Café', 'Banco do Brasil', 10, 'BRL', '', '', '', ''],
        [new Date(2026, 5, 2), 'Transf. Entre Contas', 'Banco do Brasil', 300, 'BRL', '', '', '', 'Para Mercado Pago'],
      ],
      Receita: [
        ['Lista de renda'],
        RECEITA_HEADER,
        [new Date(2026, 5, 1), 'Salário', 'Banco do Brasil', 3000, 'BRL', '', '', '', ''],
        [new Date(2026, 5, 3), 'Transf. entre Contas', 'Banco do Brasil', 25, 'BRL', '', '', '', 'Do Mercado Pago'],
      ],
    });

    const result = await processXLSXFile(buffer);

    // 4 rows -> all kept, but the 2 transfer rows become type 'transfer'
    expect(result.transactions).toHaveLength(4);

    expect(result.summary.totalExpenses).toBe(10); // R$300 transfer excluded
    expect(result.summary.totalIncome).toBe(3000); // R$25 transfer excluded
    expect(result.summary.totalInternalTransfers).toBe(325);

    const transferTxns = result.transactions.filter(t => t.type === 'transfer');
    expect(transferTxns).toHaveLength(2);

    const outgoing = transferTxns.find(t => t.category === 'Transf. Entre Contas')!;
    expect(outgoing.sourceAccount).toBe('Banco do Brasil');
    expect(outgoing.targetAccount).toBe('Outras contas');

    const incoming = transferTxns.find(t => t.category === 'Transf. entre Contas')!;
    expect(incoming.sourceAccount).toBe('Outras contas');
    expect(incoming.targetAccount).toBe('Banco do Brasil');

    // Transfer categories should not pollute the category lists used for
    // expense/income breakdowns
    expect(result.expenseCategories.has('Transf. Entre Contas')).toBe(false);
    expect(result.incomeCategories.has('Transf. entre Contas')).toBe(false);
  });

  it('tracks third-party and investment sub-totals without removing them from totals', async () => {
    const buffer = buildWorkbook({
      Despesas: [
        ['Lista de despesas'],
        DESPESAS_HEADER,
        [new Date(2026, 5, 1), 'Desp. Temp. De Terceiros', 'Banco do Brasil', 20, 'BRL', '', '', '', 'Almoço do Victor'],
        [new Date(2026, 5, 2), 'Investimentos', 'Banco do Brasil', 150, 'BRL', '', '', 'BOLÃO', ''],
        [new Date(2026, 5, 3), 'Café', 'Banco do Brasil', 5, 'BRL', '', '', '', ''],
      ],
      Receita: [
        ['Lista de renda'],
        RECEITA_HEADER,
        [new Date(2026, 5, 4), 'Reembolso - Divisão de Conta', 'Banco do Brasil', 20, 'BRL', '', '', '', ''],
      ],
    });

    const result = await processXLSXFile(buffer);

    expect(result.summary.totalExpenses).toBe(175);
    expect(result.summary.totalThirdPartyExpense).toBe(20);
    expect(result.summary.totalInvestments).toBe(150);
    expect(result.summary.totalIncome).toBe(20);
    expect(result.summary.totalThirdPartyReimbursement).toBe(20);
  });

  it('handles text-formatted amounts with different decimal separators without corrupting values', async () => {
    const buffer = buildWorkbook({
      Despesas: [
        ['Lista de despesas'],
        DESPESAS_HEADER,
        // Stored as text strings instead of numbers
        [new Date(2026, 5, 1), 'Café', 'Banco do Brasil', '16.08', 'BRL', '', '', '', 'Texto formato US'],
        [new Date(2026, 5, 2), 'Café', 'Banco do Brasil', '16,08', 'BRL', '', '', '', 'Texto formato BR'],
        [new Date(2026, 5, 3), 'Casa', 'Banco do Brasil', 'R$ 1.234,56', 'BRL', '', '', '', 'Com símbolo de moeda'],
      ],
    });

    const result = await processXLSXFile(buffer);

    expect(result.errors).toEqual([]);
    const amounts = result.transactions.map(t => t.amount);
    expect(amounts).toContain('16.08');
    expect(amounts).toContain('1234.56');
    // Should NOT have been corrupted into 1608 (the old bug)
    expect(amounts).not.toContain('1608.00');
  });

  it('reports a clear error for rows with unparseable dates and skips them', async () => {
    const buffer = buildWorkbook({
      Despesas: [
        ['Lista de despesas'],
        DESPESAS_HEADER,
        ['data inválida', 'Café', 'Banco do Brasil', 10, 'BRL', '', '', '', ''],
        [new Date(2026, 5, 1), 'Café', 'Banco do Brasil', 5, 'BRL', '', '', '', ''],
      ],
    });

    const result = await processXLSXFile(buffer);

    expect(result.transactions).toHaveLength(1);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0]).toContain('Despesas linha 3');
  });

  it('warns and skips rows with zero/unrecognized amounts instead of treating them as errors', async () => {
    const buffer = buildWorkbook({
      Despesas: [
        ['Lista de despesas'],
        DESPESAS_HEADER,
        [new Date(2026, 5, 1), 'Café', 'Banco do Brasil', 0, 'BRL', '', '', '', 'Valor zero'],
        [new Date(2026, 5, 2), 'Café', 'Banco do Brasil', 5, 'BRL', '', '', '', ''],
      ],
    });

    const result = await processXLSXFile(buffer);

    expect(result.transactions).toHaveLength(1);
    expect(result.errors).toEqual([]);
    expect(result.warnings.some(w => w.includes('valor zero'))).toBe(true);
  });

  it('skips empty rows silently', async () => {
    const buffer = buildWorkbook({
      Despesas: [
        ['Lista de despesas'],
        DESPESAS_HEADER,
        [new Date(2026, 5, 1), 'Café', 'Banco do Brasil', 5, 'BRL', '', '', '', ''],
        [],
        [new Date(2026, 5, 2), 'Café', 'Banco do Brasil', 6, 'BRL', '', '', '', ''],
      ],
    });

    const result = await processXLSXFile(buffer);

    expect(result.transactions).toHaveLength(2);
    expect(result.errors).toEqual([]);
    // The only expected warning is about the missing "Receita" sheet in
    // this fixture, not about the blank row itself.
    expect(result.warnings.every(w => w.includes('Receita'))).toBe(true);
  });
});

describe('detectDuplicates', () => {
  it('detects a duplicate even when the existing amount is a DECIMAL(12,2) string like "100.00"', () => {
    const newTxns = [
      {
        date: new Date(2026, 5, 1),
        type: 'expense' as const,
        category: 'Café',
        account: 'Banco do Brasil',
        amount: '100.00',
        currency: 'BRL',
        description: 'Compra',
      },
    ];

    const existing = [
      {
        date: new Date(2026, 5, 1),
        type: 'expense',
        category: 'Café',
        account: 'Banco do Brasil',
        amount: '100.00', // as returned by MySQL for DECIMAL(12,2)
        description: 'Compra',
      },
    ];

    const dupes = detectDuplicates(newTxns as any, existing);
    expect(dupes.has(0)).toBe(true);
  });

  it('does not flag distinct transactions as duplicates', () => {
    const newTxns = [
      {
        date: new Date(2026, 5, 1),
        type: 'expense' as const,
        category: 'Café',
        account: 'Banco do Brasil',
        amount: '10.00',
        currency: 'BRL',
        description: 'A',
      },
    ];
    const existing = [
      {
        date: new Date(2026, 5, 1),
        type: 'expense',
        category: 'Café',
        account: 'Banco do Brasil',
        amount: '10.00',
        description: 'B',
      },
    ];

    const dupes = detectDuplicates(newTxns as any, existing);
    expect(dupes.size).toBe(0);
  });
});

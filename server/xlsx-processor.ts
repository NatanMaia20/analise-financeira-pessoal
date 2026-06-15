import * as XLSX from 'xlsx';
import { InsertTransaction } from '../drizzle/schema';
import { getCategoryFlow, CategoryFlow } from '../shared/category-rules';

export interface XLSXProcessResult {
  transactions: InsertTransaction[];
  /** Categories used on "Despesas" rows (excluding internal transfers) */
  expenseCategories: Set<string>;
  /** Categories used on "Receita" rows (excluding internal transfers) */
  incomeCategories: Set<string>;
  errors: string[];
  warnings: string[];
  summary: {
    /** Real expenses (excludes internal transfers) */
    totalExpenses: number;
    /** Real income (excludes internal transfers) */
    totalIncome: number;
    /** Net balance = totalIncome - totalExpenses */
    netBalance: number;
    /** Transfers between the user's own accounts (dedicated sheet + reclassified categories) */
    totalInternalTransfers: number;
    /** Money advanced on behalf of others (subset of totalExpenses) */
    totalThirdPartyExpense: number;
    /** Money reimbursed by others (subset of totalIncome) */
    totalThirdPartyReimbursement: number;
    /** Amount allocated to investments/savings (subset of totalExpenses) */
    totalInvestments: number;
    dateRange: { start: Date; end: Date } | null;
    rowsProcessed: number;
    rowsSkipped: number;
  };
}

const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30); // Day 0 in Excel's 1900 date system

/**
 * Parse date from various formats (Date object, Excel serial number,
 * ISO string, DD/MM/YYYY, DD-MM-YY, etc.)
 */
export function parseDate(dateStr: any): Date {
  if (dateStr === null || dateStr === undefined || dateStr === '') {
    throw new Error(`Data vazia ou ausente`);
  }

  // Handle Date objects directly (this is the common case when XLSX.read
  // is called with { cellDates: true } and the cell is formatted as a date)
  if (dateStr instanceof Date) {
    if (isNaN(dateStr.getTime())) {
      throw new Error(`Data inválida: ${dateStr}`);
    }
    return dateStr;
  }

  // Handle numeric dates (Excel serial numbers, days since 1899-12-30)
  if (typeof dateStr === 'number') {
    if (!isFinite(dateStr)) {
      throw new Error(`Data numérica inválida: ${dateStr}`);
    }
    return new Date(EXCEL_EPOCH_UTC + dateStr * 86400000);
  }

  const str = String(dateStr).trim();
  if (!str) {
    throw new Error(`Data vazia ou ausente`);
  }

  // Pure numeric string -> treat as Excel serial number (defensive fallback
  // for cells that were exported as text instead of a real date)
  if (/^\d{1,6}(\.\d+)?$/.test(str)) {
    const serial = parseFloat(str);
    return new Date(EXCEL_EPOCH_UTC + serial * 86400000);
  }

  // Handle ISO date format (YYYY-MM-DD, optionally with a time component)
  if (/^\d{4}-\d{1,2}-\d{1,2}/.test(str)) {
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  // Handle ISO format with time but a non-standard date portion
  if (str.includes('T') || (str.includes('-') && str.includes(':'))) {
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  // Handle DD-MM-YYYY or DD-MM-YY format (day-first, two-digit day)
  const dashParts = str.split('-');
  if (dashParts.length === 3 && dashParts[0].length <= 2) {
    const day = parseInt(dashParts[0], 10);
    const month = parseInt(dashParts[1], 10);
    let year = parseInt(dashParts[2], 10);

    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      if (year < 100) year += 2000;
      const date = new Date(Date.UTC(year, month - 1, day));
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
  }

  // Handle DD/MM/YYYY (optionally followed by a time component) format
  const slashParts = str.split('/');
  if (slashParts.length === 3) {
    const day = parseInt(slashParts[0], 10);
    const month = parseInt(slashParts[1], 10);
    let year = parseInt(slashParts[2], 10);

    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      if (year < 100) year += 2000;
      const date = new Date(Date.UTC(year, month - 1, day));
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
  }

  // Last resort: let the JS Date constructor try
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  throw new Error(`Não foi possível interpretar a data: "${dateStr}"`);
}

/** Rounds to 2 decimal places, avoiding floating point artifacts like 16.079999999999998 */
export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Parse a monetary amount, handling both numeric cells and text cells in
 * Brazilian (1.234,56) or international (1,234.56 / 1234.56) formats.
 * Always returns a non-negative, rounded-to-cents number.
 */
export function parseAmount(raw: any): number {
  if (typeof raw === 'number') {
    if (!isFinite(raw)) return 0;
    return roundCurrency(Math.abs(raw));
  }

  if (raw === null || raw === undefined) return 0;

  let str = String(raw).trim();
  if (!str) return 0;

  // Strip currency symbols, spaces and anything that isn't a digit, a
  // separator (. or ,) or a minus sign
  str = str.replace(/[^0-9.,-]/g, '');
  if (!str) return 0;

  str = str.replace(/-/g, ''); // sign doesn't matter, amounts are stored unsigned

  const lastComma = str.lastIndexOf(',');
  const lastDot = str.lastIndexOf('.');

  let normalized: string;

  if (lastComma !== -1 && lastDot !== -1) {
    // Both separators present: whichever comes LAST is the decimal separator
    if (lastComma > lastDot) {
      normalized = str.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = str.replace(/,/g, '');
    }
  } else if (lastComma !== -1) {
    const decimals = str.length - lastComma - 1;
    const commaCount = str.split(',').length - 1;
    if (commaCount > 1 || decimals === 3) {
      // Multiple commas, or exactly 3 digits after a single comma:
      // these are thousands separators (e.g. "1,234" -> 1234)
      normalized = str.replace(/,/g, '');
    } else {
      normalized = str.replace(',', '.');
    }
  } else if (lastDot !== -1) {
    const decimals = str.length - lastDot - 1;
    const dotCount = str.split('.').length - 1;
    if (dotCount > 1 || decimals === 3) {
      normalized = str.replace(/\./g, '');
    } else {
      normalized = str; // '.' is already the decimal separator
    }
  } else {
    normalized = str;
  }

  const amount = parseFloat(normalized);
  if (isNaN(amount)) return 0;
  return roundCurrency(Math.abs(amount));
}

interface SheetRowResult {
  transaction: InsertTransaction | null;
  flow: CategoryFlow;
  amount: number;
  category: string;
  error?: string;
  warning?: string;
}

/**
 * Parses a single "Despesas" or "Receita" row.
 *
 * Column layout (both sheets share the same shape):
 *  0: Data e hora
 *  1: Categoria
 *  2: Conta
 *  3: Valor na moeda da conta
 *  4: Moeda da conta
 *  5: Valor da transação na moeda da transação (optional)
 *  6: Moeda de transação (optional)
 *  7: Etiquetas
 *  8: Comentário
 */
function parseEntryRow(
  row: any[],
  rowNumber: number,
  sheetName: string,
  kind: 'expense' | 'income'
): SheetRowResult {
  const category = String(row[1] ?? '').trim();
  const account = String(row[2] ?? '').trim() || 'Conta não informada';
  const currency = String(row[4] ?? '').trim() || 'BRL';
  const txCurrency = String(row[6] ?? '').trim();
  const tags = String(row[7] ?? '')
    .trim()
    .split(',')
    .map(t => t.trim())
    .filter(t => t.length > 0);
  let description = String(row[8] ?? '').trim();

  if (!category) {
    return {
      transaction: null,
      flow: 'personal',
      amount: 0,
      category,
      error: `${sheetName} linha ${rowNumber}: categoria em branco — linha ignorada`,
    };
  }

  let date: Date;
  try {
    date = parseDate(row[0]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      transaction: null,
      flow: 'personal',
      amount: 0,
      category,
      error: `${sheetName} linha ${rowNumber} (${category}): ${msg}`,
    };
  }

  const amount = parseAmount(row[3]);

  if (amount === 0) {
    return {
      transaction: null,
      flow: 'personal',
      amount: 0,
      category,
      warning: `${sheetName} linha ${rowNumber} (${category}): valor zero ou não reconhecido ("${row[3]}") — linha ignorada`,
    };
  }

  // If the entry was made in a foreign currency, keep that information
  // visible since the schema only stores the account-currency amount.
  if (txCurrency && txCurrency.toUpperCase() !== currency.toUpperCase() && row[5] !== undefined && row[5] !== null && row[5] !== '') {
    const txAmount = parseAmount(row[5]);
    if (txAmount > 0) {
      const note = `Valor original: ${txAmount.toFixed(2)} ${txCurrency}`;
      description = description ? `${description} (${note})` : note;
    }
  }

  const flow = getCategoryFlow(category);

  if (flow === 'internal_transfer') {
    // Internal transfer between the user's own accounts. We keep the
    // record (so it shows up in "Movimentações internas") but mark it as
    // type 'transfer' so it is excluded from income/expense totals and
    // category breakdowns.
    const transaction: InsertTransaction = {
      date,
      type: 'transfer',
      category,
      account,
      amount: amount.toFixed(2),
      currency,
      tags,
      description: description || null,
      sourceAccount: kind === 'expense' ? account : 'Outras contas',
      targetAccount: kind === 'expense' ? 'Outras contas' : account,
    };
    return { transaction, flow, amount, category };
  }

  const transaction: InsertTransaction = {
    date,
    type: kind,
    category,
    account,
    amount: amount.toFixed(2),
    currency,
    tags,
    description: description || null,
  };

  return { transaction, flow, amount, category };
}

function extendDateRange(
  current: { start: Date; end: Date } | null,
  date: Date
): { start: Date; end: Date } {
  if (!current) return { start: date, end: date };
  return {
    start: date < current.start ? date : current.start,
    end: date > current.end ? date : current.end,
  };
}

/**
 * Process XLSX file and extract transactions.
 */
export async function processXLSXFile(buffer: Buffer): Promise<XLSXProcessResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const transactions: InsertTransaction[] = [];
  const expenseCategories = new Set<string>();
  const incomeCategories = new Set<string>();

  let totalExpenses = 0;
  let totalIncome = 0;
  let totalInternalTransfers = 0;
  let totalThirdPartyExpense = 0;
  let totalThirdPartyReimbursement = 0;
  let totalInvestments = 0;
  let dateRange: { start: Date; end: Date } | null = null;
  let rowsProcessed = 0;
  let rowsSkipped = 0;

  try {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    console.log('[XLSX] Sheets found:', workbook.SheetNames);

    const sheetConfigs: { sheetName: string; kind: 'expense' | 'income' }[] = [
      { sheetName: 'Despesas', kind: 'expense' },
      { sheetName: 'Receita', kind: 'income' },
    ];

    for (const { sheetName, kind } of sheetConfigs) {
      if (!workbook.SheetNames.includes(sheetName)) {
        warnings.push(`Aba "${sheetName}" não encontrada no arquivo — nenhuma linha foi importada dessa aba.`);
        continue;
      }

      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      console.log(`[XLSX] ${sheetName} sheet rows:`, data.length);

      // Row 0 = title, Row 1 = header, data starts at row index 2
      for (let i = 2; i < data.length; i++) {
        const row = data[i] ?? [];
        const isEmptyRow = row.every(cell => cell === null || cell === undefined || cell === '');
        if (isEmptyRow) continue;

        const result = parseEntryRow(row, i + 1, sheetName, kind);

        if (result.error) {
          errors.push(result.error);
          rowsSkipped++;
          continue;
        }
        if (result.warning) {
          warnings.push(result.warning);
          rowsSkipped++;
          continue;
        }
        if (!result.transaction) {
          rowsSkipped++;
          continue;
        }

        transactions.push(result.transaction);
        rowsProcessed++;
        dateRange = extendDateRange(dateRange, result.transaction.date as Date);

        if (result.flow === 'internal_transfer') {
          totalInternalTransfers += result.amount;
          continue;
        }

        if (kind === 'expense') {
          totalExpenses += result.amount;
          expenseCategories.add(result.category);
          if (result.flow === 'third_party') totalThirdPartyExpense += result.amount;
          if (result.flow === 'investment') totalInvestments += result.amount;
        } else {
          totalIncome += result.amount;
          incomeCategories.add(result.category);
          if (result.flow === 'third_party') totalThirdPartyReimbursement += result.amount;
        }
      }

      console.log(`[XLSX] ${sheetName} processed so far: ${transactions.length} transactions, ${errors.length} errors, ${warnings.length} warnings`);
    }

    // Process dedicated "Transferências" sheet, if present and populated.
    if (workbook.SheetNames.includes('Transferências')) {
      const worksheet = workbook.Sheets['Transferências'];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      console.log('[XLSX] Transferências sheet rows:', data.length);

      for (let i = 2; i < data.length; i++) {
        const row = data[i] ?? [];
        const isEmptyRow = row.every(cell => cell === null || cell === undefined || cell === '');
        if (isEmptyRow) continue;

        try {
          const date = parseDate(row[0]);
          const sourceAccount = String(row[1] ?? '').trim();
          const targetAccount = String(row[2] ?? '').trim();
          const amount = parseAmount(row[3]);
          const currency = String(row[4] ?? '').trim() || 'BRL';
          const description = String(row[7] ?? '').trim();

          if (!sourceAccount || !targetAccount) {
            warnings.push(`Transferências linha ${i + 1}: conta de origem/destino em branco — linha ignorada`);
            rowsSkipped++;
            continue;
          }
          if (amount === 0) {
            warnings.push(`Transferências linha ${i + 1}: valor zero ou não reconhecido — linha ignorada`);
            rowsSkipped++;
            continue;
          }

          totalInternalTransfers += amount;
          dateRange = extendDateRange(dateRange, date);

          transactions.push({
            date,
            type: 'transfer',
            category: 'Transferência entre contas',
            account: sourceAccount,
            amount: amount.toFixed(2),
            currency,
            sourceAccount,
            targetAccount,
            description: description || null,
          });
          rowsProcessed++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`Transferências linha ${i + 1}: ${msg}`);
          rowsSkipped++;
        }
      }
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[XLSX] File processing error:', errorMsg, err);
    errors.push(`Erro ao processar o arquivo: ${errorMsg}`);
  }

  console.log('[XLSX] Final result:', {
    transactionCount: transactions.length,
    errorCount: errors.length,
    warningCount: warnings.length,
  });

  return {
    transactions,
    expenseCategories,
    incomeCategories,
    errors,
    warnings,
    summary: {
      totalExpenses: roundCurrency(totalExpenses),
      totalIncome: roundCurrency(totalIncome),
      netBalance: roundCurrency(totalIncome - totalExpenses),
      totalInternalTransfers: roundCurrency(totalInternalTransfers),
      totalThirdPartyExpense: roundCurrency(totalThirdPartyExpense),
      totalThirdPartyReimbursement: roundCurrency(totalThirdPartyReimbursement),
      totalInvestments: roundCurrency(totalInvestments),
      dateRange,
      rowsProcessed,
      rowsSkipped,
    },
  };
}

/**
 * Detect duplicate transactions based on date, type, category, amount,
 * account and description. Amounts are compared using a fixed 2-decimal
 * string representation, matching how MySQL returns DECIMAL(12,2) columns
 * (e.g. "100.00"), to avoid false negatives like "100" !== "100.00".
 */
export function detectDuplicates(
  newTransactions: InsertTransaction[],
  existingTransactions: any[]
): Set<number> {
  const duplicateIndices = new Set<number>();

  const normalizeAmount = (amount: unknown): string => {
    const n = typeof amount === 'number' ? amount : parseFloat(String(amount));
    return isNaN(n) ? String(amount) : n.toFixed(2);
  };

  const existingKeys = new Set(
    existingTransactions.map(txn =>
      [
        new Date(txn.date).getTime(),
        txn.type,
        txn.category,
        txn.account,
        normalizeAmount(txn.amount),
        txn.description ?? '',
      ].join('|')
    )
  );

  for (let i = 0; i < newTransactions.length; i++) {
    const newTxn = newTransactions[i];
    const key = [
      (newTxn.date as Date).getTime(),
      newTxn.type,
      newTxn.category,
      newTxn.account,
      normalizeAmount(newTxn.amount),
      newTxn.description ?? '',
    ].join('|');

    if (existingKeys.has(key)) {
      duplicateIndices.add(i);
    }
  }

  return duplicateIndices;
}

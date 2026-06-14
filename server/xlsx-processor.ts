import * as XLSX from 'xlsx';
import { InsertTransaction, InsertCategory } from '../drizzle/schema';

export interface XLSXProcessResult {
  transactions: InsertTransaction[];
  categories: Set<string>;
  errors: string[];
  summary: {
    totalExpenses: number;
    totalIncome: number;
    totalTransfers: number;
    dateRange: { start: Date; end: Date } | null;
  };
}

/**
 * Parse date from various formats (ISO, DD-MM-YY, DD/MM/YYYY, etc.)
 */
function parseDate(dateStr: any): Date {
  if (!dateStr) {
    throw new Error(`Invalid date string: ${dateStr}`);
  }

  // Handle numeric dates (Excel serial numbers)
  if (typeof dateStr === 'number') {
    // Excel date serial number (days since 1900-01-01)
    const excelEpoch = new Date(1900, 0, 1);
    const date = new Date(excelEpoch.getTime() + (dateStr - 1) * 86400000);
    return date;
  }

  const str = String(dateStr).trim();

  // Handle ISO format with time (2026-06-10 00:00:00 or 2026-06-10T00:00:00)
  if (str.includes('T') || (str.includes('-') && str.includes(':'))) {
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  // Handle DD-MM-YY format
  const dashParts = str.split('-');
  if (dashParts.length === 3 && dashParts[0].length === 2) {
    try {
      const day = parseInt(dashParts[0], 10);
      const month = parseInt(dashParts[1], 10);
      let year = parseInt(dashParts[2], 10);

      // Convert 2-digit year to 4-digit (00-99 -> 2000-2099)
      if (year < 100) {
        year += 2000;
      }

      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        const date = new Date(Date.UTC(year, month - 1, day));
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    } catch (e) {
      // Continue to next format
    }
  }

  // Handle DD/MM/YYYY format
  const slashParts = str.split('/');
  if (slashParts.length === 3) {
    try {
      const day = parseInt(slashParts[0], 10);
      const month = parseInt(slashParts[1], 10);
      let year = parseInt(slashParts[2], 10);

      // Convert 2-digit year to 4-digit
      if (year < 100) {
        year += 2000;
      }

      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        const date = new Date(Date.UTC(year, month - 1, day));
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    } catch (e) {
      // Continue to next format
    }
  }

  // Try parsing as ISO string
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  throw new Error(`Could not parse date: ${dateStr}`);
}

/**
 * Parse amount from string, handling various formats
 */
function parseAmount(amountStr: any): number {
  if (typeof amountStr === 'number') {
    return Math.abs(amountStr);
  }

  if (!amountStr) {
    return 0;
  }

  const str = String(amountStr).trim();
  if (!str) return 0;

  // Remove common currency symbols and whitespace
  let cleaned = str
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '') // Remove thousand separators (assuming . is thousands)
    .replace(',', '.'); // Replace comma with dot for decimal

  const amount = parseFloat(cleaned);
  return isNaN(amount) ? 0 : Math.abs(amount);
}

/**
 * Process XLSX file and extract transactions
 */
export async function processXLSXFile(buffer: Buffer): Promise<XLSXProcessResult> {
  const errors: string[] = [];
  const transactions: InsertTransaction[] = [];
  const categories = new Set<string>();
  let totalExpenses = 0;
  let totalIncome = 0;
  let totalTransfers = 0;
  let dateRange: { start: Date; end: Date } | null = null;

  try {
    // Read workbook
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    // Process Despesas (Expenses)
    if (workbook.SheetNames.includes('Despesas')) {
      const worksheet = workbook.Sheets['Despesas'];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      // Skip title row (row 0) and header row (row 1), start from row 2
      for (let i = 2; i < data.length; i++) {
        const row = data[i] as any[];
        if (!row[0]) continue; // Skip empty rows

        try {
          const dateStr = String(row[0]).trim();
          const date = parseDate(dateStr);
          const category = String(row[1] || '').trim();
          const account = String(row[2] || '').trim();
          const amount = parseAmount(row[3]);
          const currency = String(row[4] || 'BRL').trim();
          const tags = String(row[7] || '').trim().split(',').filter(t => t.length > 0);
          const description = String(row[8] || '').trim();

          if (!category || amount <= 0) {
            errors.push(`Row ${i + 1}: Missing category or invalid amount`);
            continue;
          }

          categories.add(category);
          totalExpenses += amount;

          // Update date range
          if (!dateRange) {
            dateRange = { start: date, end: date };
          } else {
            if (date < dateRange.start) dateRange.start = date;
            if (date > dateRange.end) dateRange.end = date;
          }

          transactions.push({
            date,
            type: 'expense',
            category,
            account,
            amount: amount.toString(),
            currency,
            tags,
            description: description || null,
          });
        } catch (err) {
          errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }
    }

    // Process Receita (Income)
    if (workbook.SheetNames.includes('Receita')) {
      const worksheet = workbook.Sheets['Receita'];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      // Skip title row (row 0) and header row (row 1), start from row 2
      for (let i = 2; i < data.length; i++) {
        const row = data[i] as any[];
        if (!row[0]) continue; // Skip empty rows

        try {
          const dateStr = String(row[0]).trim();
          const date = parseDate(dateStr);
          const category = String(row[1] || '').trim();
          const account = String(row[2] || '').trim();
          const amount = parseAmount(row[3]);
          const currency = String(row[4] || 'BRL').trim();
          const tags = String(row[7] || '').trim().split(',').filter(t => t.length > 0);
          const description = String(row[8] || '').trim();

          if (!category || amount <= 0) {
            errors.push(`Row ${i + 1}: Missing category or invalid amount`);
            continue;
          }

          categories.add(category);
          totalIncome += amount;

          // Update date range
          if (!dateRange) {
            dateRange = { start: date, end: date };
          } else {
            if (date < dateRange.start) dateRange.start = date;
            if (date > dateRange.end) dateRange.end = date;
          }

          transactions.push({
            date,
            type: 'income',
            category,
            account,
            amount: amount.toString(),
            currency,
            tags,
            description: description || null,
          });
        } catch (err) {
          errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }
    }

    // Process Transferências (Transfers)
    if (workbook.SheetNames.includes('Transferências')) {
      const worksheet = workbook.Sheets['Transferências'];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      // Skip title row (row 0) and header row (row 1), start from row 2
      for (let i = 2; i < data.length; i++) {
        const row = data[i] as any[];
        if (!row[0]) continue; // Skip empty rows

        try {
          const dateStr = String(row[0]).trim();
          const date = parseDate(dateStr);
          const sourceAccount = String(row[1] || '').trim();
          const targetAccount = String(row[2] || '').trim();
          const amount = parseAmount(row[3]);
          const currency = String(row[4] || 'BRL').trim();
          const description = String(row[7] || '').trim();

          if (!sourceAccount || !targetAccount || amount <= 0) {
            errors.push(`Row ${i + 1}: Missing transfer details or invalid amount`);
            continue;
          }

          totalTransfers += amount;

          // Update date range
          if (!dateRange) {
            dateRange = { start: date, end: date };
          } else {
            if (date < dateRange.start) dateRange.start = date;
            if (date > dateRange.end) dateRange.end = date;
          }

          transactions.push({
            date,
            type: 'transfer',
            category: 'Transfer',
            account: sourceAccount,
            amount: amount.toString(),
            currency,
            sourceAccount,
            targetAccount,
            description: description || null,
          });
        } catch (err) {
          errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }
    }
  } catch (err) {
    errors.push(`File processing error: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }

  return {
    transactions,
    categories,
    errors,
    summary: {
      totalExpenses,
      totalIncome,
      totalTransfers,
      dateRange,
    },
  };
}

/**
 * Detect duplicate transactions based on date, category, amount, and description
 */
export function detectDuplicates(
  newTransactions: InsertTransaction[],
  existingTransactions: any[]
): Set<number> {
  const duplicateIndices = new Set<number>();

  for (let i = 0; i < newTransactions.length; i++) {
    const newTxn = newTransactions[i];
    
    for (const existingTxn of existingTransactions) {
      // Check if transactions match on key fields
      if (
        newTxn.date.getTime() === existingTxn.date.getTime() &&
        newTxn.type === existingTxn.type &&
        newTxn.category === existingTxn.category &&
        newTxn.amount === existingTxn.amount &&
        newTxn.description === existingTxn.description
      ) {
        duplicateIndices.add(i);
        break;
      }
    }
  }

  return duplicateIndices;
}

import { Transaction } from '../drizzle/schema';

export interface FinancialMetrics {
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  averageMonthlyIncome: number;
  averageMonthlyExpense: number;
  savingsRate: number;
}

export interface CategoryAnalysis {
  category: string;
  total: number;
  percentage: number;
  count: number;
  average: number;
}

export interface MonthlyData {
  year: number;
  month: number;
  income: number;
  expense: number;
  balance: number;
}

/**
 * Calculate financial metrics for a period
 */
export function calculateMetrics(transactions: Transaction[]): FinancialMetrics {
  let totalIncome = 0;
  let totalExpense = 0;

  for (const txn of transactions) {
    const amount = parseFloat(txn.amount as any);
    if (txn.type === 'income') {
      totalIncome += amount;
    } else if (txn.type === 'expense') {
      totalExpense += amount;
    }
  }

  const netBalance = totalIncome - totalExpense;
  const months = getUniqueMonths(transactions);
  const monthCount = months.size || 1;

  return {
    totalIncome,
    totalExpense,
    netBalance,
    averageMonthlyIncome: totalIncome / monthCount,
    averageMonthlyExpense: totalExpense / monthCount,
    savingsRate: totalIncome > 0 ? (netBalance / totalIncome) * 100 : 0,
  };
}

/**
 * Analyze expenses by category
 */
export function analyzeByCategory(transactions: Transaction[]): CategoryAnalysis[] {
  const categoryMap = new Map<string, { total: number; count: number }>();
  let totalExpense = 0;

  for (const txn of transactions) {
    if (txn.type === 'expense') {
      const amount = parseFloat(txn.amount as any);
      totalExpense += amount;

      const existing = categoryMap.get(txn.category) || { total: 0, count: 0 };
      categoryMap.set(txn.category, {
        total: existing.total + amount,
        count: existing.count + 1,
      });
    }
  }

  const analysis: CategoryAnalysis[] = [];
  for (const [category, data] of Array.from(categoryMap)) {
    analysis.push({
      category,
      total: data.total,
      percentage: totalExpense > 0 ? (data.total / totalExpense) * 100 : 0,
      count: data.count,
      average: data.total / data.count,
    });
  }

  return analysis.sort((a, b) => b.total - a.total);
}

/**
 * Group transactions by month
 */
export function groupByMonth(transactions: Transaction[]): Map<string, Transaction[]> {
  const grouped = new Map<string, Transaction[]>();

  for (const txn of transactions) {
    const date = new Date(txn.date);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(txn);
  }

  return grouped;
}

/**
 * Calculate monthly summary data
 */
export function calculateMonthlySummary(transactions: Transaction[]): MonthlyData[] {
  const grouped = groupByMonth(transactions);
  const summary: MonthlyData[] = [];

  for (const [key, txns] of Array.from(grouped)) {
    const [yearStr, monthStr] = key.split('-');
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);

    let income = 0;
    let expense = 0;

    for (const txn of txns) {
      const amount = parseFloat(txn.amount as any);
      if (txn.type === 'income') {
        income += amount;
      } else if (txn.type === 'expense') {
        expense += amount;
      }
    }

    summary.push({
      year,
      month,
      income,
      expense,
      balance: income - expense,
    });
  }

  return summary.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });
}

/**
 * Get unique months from transactions
 */
export function getUniqueMonths(transactions: Transaction[]): Set<string> {
  const months = new Set<string>();

  for (const txn of transactions) {
    const date = new Date(txn.date);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    months.add(key);
  }

  return months;
}

/**
 * Calculate category growth (comparison between periods)
 */
export function calculateCategoryGrowth(
  currentPeriod: Transaction[],
  previousPeriod: Transaction[]
): Map<string, { current: number; previous: number; growth: number; growthPercent: number }> {
  const currentAnalysis = analyzeByCategory(currentPeriod);
  const previousAnalysis = analyzeByCategory(previousPeriod);

  const previousMap = new Map(previousAnalysis.map(a => [a.category, a.total]));
  const growthMap = new Map<string, any>();

  for (const current of currentAnalysis) {
    const previous = previousMap.get(current.category) || 0;
    const growth = current.total - previous;
    const growthPercent = previous > 0 ? (growth / previous) * 100 : 100;

    growthMap.set(current.category, {
      current: current.total,
      previous,
      growth,
      growthPercent,
    });
  }

  return growthMap;
}

/**
 * Identify anomalies in spending
 */
export interface SpendingAnomaly {
  category: string;
  date: Date;
  amount: number;
  deviation: number;
  isAnomaly: boolean;
}

export function detectSpendingAnomalies(
  transactions: Transaction[],
  threshold: number = 2 // Standard deviations
): SpendingAnomaly[] {
  const categoryStats = new Map<string, { amounts: number[]; mean: number; stdDev: number }>();

  // Calculate statistics for each category
  const categoryTransactions = new Map<string, Transaction[]>();
  for (const txn of transactions) {
    if (txn.type === 'expense') {
      if (!categoryTransactions.has(txn.category)) {
        categoryTransactions.set(txn.category, []);
      }
      categoryTransactions.get(txn.category)!.push(txn);
    }
  }

  for (const [category, txns] of Array.from(categoryTransactions)) {
    const amounts = txns.map((t: Transaction) => parseFloat(t.amount as any));
    const mean = amounts.reduce((a: number, b: number) => a + b, 0) / amounts.length;
    const variance = amounts.reduce((a: number, b: number) => a + Math.pow(b - mean, 2), 0) / amounts.length;
    const stdDev = Math.sqrt(variance);

    categoryStats.set(category, { amounts, mean, stdDev });
  }

  // Detect anomalies
  const anomalies: SpendingAnomaly[] = [];
  for (const txn of transactions) {
    if (txn.type === 'expense') {
      const stats = categoryStats.get(txn.category);
      if (stats && stats.stdDev > 0) {
        const amount = parseFloat(txn.amount as any);
        const deviation = Math.abs((amount - stats.mean) / stats.stdDev);

        if (deviation > threshold) {
          anomalies.push({
            category: txn.category,
            date: new Date(txn.date),
            amount,
            deviation,
            isAnomaly: true,
          });
        }
      }
    }
  }

  return anomalies.sort((a, b) => b.deviation - a.deviation);
}

/**
 * Project future spending based on historical data
 */
export interface Projection {
  month: number;
  year: number;
  projectedIncome: number;
  projectedExpense: number;
  projectedBalance: number;
}

export function projectFinances(
  transactions: Transaction[],
  monthsAhead: number = 3
): Projection[] {
  const monthlySummary = calculateMonthlySummary(transactions);

  if (monthlySummary.length === 0) return [];

  // Calculate averages
  const avgIncome = monthlySummary.reduce((a: number, b: MonthlyData) => a + b.income, 0) / monthlySummary.length;
  const avgExpense = monthlySummary.reduce((a: number, b: MonthlyData) => a + b.expense, 0) / monthlySummary.length;

  // Get last month
  const lastMonth = monthlySummary[monthlySummary.length - 1];
  const projections: Projection[] = [];

  for (let i = 1; i <= monthsAhead; i++) {
    let month = lastMonth.month + i;
    let year = lastMonth.year;

    if (month > 12) {
      month -= 12;
      year += 1;
    }

    projections.push({
      month,
      year,
      projectedIncome: avgIncome,
      projectedExpense: avgExpense,
      projectedBalance: avgIncome - avgExpense,
    });
  }

  return projections;
}

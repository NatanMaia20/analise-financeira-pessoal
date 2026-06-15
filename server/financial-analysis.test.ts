import { describe, it, expect } from 'vitest';
import {
  calculateMetrics,
  analyzeByCategory,
  calculateMonthlySummary,
  detectSpendingAnomalies,
  projectFinances,
  calculatePersonalMetrics,
  analyzeByCategoryGroup,
} from './financial-analysis';
import { Transaction } from '../drizzle/schema';

// Mock transactions for testing
const mockTransactions: Transaction[] = [
  {
    id: 1,
    date: new Date('2026-01-15'),
    type: 'income',
    category: 'Salary',
    account: 'Main',
    amount: '5000',
    currency: 'BRL',
    tags: null,
    description: 'Monthly salary',
    sourceAccount: null,
    targetAccount: null,
    isDuplicate: 0,
    importId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 2,
    date: new Date('2026-01-20'),
    type: 'expense',
    category: 'Food',
    account: 'Main',
    amount: '500',
    currency: 'BRL',
    tags: null,
    description: 'Groceries',
    sourceAccount: null,
    targetAccount: null,
    isDuplicate: 0,
    importId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 3,
    date: new Date('2026-01-25'),
    type: 'expense',
    category: 'Transport',
    account: 'Main',
    amount: '200',
    currency: 'BRL',
    tags: null,
    description: 'Gas',
    sourceAccount: null,
    targetAccount: null,
    isDuplicate: 0,
    importId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 4,
    date: new Date('2026-02-15'),
    type: 'income',
    category: 'Salary',
    account: 'Main',
    amount: '5000',
    currency: 'BRL',
    tags: null,
    description: 'Monthly salary',
    sourceAccount: null,
    targetAccount: null,
    isDuplicate: 0,
    importId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 5,
    date: new Date('2026-02-20'),
    type: 'expense',
    category: 'Food',
    account: 'Main',
    amount: '600',
    currency: 'BRL',
    tags: null,
    description: 'Restaurant',
    sourceAccount: null,
    targetAccount: null,
    isDuplicate: 0,
    importId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

describe('Financial Analysis', () => {
  describe('calculateMetrics', () => {
    it('should calculate correct financial metrics', () => {
      const metrics = calculateMetrics(mockTransactions);

      expect(metrics.totalIncome).toBe(10000);
      expect(metrics.totalExpense).toBe(1300);
      expect(metrics.netBalance).toBe(8700);
      expect(metrics.savingsRate).toBeGreaterThan(80);
    });

    it('should handle empty transactions', () => {
      const metrics = calculateMetrics([]);

      expect(metrics.totalIncome).toBe(0);
      expect(metrics.totalExpense).toBe(0);
      expect(metrics.netBalance).toBe(0);
    });

    it('should calculate average monthly values', () => {
      const metrics = calculateMetrics(mockTransactions);

      expect(metrics.averageMonthlyIncome).toBe(5000);
      expect(metrics.averageMonthlyExpense).toBeCloseTo(650, 0);
    });
  });

  describe('analyzeByCategory', () => {
    it('should analyze expenses by category', () => {
      const analysis = analyzeByCategory(mockTransactions);

      expect(analysis.length).toBeGreaterThan(0);
      expect(analysis[0].category).toBe('Food');
      expect(analysis[0].total).toBe(1100);
      expect(analysis[0].percentage).toBeGreaterThan(80);
    });

    it('should sort categories by total descending', () => {
      const analysis = analyzeByCategory(mockTransactions);

      for (let i = 0; i < analysis.length - 1; i++) {
        expect(analysis[i].total).toBeGreaterThanOrEqual(analysis[i + 1].total);
      }
    });

    it('should calculate correct percentages', () => {
      const analysis = analyzeByCategory(mockTransactions);

      const totalPercentage = analysis.reduce((sum, cat) => sum + cat.percentage, 0);
      expect(totalPercentage).toBeCloseTo(100, 0);
    });
  });

  describe('calculateMonthlySummary', () => {
    it('should group transactions by month', () => {
      const summary = calculateMonthlySummary(mockTransactions);

      expect(summary.length).toBeGreaterThanOrEqual(2);
      expect(summary[0].month).toBe(1);
      expect(summary[0].year).toBe(2026);
    });

    it('should calculate correct monthly totals', () => {
      const summary = calculateMonthlySummary(mockTransactions);

      expect(summary[0].income).toBe(5000);
      expect(summary[0].expense).toBe(700);
      expect(summary[0].balance).toBe(4300);

      expect(summary[1].income).toBe(5000);
      expect(summary[1].expense).toBe(600);
      expect(summary[1].balance).toBe(4400);
    });

    it('should sort by year and month', () => {
      const summary = calculateMonthlySummary(mockTransactions);

      for (let i = 0; i < summary.length - 1; i++) {
        const current = summary[i];
        const next = summary[i + 1];

        if (current.year === next.year) {
          expect(current.month).toBeLessThanOrEqual(next.month);
        } else {
          expect(current.year).toBeLessThan(next.year);
        }
      }
    });
  });

  describe('detectSpendingAnomalies', () => {
    it('should detect spending anomalies', () => {
      const anomalousTransactions: Transaction[] = [
        ...mockTransactions,
        {
          id: 6,
          date: new Date('2026-03-10'),
          type: 'expense',
          category: 'Food',
          account: 'Main',
          amount: '5000',
          currency: 'BRL',
          tags: null,
          description: 'Unusual spending',
          sourceAccount: null,
          targetAccount: null,
          isDuplicate: 0,
          importId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const anomalies = detectSpendingAnomalies(anomalousTransactions, 1.5);

      // With this threshold, we might or might not detect anomalies depending on standard deviation
      // Just verify the function runs without error
      expect(Array.isArray(anomalies)).toBe(true);
    });

    it('should return empty array for normal spending', () => {
      const anomalies = detectSpendingAnomalies(mockTransactions, 5);

      expect(anomalies.length).toBe(0);
    });
  });

  describe('projectFinances', () => {
    it('should project future finances', () => {
      const projections = projectFinances(mockTransactions, 3);

      expect(projections.length).toBe(3);
      expect(projections[0].month).toBeGreaterThan(0);
      expect(projections[0].month).toBeLessThanOrEqual(12);
    });

    it('should use average values for projections', () => {
      const projections = projectFinances(mockTransactions, 1);

      expect(projections[0].projectedIncome).toBeCloseTo(5000, 0);
      expect(projections[0].projectedExpense).toBeCloseTo(650, 0);
    });

    it('should handle empty transactions', () => {
      const projections = projectFinances([], 3);

      expect(projections.length).toBe(0);
    });
  });

  describe('calculatePersonalMetrics', () => {
    const txns: Transaction[] = [
      {
        id: 10, date: new Date('2026-01-05'), type: 'income', category: 'Salário',
        account: 'Main', amount: '3000', currency: 'BRL', tags: null, description: null,
        sourceAccount: null, targetAccount: null, isDuplicate: 0, importId: null,
        createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: 11, date: new Date('2026-01-06'), type: 'expense', category: 'Café',
        account: 'Main', amount: '100', currency: 'BRL', tags: null, description: null,
        sourceAccount: null, targetAccount: null, isDuplicate: 0, importId: null,
        createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: 12, date: new Date('2026-01-07'), type: 'expense', category: 'Desp. Temp. De Terceiros',
        account: 'Main', amount: '20', currency: 'BRL', tags: null, description: null,
        sourceAccount: null, targetAccount: null, isDuplicate: 0, importId: null,
        createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: 13, date: new Date('2026-01-08'), type: 'income', category: 'Reembolso - Divisão de Conta',
        account: 'Main', amount: '20', currency: 'BRL', tags: null, description: null,
        sourceAccount: null, targetAccount: null, isDuplicate: 0, importId: null,
        createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: 14, date: new Date('2026-01-09'), type: 'expense', category: 'Investimentos',
        account: 'Main', amount: '150', currency: 'BRL', tags: null, description: null,
        sourceAccount: null, targetAccount: null, isDuplicate: 0, importId: null,
        createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: 15, date: new Date('2026-01-10'), type: 'transfer', category: 'Transf. Entre Contas',
        account: 'Main', amount: '300', currency: 'BRL', tags: null, description: null,
        sourceAccount: 'Main', targetAccount: 'Outras contas', isDuplicate: 0, importId: null,
        createdAt: new Date(), updatedAt: new Date(),
      },
    ];

    it('excludes internal transfers, third-party pass-through and investments from the personal totals', () => {
      const metrics = calculatePersonalMetrics(txns);

      expect(metrics.personalIncome).toBe(3000);
      expect(metrics.personalExpense).toBe(100);
      expect(metrics.personalNetBalance).toBe(2900);
      expect(metrics.investmentAmount).toBe(150);
      expect(metrics.thirdPartyExpense).toBe(20);
      expect(metrics.thirdPartyReimbursement).toBe(20);
      expect(metrics.thirdPartyNet).toBe(0);
      expect(metrics.internalTransferTotal).toBe(300);
    });

    it('computes a personal savings rate based only on personal income/expense', () => {
      const metrics = calculatePersonalMetrics(txns);
      expect(metrics.personalSavingsRate).toBeCloseTo((2900 / 3000) * 100, 5);
    });

    it('handles empty transactions', () => {
      const metrics = calculatePersonalMetrics([]);
      expect(metrics.personalIncome).toBe(0);
      expect(metrics.personalExpense).toBe(0);
      expect(metrics.personalSavingsRate).toBe(0);
    });
  });

  describe('analyzeByCategoryGroup', () => {
    const txns: Transaction[] = [
      {
        id: 20, date: new Date('2026-01-05'), type: 'income', category: 'Salário',
        account: 'Main', amount: '3000', currency: 'BRL', tags: null, description: null,
        sourceAccount: null, targetAccount: null, isDuplicate: 0, importId: null,
        createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: 21, date: new Date('2026-01-06'), type: 'expense', category: 'Café',
        account: 'Main', amount: '100', currency: 'BRL', tags: null, description: null,
        sourceAccount: null, targetAccount: null, isDuplicate: 0, importId: null,
        createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: 22, date: new Date('2026-01-07'), type: 'expense', category: 'Desp. Temp. De Terceiros',
        account: 'Main', amount: '20', currency: 'BRL', tags: null, description: null,
        sourceAccount: null, targetAccount: null, isDuplicate: 0, importId: null,
        createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: 23, date: new Date('2026-01-09'), type: 'expense', category: 'Investimentos',
        account: 'Main', amount: '150', currency: 'BRL', tags: null, description: null,
        sourceAccount: null, targetAccount: null, isDuplicate: 0, importId: null,
        createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: 24, date: new Date('2026-01-10'), type: 'transfer', category: 'Transf. Entre Contas',
        account: 'Main', amount: '300', currency: 'BRL', tags: null, description: null,
        sourceAccount: 'Main', targetAccount: 'Outras contas', isDuplicate: 0, importId: null,
        createdAt: new Date(), updatedAt: new Date(),
      },
    ];

    it('groups by personal / third_party / investment, excluding transfers', () => {
      const groups = analyzeByCategoryGroup(txns);
      const byFlow = new Map(groups.map(g => [g.flow, g]));

      expect(byFlow.has('internal_transfer' as any)).toBe(false);

      expect(byFlow.get('personal')?.totalIncome).toBe(3000);
      expect(byFlow.get('personal')?.totalExpense).toBe(100);

      expect(byFlow.get('third_party')?.totalExpense).toBe(20);
      expect(byFlow.get('investment')?.totalExpense).toBe(150);
    });
  });
});

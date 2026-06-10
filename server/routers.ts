import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  insertTransactions,
  getTransactionsByDateRange,
  getTransactionsByCategory,
  getTransactionsByType,
  getAllTransactions,
  insertCategories,
  getCategoriesByType,
  getAllCategories,
  createImport,
  getImportHistory,
  getLatestImport,
  createFinancialGoal,
  getActiveGoals,
  createInsight,
  getRecentInsights,
  getMonthlySummary,
  upsertMonthlySummary,
} from "./db";
import { processXLSXFile, detectDuplicates } from "./xlsx-processor";
import {
  calculateMetrics,
  analyzeByCategory,
  calculateMonthlySummary,
  calculateCategoryGrowth,
  detectSpendingAnomalies,
  projectFinances,
} from "./financial-analysis";
import { invokeLLM } from "./_core/llm";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // ============ IMPORT OPERATIONS ============
  import: router({
    uploadFile: protectedProcedure
      .input(z.object({
        fileBuffer: z.string(), // Base64 encoded
        fileName: z.string(),
      }))
      .mutation(async ({ input }) => {
        try {
          const buffer = Buffer.from(input.fileBuffer, 'base64');
          const result = await processXLSXFile(buffer);

          if (result.errors.length > 0) {
            return {
              success: false,
              errors: result.errors,
              summary: result.summary,
            };
          }

          // Get existing transactions to detect duplicates
          const existing = await getAllTransactions();
          const duplicateIndices = detectDuplicates(result.transactions, existing);

          // Create import record
          const importResult = await createImport({
            fileName: input.fileName,
            totalRecords: result.transactions.length,
            status: 'success',
          });
          const importId = (importResult as any).insertId || 1;

          // Insert categories
          const categoryList = Array.from(result.categories).map(name => ({
            name,
            type: 'expense' as const,
          }));
          await insertCategories(categoryList);

          // Insert transactions
          const txnsToInsert = result.transactions.map((txn, idx) => ({
            ...txn,
            isDuplicate: duplicateIndices.has(idx) ? 1 : 0,
            importId,
          }));
          await insertTransactions(txnsToInsert);

          return {
            success: true,
            importId,
            totalRecords: result.transactions.length,
            duplicateCount: duplicateIndices.size,
            summary: result.summary,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      }),

    history: protectedProcedure.query(async () => {
      return await getImportHistory();
    }),

    latest: protectedProcedure.query(async () => {
      return await getLatestImport();
    }),
  }),

  // ============ TRANSACTIONS ============
  transactions: router({
    getAll: protectedProcedure.query(async () => {
      return await getAllTransactions();
    }),

    getByDateRange: protectedProcedure
      .input(z.object({
        startDate: z.string(),
        endDate: z.string(),
      }))
      .query(async ({ input }) => {
        const start = new Date(input.startDate);
        const end = new Date(input.endDate);
        return await getTransactionsByDateRange(start, end);
      }),

    getByCategory: protectedProcedure
      .input(z.object({
        category: z.string(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const start = input.startDate ? new Date(input.startDate) : undefined;
        const end = input.endDate ? new Date(input.endDate) : undefined;
        return await getTransactionsByCategory(input.category, start, end);
      }),

    getByType: protectedProcedure
      .input(z.object({
        type: z.enum(['expense', 'income', 'transfer']),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const start = input.startDate ? new Date(input.startDate) : undefined;
        const end = input.endDate ? new Date(input.endDate) : undefined;
        return await getTransactionsByType(input.type, start, end);
      }),
  }),

  // ============ CATEGORIES ============
  categories: router({
    getAll: protectedProcedure.query(async () => {
      return await getAllCategories();
    }),

    getByType: protectedProcedure
      .input(z.object({
        type: z.enum(['expense', 'income']),
      }))
      .query(async ({ input }) => {
        return await getCategoriesByType(input.type);
      }),
  }),

  // ============ FINANCIAL ANALYSIS ============
  analysis: router({
    metrics: protectedProcedure
      .input(z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }))
      .query(async ({ input }) => {
        let transactions = await getAllTransactions();

        if (input.startDate && input.endDate) {
          const start = new Date(input.startDate);
          const end = new Date(input.endDate);
          transactions = await getTransactionsByDateRange(start, end);
        }

        return calculateMetrics(transactions);
      }),

    byCategory: protectedProcedure
      .input(z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }))
      .query(async ({ input }) => {
        let transactions = await getAllTransactions();

        if (input.startDate && input.endDate) {
          const start = new Date(input.startDate);
          const end = new Date(input.endDate);
          transactions = await getTransactionsByDateRange(start, end);
        }

        return analyzeByCategory(transactions);
      }),

    monthlySummary: protectedProcedure.query(async () => {
      const transactions = await getAllTransactions();
      return calculateMonthlySummary(transactions);
    }),

    anomalies: protectedProcedure
      .input(z.object({
        threshold: z.number().default(2),
      }))
      .query(async ({ input }) => {
        const transactions = await getAllTransactions();
        return detectSpendingAnomalies(transactions, input.threshold);
      }),

    projections: protectedProcedure
      .input(z.object({
        monthsAhead: z.number().default(3),
      }))
      .query(async ({ input }) => {
        const transactions = await getAllTransactions();
        return projectFinances(transactions, input.monthsAhead);
      }),
  }),

  // ============ FINANCIAL GOALS ============
  goals: router({
    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        type: z.enum(['monthly_savings', 'category_limit', 'annual_goal', 'monthly_expense_limit']),
        targetAmount: z.number(),
        category: z.string().optional(),
        period: z.enum(['monthly', 'quarterly', 'annual']),
        startDate: z.string(),
        endDate: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await createFinancialGoal({
          name: input.name,
          type: input.type,
          targetAmount: input.targetAmount.toString(),
          category: input.category,
          period: input.period,
          startDate: new Date(input.startDate),
          endDate: input.endDate ? new Date(input.endDate) : null,
          isActive: 1,
        });
      }),

    getActive: protectedProcedure.query(async () => {
      return await getActiveGoals();
    }),
  }),

  // ============ INSIGHTS ============
  insights: router({
    recent: protectedProcedure
      .input(z.object({
        limit: z.number().default(5),
      }))
      .query(async ({ input }) => {
        return await getRecentInsights(input.limit);
      }),

    generate: protectedProcedure
      .input(z.object({
        startDate: z.string(),
        endDate: z.string(),
      }))
      .mutation(async ({ input }) => {
        try {
          const start = new Date(input.startDate);
          const end = new Date(input.endDate);
          const transactions = await getTransactionsByDateRange(start, end);

          if (transactions.length === 0) {
            return {
              success: false,
              error: 'No transactions found for the selected period',
            };
          }

          const metrics = calculateMetrics(transactions);
          const categoryAnalysis = analyzeByCategory(transactions);
          const anomalies = detectSpendingAnomalies(transactions);

          // Generate insights using LLM
          const prompt = `Analyze these financial data and provide 3-5 key insights in Portuguese:

Financial Metrics:
- Total Income: R$ ${metrics.totalIncome.toFixed(2)}
- Total Expense: R$ ${metrics.totalExpense.toFixed(2)}
- Net Balance: R$ ${metrics.netBalance.toFixed(2)}
- Savings Rate: ${metrics.savingsRate.toFixed(1)}%

Top Spending Categories:
${categoryAnalysis.slice(0, 5).map(c => `- ${c.category}: R$ ${c.total.toFixed(2)} (${c.percentage.toFixed(1)}%)`).join('\n')}

Spending Anomalies:
${anomalies.slice(0, 3).map(a => `- ${a.category}: R$ ${a.amount.toFixed(2)} (${a.deviation.toFixed(1)}σ)`).join('\n')}

Provide actionable insights about spending patterns, areas for improvement, and positive trends.`;

          const response = await invokeLLM({
            messages: [
              {
                role: 'system',
                content: 'You are a financial advisor. Provide insights in Portuguese.',
              },
              {
                role: 'user',
                content: prompt,
              },
            ] as any,
          });

          const insightText = (typeof response.choices[0]?.message.content === 'string' ? response.choices[0]?.message.content : '') || '';

          // Save insight
          await createInsight({
            type: 'ai_analysis',
            title: 'Análise Financeira Automática',
            description: insightText,
            severity: 'info',
            periodStart: start,
            periodEnd: end,
            data: {
              metrics,
              topCategories: categoryAnalysis.slice(0, 5),
              anomalies: anomalies.slice(0, 3),
            },
          });

          return {
            success: true,
            insights: insightText,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to generate insights',
          };
        }
      }),
  }),

  // ============ FINANCIAL ASSISTANT ============
  assistant: router({
    chat: protectedProcedure
      .input(z.object({
        message: z.string(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          let transactions = await getAllTransactions();

          if (input.startDate && input.endDate) {
            const start = new Date(input.startDate);
            const end = new Date(input.endDate);
            transactions = await getTransactionsByDateRange(start, end);
          }

          const metrics = calculateMetrics(transactions);
          const categoryAnalysis = analyzeByCategory(transactions);

          const context = `Financial Data Context:
- Total Income: R$ ${metrics.totalIncome.toFixed(2)}
- Total Expense: R$ ${metrics.totalExpense.toFixed(2)}
- Net Balance: R$ ${metrics.netBalance.toFixed(2)}
- Average Monthly Income: R$ ${metrics.averageMonthlyIncome.toFixed(2)}
- Average Monthly Expense: R$ ${metrics.averageMonthlyExpense.toFixed(2)}

Top Spending Categories:
${categoryAnalysis.slice(0, 10).map(c => `- ${c.category}: R$ ${c.total.toFixed(2)} (${c.count} transactions)`).join('\n')}

Total Transactions: ${transactions.length}`;

          const response = await invokeLLM({
            messages: [
              {
                role: 'system',
                content: `You are a helpful financial advisor. Answer questions about personal finances in Portuguese. Use the provided financial data to give accurate answers. Be concise and practical.\n\n${context}`,
              },
              {
                role: 'user',
                content: input.message,
              },
            ] as any,
          });

          const responseText = typeof response.choices[0]?.message.content === 'string' ? response.choices[0]?.message.content : '';
          return {
            success: true,
            response: responseText,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to process request',
          };
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;

import { eq, and, gte, lte, between, desc, asc, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, transactions, categories, imports, financialGoals, insights, monthlySummary } from "../drizzle/schema";
import { ENV } from './_core/env';
import { getCategoryFlow } from "../shared/category-rules";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ============ TRANSACTION QUERIES ============

export async function insertTransactions(txns: typeof transactions.$inferInsert[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  if (txns.length === 0) return [];
  return await db.insert(transactions).values(txns);
}

export async function getTransactionsByDateRange(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db
    .select()
    .from(transactions)
    .where(between(transactions.date, startDate, endDate))
    .orderBy(desc(transactions.date));
}

export async function getTransactionsByCategory(category: string, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const conditions = [eq(transactions.category, category)];
  if (startDate && endDate) {
    conditions.push(between(transactions.date, startDate, endDate));
  }
  
  return await db
    .select()
    .from(transactions)
    .where(and(...conditions))
    .orderBy(desc(transactions.date));
}

export async function getTransactionsByType(type: 'expense' | 'income' | 'transfer', startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const conditions = [eq(transactions.type, type)];
  if (startDate && endDate) {
    conditions.push(between(transactions.date, startDate, endDate));
  }
  
  return await db
    .select()
    .from(transactions)
    .where(and(...conditions))
    .orderBy(desc(transactions.date));
}

export async function getAllTransactions() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.select().from(transactions).orderBy(desc(transactions.date));
}

export async function getTransactionCount() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select({ count: transactions.id }).from(transactions);
  return result[0]?.count || 0;
}

/**
 * Fixes data imported before the internal-transfer reclassification logic
 * existed: finds 'expense'/'income' transactions whose category is an
 * internal transfer (e.g. "Transf. Entre Contas", "Transf. entre Contas")
 * and converts them to type 'transfer', so they stop inflating
 * totalExpense/totalIncome and category breakdowns.
 *
 * This is idempotent — running it again after it has already fixed the
 * data is a no-op, since the matched rows are no longer 'expense'/'income'.
 */
export async function reclassifyInternalTransfers(): Promise<{
  expenseRowsUpdated: number;
  incomeRowsUpdated: number;
  categoriesAffected: string[];
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const distinctCategories = await db.selectDistinct({ category: transactions.category }).from(transactions);
  const internalTransferCategories = distinctCategories
    .map(row => row.category)
    .filter(category => getCategoryFlow(category) === 'internal_transfer');

  if (internalTransferCategories.length === 0) {
    return { expenseRowsUpdated: 0, incomeRowsUpdated: 0, categoriesAffected: [] };
  }

  // Money leaving the tracked account: source = the account itself,
  // target = a generic placeholder for "somewhere else".
  const expenseResult: any = await db
    .update(transactions)
    .set({
      type: 'transfer',
      sourceAccount: sql`${transactions.account}`,
      targetAccount: 'Outras contas',
    })
    .where(and(eq(transactions.type, 'expense'), inArray(transactions.category, internalTransferCategories)));

  // Money entering the tracked account: source = generic placeholder,
  // target = the account itself.
  const incomeResult: any = await db
    .update(transactions)
    .set({
      type: 'transfer',
      sourceAccount: 'Outras contas',
      targetAccount: sql`${transactions.account}`,
    })
    .where(and(eq(transactions.type, 'income'), inArray(transactions.category, internalTransferCategories)));

  return {
    expenseRowsUpdated: expenseResult?.[0]?.affectedRows ?? expenseResult?.affectedRows ?? 0,
    incomeRowsUpdated: incomeResult?.[0]?.affectedRows ?? incomeResult?.affectedRows ?? 0,
    categoriesAffected: internalTransferCategories,
  };
}

// ============ CATEGORY QUERIES ============

export async function insertCategories(cats: typeof categories.$inferInsert[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  if (cats.length === 0) return [];
  return await db.insert(categories).values(cats);
}

export async function getCategoriesByType(type: 'expense' | 'income') {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db
    .select()
    .from(categories)
    .where(eq(categories.type, type))
    .orderBy(asc(categories.name));
}

export async function getAllCategories() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.select().from(categories).orderBy(asc(categories.name));
}

// ============ IMPORT QUERIES ============

export async function createImport(data: typeof imports.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(imports).values(data);
  return result;
}

export async function getImportHistory() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.select().from(imports).orderBy(desc(imports.importedAt));
}

export async function getLatestImport() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(imports).orderBy(desc(imports.importedAt)).limit(1);
  return result[0] || null;
}

// ============ FINANCIAL GOALS QUERIES ============

export async function createFinancialGoal(goal: typeof financialGoals.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.insert(financialGoals).values(goal);
}

export async function getActiveGoals() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db
    .select()
    .from(financialGoals)
    .where(eq(financialGoals.isActive, 1))
    .orderBy(asc(financialGoals.name));
}

// ============ INSIGHTS QUERIES ============

export async function createInsight(insight: typeof insights.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.insert(insights).values(insight);
}

export async function getInsightsByPeriod(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db
    .select()
    .from(insights)
    .where(and(
      gte(insights.periodStart, startDate),
      lte(insights.periodEnd, endDate)
    ))
    .orderBy(desc(insights.createdAt));
}

export async function getRecentInsights(limit: number = 5) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db
    .select()
    .from(insights)
    .orderBy(desc(insights.createdAt))
    .limit(limit);
}

// ============ MONTHLY SUMMARY QUERIES ============

export async function getMonthlySummary(year: number, month: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db
    .select()
    .from(monthlySummary)
    .where(and(
      eq(monthlySummary.year, year),
      eq(monthlySummary.month, month)
    ))
    .limit(1);
  
  return result[0] || null;
}

export async function upsertMonthlySummary(data: typeof monthlySummary.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await getMonthlySummary(data.year, data.month!);
  
  if (existing) {
    return await db
      .update(monthlySummary)
      .set(data)
      .where(and(
        eq(monthlySummary.year, data.year),
        eq(monthlySummary.month, data.month!)
      ));
  } else {
    return await db.insert(monthlySummary).values(data);
  }
}

export async function getMonthlySummaryRange(startYear: number, startMonth: string, endYear: number, endMonth: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db
    .select()
    .from(monthlySummary)
    .orderBy(asc(monthlySummary.year), asc(monthlySummary.month));
}

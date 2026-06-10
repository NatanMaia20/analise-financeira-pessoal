import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  json,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Categories for transactions (expenses and income)
 */
export const categories = mysqlTable("categories", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  type: mysqlEnum("type", ["expense", "income"]).notNull(),
  color: varchar("color", { length: 7 }).default("#10b981"), // Default green
  icon: varchar("icon", { length: 50 }).default("tag"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Category = typeof categories.$inferSelect;
export type InsertCategory = typeof categories.$inferInsert;

/**
 * Import history tracking
 */
export const imports = mysqlTable("imports", {
  id: int("id").autoincrement().primaryKey(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  importedAt: timestamp("importedAt").defaultNow().notNull(),
  totalRecords: int("totalRecords").notNull(),
  status: mysqlEnum("status", ["success", "failed"]).default("success").notNull(),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Import = typeof imports.$inferSelect;
export type InsertImport = typeof imports.$inferInsert;

/**
 * Financial transactions (expenses, income, transfers)
 */
export const transactions = mysqlTable("transactions", {
  id: int("id").autoincrement().primaryKey(),
  date: timestamp("date").notNull(),
  type: mysqlEnum("type", ["expense", "income", "transfer"]).notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  account: varchar("account", { length: 100 }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("BRL").notNull(),
  tags: json("tags").$type<string[]>().default([]),
  description: text("description"),
  importId: int("importId"),
  sourceAccount: varchar("sourceAccount", { length: 100 }), // For transfers
  targetAccount: varchar("targetAccount", { length: 100 }), // For transfers
  isDuplicate: int("isDuplicate").default(0 as any), // 0 = false, 1 = true
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;

/**
 * Financial goals and limits
 */
export const financialGoals = mysqlTable("financialGoals", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  type: mysqlEnum("type", [
    "monthly_savings",
    "category_limit",
    "annual_goal",
    "monthly_expense_limit",
  ]).notNull(),
  targetAmount: decimal("targetAmount", { precision: 12, scale: 2 }).notNull(),
  currentAmount: decimal("currentAmount", { precision: 12, scale: 2 }).default("0"),
  category: varchar("category", { length: 100 }), // For category-specific goals
  period: mysqlEnum("period", ["monthly", "quarterly", "annual"]).notNull(),
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate"),
  isActive: int("isActive").default(1 as any), // 0 = false, 1 = true
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FinancialGoal = typeof financialGoals.$inferSelect;
export type InsertFinancialGoal = typeof financialGoals.$inferInsert;

/**
 * Cached insights and analysis results
 */
export const insights = mysqlTable("insights", {
  id: int("id").autoincrement().primaryKey(),
  type: varchar("type", { length: 100 }).notNull(), // e.g., "category_growth", "high_expense", "savings_month"
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  severity: mysqlEnum("severity", ["info", "warning", "alert"]).default("info"),
  data: json("data").$type<Record<string, unknown>>(),
  periodStart: timestamp("periodStart").notNull(),
  periodEnd: timestamp("periodEnd").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Insight = typeof insights.$inferSelect;
export type InsertInsight = typeof insights.$inferInsert;

/**
 * Monthly summary cache for performance
 */
export const monthlySummary = mysqlTable("monthlySummary", {
  id: int("id").autoincrement().primaryKey(),
  year: int("year").notNull(),
  month: varchar("month", { length: 2 }).notNull(), // 1-12
  totalIncome: decimal("totalIncome", { precision: 12, scale: 2 }).default("0"),
  totalExpense: decimal("totalExpense", { precision: 12, scale: 2 }).default("0"),
  netBalance: decimal("netBalance", { precision: 12, scale: 2 }).default("0"),
  categoryBreakdown: json("categoryBreakdown").$type<Record<string, number>>(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MonthlySummary = typeof monthlySummary.$inferSelect;
export type InsertMonthlySummary = typeof monthlySummary.$inferInsert;

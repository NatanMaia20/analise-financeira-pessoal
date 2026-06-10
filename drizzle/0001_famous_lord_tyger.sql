CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`type` enum('expense','income') NOT NULL,
	`color` varchar(7) DEFAULT '#10b981',
	`icon` varchar(50) DEFAULT 'tag',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `financialGoals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`type` enum('monthly_savings','category_limit','annual_goal','monthly_expense_limit') NOT NULL,
	`targetAmount` decimal(12,2) NOT NULL,
	`currentAmount` decimal(12,2) DEFAULT '0',
	`category` varchar(100),
	`period` enum('monthly','quarterly','annual') NOT NULL,
	`startDate` timestamp NOT NULL,
	`endDate` timestamp,
	`isActive` int DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `financialGoals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `imports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`importedAt` timestamp NOT NULL DEFAULT (now()),
	`totalRecords` int NOT NULL,
	`status` enum('success','failed') NOT NULL DEFAULT 'success',
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `imports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `insights` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` varchar(100) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`severity` enum('info','warning','alert') DEFAULT 'info',
	`data` json,
	`periodStart` timestamp NOT NULL,
	`periodEnd` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `insights_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `monthlySummary` (
	`id` int AUTO_INCREMENT NOT NULL,
	`year` int NOT NULL,
	`month` varchar(2) NOT NULL,
	`totalIncome` decimal(12,2) DEFAULT '0',
	`totalExpense` decimal(12,2) DEFAULT '0',
	`netBalance` decimal(12,2) DEFAULT '0',
	`categoryBreakdown` json,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `monthlySummary_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`date` timestamp NOT NULL,
	`type` enum('expense','income','transfer') NOT NULL,
	`category` varchar(100) NOT NULL,
	`account` varchar(100) NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'BRL',
	`tags` json DEFAULT ('[]'),
	`description` text,
	`importId` int,
	`sourceAccount` varchar(100),
	`targetAccount` varchar(100),
	`isDuplicate` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `transactions_id` PRIMARY KEY(`id`)
);

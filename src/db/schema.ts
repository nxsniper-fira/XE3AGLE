import { pgTable, text, timestamp, numeric, boolean, integer, varchar, index, unique, serial } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    password: text('password'),
    name: text('name'),
    image: text('image'),
    emailVerified: timestamp('email_verified'),
    role: varchar('role', { length: 20 }).notNull().default('user'),
    plan: varchar('plan', { length: 20 }).notNull().default('free'),
    planExpiry: timestamp('plan_expiry'),
    disciplineScore: numeric('discipline_score', { precision: 5, scale: 2 }).default('0'),
    streak: integer('streak').default(0),
    killSwitchEnabled: boolean('kill_switch_enabled').default(false),
    timezone: varchar('timezone', { length: 50 }).default('UTC'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('idx_users_email').on(table.email), index('idx_users_role').on(table.role)]
);

export const accounts = pgTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    balance: numeric('balance', { precision: 15, scale: 2 }).notNull(),
    accountType: varchar('account_type', { length: 50 }).notNull().default('Live'),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    riskPerTrade: numeric('risk_per_trade', { precision: 5, scale: 2 }).default('0.5'),
    maxDailyLoss: numeric('max_daily_loss', { precision: 5, scale: 2 }).default('1'),
    maxTradesPerDay: integer('max_trades_per_day').default(3),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_accounts_user_id').on(table.userId)]
);

export const trades = pgTable(
  'trades',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    symbol: varchar('symbol', { length: 50 }).notNull(),
    direction: varchar('direction', { length: 10 }).notNull(),
    entryPrice: numeric('entry_price', { precision: 15, scale: 4 }).notNull(),
    exitPrice: numeric('exit_price', { precision: 15, scale: 4 }),
    riskAmount: numeric('risk_amount', { precision: 15, scale: 2 }).notNull(),
    rewardAmount: numeric('reward_amount', { precision: 15, scale: 2 }),
    rMultiple: numeric('r_multiple', { precision: 5, scale: 2 }),
    emotion: varchar('emotion', { length: 50 }),
    grade: varchar('grade', { length: 10 }),
    lessons: text('lessons'),
    screenshotUrl: text('screenshot_url'),
    setup: varchar('setup', { length: 100 }),
    status: varchar('status', { length: 20 }).notNull().default('open'),
    openedAt: timestamp('opened_at').notNull(),
    closedAt: timestamp('closed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_trades_account_id').on(table.accountId), index('idx_trades_closed_at').on(table.closedAt)]
);

export const payments = pgTable(
  'payments',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    planRequested: varchar('plan_requested', { length: 20 }).notNull(),
    method: varchar('method', { length: 50 }).notNull(),
    currency: varchar('currency', { length: 10 }).notNull(),
    amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
    reference: varchar('reference', { length: 100 }).notNull().unique(),
    proofUrl: text('proof_url').notNull(),
    phone: varchar('phone', { length: 20 }),
    note: text('note'),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    approvedBy: text('approved_by').references(() => users.id),
    rejectionReason: text('rejection_reason'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_payments_user_id').on(table.userId),
    index('idx_payments_status').on(table.status),
    unique('idx_payments_reference').on(table.reference),
  ]
);

export const prices = pgTable('prices', {
  id: text('id').primaryKey(),
  plan: varchar('plan', { length: 20 }).notNull().unique(),
  priceUsd: numeric('price_usd', { precision: 10, scale: 2 }).notNull(),
  priceEtb: numeric('price_etb', { precision: 10, scale: 2 }).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const disciplineGates = pgTable(
  'discipline_gates',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    tradeId: text('trade_id').references(() => trades.id, { onDelete: 'set null' }),
    gateName: varchar('gate_name', { length: 50 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_discipline_gates_account_id').on(table.accountId)]
);

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  payments: many(payments),
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
  trades: many(trades),
  gates: many(disciplineGates),
}));

export const tradesRelations = relations(trades, ({ one }) => ({
  account: one(accounts, { fields: [trades.accountId], references: [accounts.id] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  user: one(users, { fields: [payments.userId], references: [users.id] }),
  approver: one(users, { fields: [payments.approvedBy], references: [users.id] }),
}));

export const disciplineGatesRelations = relations(disciplineGates, ({ one }) => ({
  account: one(accounts, { fields: [disciplineGates.accountId], references: [accounts.id] }),
  trade: one(trades, { fields: [disciplineGates.tradeId], references: [trades.id] }),
}));

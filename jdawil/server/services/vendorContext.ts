/**
 * VendorContext — read-only helpers that surface a vendor's real
 * financial / operational data to the AI advisor. Each helper is
 * exposed as a "tool" to the OpenAI function-calling loop in
 * routes/ai-advisor.ts so the agent can fetch exactly what it
 * needs to answer a question, rather than receiving one giant
 * pre-baked blob every time.
 */

import { db } from '../db/index.js';
import {
  bookings, financials, inventory, customers, users,
  packages, services, employeeStats, vendors,
} from '../db/schema.js';
import { and, eq, gte, lte, sql, desc, count } from 'drizzle-orm';

/* ─── Date helpers ────────────────────────────────────────────────────────── */

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

/* ─── 1. Financial summary ────────────────────────────────────────────────── */

export interface FinancialSummary {
  periodDays: number;
  revenue: number;
  expenses: number;
  profit: number;
  profitMarginPct: number;
  bookingsCompleted: number;
  bookingsCancelled: number;
  cancellationRatePct: number;
  avgTicketSize: number;
  /** Revenue vs previous period of the same length. */
  revenueGrowthPct: number | null;
  /** Expense breakdown by category. */
  expensesByCategory: { category: string; amount: number }[];
}

export async function getFinancialSummary(
  vendorId: number,
  periodDays = 30,
): Promise<FinancialSummary> {
  const from = daysAgo(periodDays);
  const prevFrom = daysAgo(periodDays * 2);

  // Revenue from completed bookings
  const [revRow] = await db
    .select({
      revenue: sql<string>`coalesce(sum(cast(${bookings.totalPrice} as numeric)), 0)`,
      completed: count(bookings.id),
    })
    .from(bookings)
    .where(and(
      eq(bookings.vendorId, vendorId),
      eq(bookings.status, 'completed'),
      gte(bookings.createdAt, from),
    ));

  const [cancelRow] = await db
    .select({ cancelled: count(bookings.id) })
    .from(bookings)
    .where(and(
      eq(bookings.vendorId, vendorId),
      eq(bookings.status, 'cancelled'),
      gte(bookings.createdAt, from),
    ));

  const [prevRevRow] = await db
    .select({ revenue: sql<string>`coalesce(sum(cast(${bookings.totalPrice} as numeric)), 0)` })
    .from(bookings)
    .where(and(
      eq(bookings.vendorId, vendorId),
      eq(bookings.status, 'completed'),
      gte(bookings.createdAt, prevFrom),
      lte(bookings.createdAt, from),
    ));

  // Expenses from financials table
  const expenseRows = await db
    .select({
      category: financials.category,
      total: sql<string>`coalesce(sum(cast(${financials.amount} as numeric)), 0)`,
    })
    .from(financials)
    .where(and(
      eq(financials.vendorId, vendorId),
      eq(financials.type, 'expense'),
      gte(financials.date, from),
    ))
    .groupBy(financials.category);

  const revenue = Number(revRow?.revenue ?? 0);
  const completed = Number(revRow?.completed ?? 0);
  const cancelled = Number(cancelRow?.cancelled ?? 0);
  const prevRevenue = Number(prevRevRow?.revenue ?? 0);
  const expenses = expenseRows.reduce((s, r) => s + Number(r.total), 0);
  const profit = revenue - expenses;

  return {
    periodDays,
    revenue: Math.round(revenue * 100) / 100,
    expenses: Math.round(expenses * 100) / 100,
    profit: Math.round(profit * 100) / 100,
    profitMarginPct: revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : 0,
    bookingsCompleted: completed,
    bookingsCancelled: cancelled,
    cancellationRatePct: completed + cancelled > 0
      ? Math.round((cancelled / (completed + cancelled)) * 1000) / 10
      : 0,
    avgTicketSize: completed > 0 ? Math.round((revenue / completed) * 100) / 100 : 0,
    revenueGrowthPct: prevRevenue > 0
      ? Math.round(((revenue - prevRevenue) / prevRevenue) * 1000) / 10
      : null,
    expensesByCategory: expenseRows
      .map((r) => ({ category: r.category ?? 'غير مصنّف', amount: Math.round(Number(r.total) * 100) / 100 }))
      .sort((a, b) => b.amount - a.amount),
  };
}

/* ─── 2. Inventory status ─────────────────────────────────────────────────── */

export interface InventoryStatus {
  totalItems: number;
  lowStockItems: { name: string; quantity: number; threshold: number; unit?: string }[];
  outOfStockCount: number;
  estimatedValue: number;
}

export async function getInventoryStatus(vendorId: number): Promise<InventoryStatus> {
  const rows = await db
    .select({
      name: inventory.name,
      quantity: inventory.quantity,
      minQuantity: inventory.minQuantity,
      unit: inventory.unit,
      costPerUnit: inventory.costPerUnit,
    })
    .from(inventory)
    .where(eq(inventory.vendorId, vendorId));

  const low = rows.filter((r) => {
    const q = Number(r.quantity ?? 0);
    const t = Number(r.minQuantity ?? 0);
    return t > 0 && q <= t;
  });

  const out = rows.filter((r) => Number(r.quantity ?? 0) <= 0).length;
  const value = rows.reduce((s, r) => s + Number(r.quantity ?? 0) * Number(r.costPerUnit ?? 0), 0);

  return {
    totalItems: rows.length,
    lowStockItems: low.map((r) => ({
      name: r.name,
      quantity: Number(r.quantity ?? 0),
      threshold: Number(r.minQuantity ?? 0),
      unit: r.unit ?? undefined,
    })),
    outOfStockCount: out,
    estimatedValue: Math.round(value * 100) / 100,
  };
}

/* ─── 3. Top services & packages ──────────────────────────────────────────── */

export interface TopPackage {
  packageName: string;
  serviceName: string;
  bookings: number;
  revenue: number;
  avgPrice: number;
}

export async function getTopPackages(
  vendorId: number,
  periodDays = 30,
  limit = 5,
): Promise<TopPackage[]> {
  const from = daysAgo(periodDays);
  const rows = await db
    .select({
      packageName: packages.name,
      serviceName: services.name,
      bookings: count(bookings.id),
      revenue: sql<string>`coalesce(sum(cast(${bookings.totalPrice} as numeric)), 0)`,
    })
    .from(bookings)
    .leftJoin(packages, eq(bookings.packageId, packages.id))
    .leftJoin(services, eq(packages.serviceId, services.id))
    .where(and(
      eq(bookings.vendorId, vendorId),
      eq(bookings.status, 'completed'),
      gte(bookings.createdAt, from),
    ))
    .groupBy(packages.name, services.name)
    .orderBy(desc(count(bookings.id)))
    .limit(limit);

  return rows.map((r) => {
    const n = Number(r.bookings);
    const rev = Number(r.revenue);
    return {
      packageName: r.packageName ?? 'غير معروف',
      serviceName: r.serviceName ?? 'غير معروف',
      bookings: n,
      revenue: Math.round(rev * 100) / 100,
      avgPrice: n > 0 ? Math.round((rev / n) * 100) / 100 : 0,
    };
  });
}

/* ─── 4. Customer metrics ─────────────────────────────────────────────────── */

export interface CustomerMetrics {
  totalCustomers: number;
  newCustomersLast30d: number;
  repeatRatePct: number;
  avgBookingsPerCustomer: number;
}

export async function getCustomerMetrics(vendorId: number): Promise<CustomerMetrics> {
  const [total] = await db
    .select({ c: count(customers.id) })
    .from(customers)
    .where(eq(customers.vendorId, vendorId));

  const thirtyDaysAgo = daysAgo(30);
  const [newRow] = await db
    .select({ c: count(customers.id) })
    .from(customers)
    .where(and(eq(customers.vendorId, vendorId), gte(customers.createdAt, thirtyDaysAgo)));

  // Customers with > 1 completed booking = repeat
  const repeatRows = await db
    .select({
      customerId: bookings.customerId,
      n: count(bookings.id),
    })
    .from(bookings)
    .where(and(eq(bookings.vendorId, vendorId), eq(bookings.status, 'completed')))
    .groupBy(bookings.customerId);

  const totalBookers = repeatRows.length;
  const repeaters = repeatRows.filter((r) => Number(r.n) > 1).length;
  const totalBookings = repeatRows.reduce((s, r) => s + Number(r.n), 0);

  return {
    totalCustomers: Number(total?.c ?? 0),
    newCustomersLast30d: Number(newRow?.c ?? 0),
    repeatRatePct: totalBookers > 0 ? Math.round((repeaters / totalBookers) * 1000) / 10 : 0,
    avgBookingsPerCustomer: totalBookers > 0 ? Math.round((totalBookings / totalBookers) * 10) / 10 : 0,
  };
}

/* ─── 5. Employee productivity ────────────────────────────────────────────── */

export interface EmployeeProductivity {
  employeeName: string;
  bookingsCompleted: number;
  avgRating: number;
  revenue: number;
}

export async function getEmployeeProductivity(
  vendorId: number,
  periodDays = 30,
): Promise<EmployeeProductivity[]> {
  const from = daysAgo(periodDays);
  const rows = await db
    .select({
      employeeName: users.name,
      bookingsCompleted: count(bookings.id),
      avgRating: sql<string>`coalesce(avg(${bookings.rating}), 0)`,
      revenue: sql<string>`coalesce(sum(cast(${bookings.totalPrice} as numeric)), 0)`,
    })
    .from(bookings)
    .innerJoin(users, eq(bookings.employeeId, users.id))
    .where(and(
      eq(bookings.vendorId, vendorId),
      eq(bookings.status, 'completed'),
      gte(bookings.createdAt, from),
    ))
    .groupBy(users.name)
    .orderBy(desc(count(bookings.id)));

  return rows.map((r) => ({
    employeeName: r.employeeName ?? 'غير معروف',
    bookingsCompleted: Number(r.bookingsCompleted),
    avgRating: Math.round(Number(r.avgRating) * 10) / 10,
    revenue: Math.round(Number(r.revenue) * 100) / 100,
  }));
}

/* ─── 6. Peak hours / days ────────────────────────────────────────────────── */

export interface PeakPattern {
  hour: number;
  day: number; // 0=Sun … 6=Sat
  bookings: number;
}

export async function getPeakPattern(vendorId: number, periodDays = 90): Promise<PeakPattern[]> {
  const from = daysAgo(periodDays);
  const rows = await db
    .select({
      hour: sql<number>`extract(hour from ${bookings.scheduledAt})::int`,
      day: sql<number>`extract(dow from ${bookings.scheduledAt})::int`,
      bookings: count(bookings.id),
    })
    .from(bookings)
    .where(and(
      eq(bookings.vendorId, vendorId),
      gte(bookings.createdAt, from),
    ))
    .groupBy(sql`extract(hour from ${bookings.scheduledAt})`, sql`extract(dow from ${bookings.scheduledAt})`)
    .orderBy(desc(count(bookings.id)))
    .limit(12);

  return rows.map((r) => ({
    hour: Number(r.hour),
    day: Number(r.day),
    bookings: Number(r.bookings),
  }));
}

/* ─── 7. Vendor basics (industry etc.) ────────────────────────────────────── */

export async function getVendorBasics(vendorId: number) {
  const [v] = await db
    .select({
      id: vendors.id,
      nameAr: vendors.nameAr,
      industry: vendors.industry,
      city: vendors.city,
      subscriptionStatus: vendors.subscriptionStatus,
      settings: vendors.settings,
    })
    .from(vendors)
    .where(eq(vendors.id, vendorId))
    .limit(1);
  return v ?? null;
}

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import {
  FileText,
  Printer,
  Download,
  TrendingUp,
  Receipt,
  BadgeDollarSign,
  Calculator,
  ChevronDown,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface MonthlyReport {
  month: number;
  year: number;
  grossRevenue: number;
  vatOnRevenue: number;
  netRevenue: number;
  grossExpenses: number;
  vatOnExpenses: number;
  netVatPayable: number;
  bookingsCount: number;
  bookingsTotal: number;
  vatRate: number;
}

interface AnnualMonthEntry {
  month: number;
  income: number;
  expense: number;
  vatOnIncome: number;
  vatOnExpense: number;
  netVat: number;
}

interface AnnualTotals {
  income: number;
  expense: number;
  vatOnIncome: number;
  vatOnExpense: number;
  netVat: number;
}

interface AnnualReport {
  year: number;
  months: AnnualMonthEntry[];
  totals: AnnualTotals;
}

type Tab = 'monthly' | 'annual';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(value: number | undefined): string {
  if (value === undefined || value === null) return '—';
  return new Intl.NumberFormat('ar-SA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function fmtSAR(value: number | undefined): string {
  if (value === undefined || value === null) return '—';
  return `${fmt(value)} ر.س`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface SelectProps {
  value: number;
  onChange: (val: number) => void;
  options: { value: number; label: string }[];
  className?: string;
}

function Select({ value, onChange, options, className = '' }: SelectProps) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="
          appearance-none w-full bg-white/5 border border-white/10 rounded-xl
          px-4 py-2.5 pr-10 text-white text-sm focus:outline-none
          focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30
          cursor-pointer transition-colors hover:bg-white/8
        "
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-[#0d1526] text-white">
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  loading?: boolean;
}

function StatCard({ icon, label, value, sub, accent = 'text-blue-400', loading }: StatCardProps) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-xl bg-white/5 ${accent.replace('text-', 'text-')}`}>
          {icon}
        </div>
        <span className="text-sm text-white/50">{label}</span>
      </div>
      {loading ? (
        <div className="space-y-2">
          <div className="h-7 w-3/4 bg-white/10 rounded-lg animate-pulse" />
          {sub !== undefined && <div className="h-4 w-1/2 bg-white/5 rounded-lg animate-pulse" />}
        </div>
      ) : (
        <>
          <p className={`text-2xl font-bold ${accent}`}>{value}</p>
          {sub && <p className="text-xs text-white/40">{sub}</p>}
        </>
      )}
    </div>
  );
}

function TableSkeleton({ rows = 3, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-b border-white/5">
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="px-4 py-3">
              <div className="h-4 bg-white/10 rounded animate-pulse" style={{ width: `${60 + Math.random() * 30}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ─── Monthly View ─────────────────────────────────────────────────────────────

interface MonthlyViewProps {
  token: string | null;
}

function MonthlyView({ token }: MonthlyViewProps) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const monthOptions = MONTH_NAMES.map((label, i) => ({ value: i + 1, label }));
  const yearOptions = YEARS.map((y) => ({ value: y, label: String(y) }));

  const { data, isLoading, isError } = useQuery<MonthlyReport>({
    queryKey: ['vat-report-monthly', month, year],
    queryFn: async () => {
      const { data } = await axios.get(`/api/vat-report?month=${month}&year=${year}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return data;
    },
    enabled: !!token,
  });

  const vatRate = data?.vatRate ?? 15;

  const handlePrint = () => window.print();

  const exportUrl = `/api/exports/financials?month=${month}&year=${year}`;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={month} onChange={setMonth} options={monthOptions} className="w-40" />
        <Select value={year} onChange={setYear} options={yearOptions} className="w-28" />
        <span className="text-sm text-white/40 mr-auto">
          {MONTH_NAMES[month - 1]} {year}
        </span>
      </div>

      {/* Error */}
      {isError && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>تعذّر تحميل بيانات التقرير. يرجى المحاولة مرة أخرى.</span>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 print:grid-cols-4">
        <StatCard
          icon={<TrendingUp className="w-5 h-5 text-blue-400" />}
          label="إجمالي الإيراد"
          value={fmtSAR(data?.grossRevenue)}
          sub={`${data?.bookingsCount ?? '—'} حجز`}
          accent="text-blue-400"
          loading={isLoading}
        />
        <StatCard
          icon={<Receipt className="w-5 h-5 text-amber-400" />}
          label={`ضريبة القيمة المضافة (${vatRate}%)`}
          value={fmtSAR(data?.vatOnRevenue)}
          sub="على الإيرادات"
          accent="text-amber-400"
          loading={isLoading}
        />
        <StatCard
          icon={<BadgeDollarSign className="w-5 h-5 text-emerald-400" />}
          label="صافي الإيراد"
          value={fmtSAR(data?.netRevenue)}
          sub="بعد استبعاد الضريبة"
          accent="text-emerald-400"
          loading={isLoading}
        />
        <StatCard
          icon={<Calculator className="w-5 h-5 text-rose-400" />}
          label="VAT المستحق للسداد"
          value={fmtSAR(data?.netVatPayable)}
          sub="صافي الضريبة"
          accent="text-rose-400"
          loading={isLoading}
        />
      </div>

      {/* Breakdown Table */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden print:border print:border-gray-200">
        <div className="px-6 py-4 border-b border-white/10 flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-400" />
          <h2 className="text-sm font-semibold text-white">تفاصيل الضريبة</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/3 text-white/50 text-xs uppercase tracking-wide">
                <th className="px-6 py-3 text-right font-medium">الوصف</th>
                <th className="px-6 py-3 text-left font-medium">المبلغ قبل الضريبة</th>
                <th className="px-6 py-3 text-left font-medium">الضريبة {vatRate}%</th>
                <th className="px-6 py-3 text-left font-medium">الإجمالي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <TableSkeleton rows={3} cols={4} />
              ) : (
                <>
                  <tr className="hover:bg-white/3 transition-colors">
                    <td className="px-6 py-4 text-white font-medium">إيرادات الخدمات</td>
                    <td className="px-6 py-4 text-left text-white/80 font-mono text-xs">
                      {fmtSAR(data?.netRevenue)}
                    </td>
                    <td className="px-6 py-4 text-left text-amber-400 font-mono text-xs">
                      {fmtSAR(data?.vatOnRevenue)}
                    </td>
                    <td className="px-6 py-4 text-left text-blue-400 font-mono text-xs font-semibold">
                      {fmtSAR(data?.grossRevenue)}
                    </td>
                  </tr>
                  <tr className="hover:bg-white/3 transition-colors">
                    <td className="px-6 py-4 text-white font-medium">المصروفات المدفوعة</td>
                    <td className="px-6 py-4 text-left text-white/80 font-mono text-xs">
                      {fmtSAR(
                        data ? data.grossExpenses - data.vatOnExpenses : undefined,
                      )}
                    </td>
                    <td className="px-6 py-4 text-left text-amber-400 font-mono text-xs">
                      {fmtSAR(data?.vatOnExpenses)}
                    </td>
                    <td className="px-6 py-4 text-left text-white/80 font-mono text-xs font-semibold">
                      {fmtSAR(data?.grossExpenses)}
                    </td>
                  </tr>
                  <tr className="bg-rose-500/5 hover:bg-rose-500/10 transition-colors">
                    <td className="px-6 py-4 text-white font-bold">صافي الضريبة المستحقة</td>
                    <td className="px-6 py-4 text-left text-white/40 font-mono text-xs">—</td>
                    <td className="px-6 py-4 text-left text-white/40 font-mono text-xs">—</td>
                    <td className="px-6 py-4 text-left text-rose-400 font-mono text-xs font-bold text-base">
                      {fmtSAR(data?.netVatPayable)}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 print:hidden">
        <button
          onClick={handlePrint}
          className="
            flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium
            bg-white/5 border border-white/10 text-white
            hover:bg-white/10 transition-colors
          "
        >
          <Printer className="w-4 h-4" />
          طباعة التقرير
        </button>
        <a
          href={exportUrl}
          download
          className="
            flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium
            bg-blue-600 hover:bg-blue-500 text-white transition-colors
          "
        >
          <Download className="w-4 h-4" />
          تصدير Excel
        </a>
      </div>
    </div>
  );
}

// ─── Annual View ──────────────────────────────────────────────────────────────

interface AnnualViewProps {
  token: string | null;
}

function AnnualView({ token }: AnnualViewProps) {
  const [year, setYear] = useState(CURRENT_YEAR);

  const yearOptions = YEARS.map((y) => ({ value: y, label: String(y) }));

  const { data, isLoading, isError } = useQuery<AnnualReport>({
    queryKey: ['vat-report-annual', year],
    queryFn: async () => {
      const { data } = await axios.get(`/api/vat-report/annual?year=${year}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return data;
    },
    enabled: !!token,
  });

  // Build a full 12-month array, filling missing months with zeros
  const monthsMap = new Map<number, AnnualMonthEntry>(
    (data?.months ?? []).map((m) => [m.month, m]),
  );
  const fullYear: (AnnualMonthEntry | null)[] = Array.from({ length: 12 }, (_, i) => {
    return monthsMap.get(i + 1) ?? null;
  });

  const totals = data?.totals;

  return (
    <div className="space-y-6">
      {/* Year selector */}
      <div className="flex items-center gap-3">
        <Select value={year} onChange={setYear} options={yearOptions} className="w-28" />
        <span className="text-sm text-white/40">التقرير الضريبي السنوي — {year}</span>
      </div>

      {/* Error */}
      {isError && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>تعذّر تحميل بيانات التقرير السنوي. يرجى المحاولة مرة أخرى.</span>
        </div>
      )}

      {/* Summary totals */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <StatCard
          icon={<TrendingUp className="w-5 h-5 text-blue-400" />}
          label="إجمالي الإيرادات"
          value={fmtSAR(totals?.income)}
          accent="text-blue-400"
          loading={isLoading}
        />
        <StatCard
          icon={<Receipt className="w-5 h-5 text-amber-400" />}
          label="VAT على الإيرادات"
          value={fmtSAR(totals?.vatOnIncome)}
          accent="text-amber-400"
          loading={isLoading}
        />
        <StatCard
          icon={<BadgeDollarSign className="w-5 h-5 text-purple-400" />}
          label="إجمالي المصروفات"
          value={fmtSAR(totals?.expense)}
          accent="text-purple-400"
          loading={isLoading}
        />
        <StatCard
          icon={<Receipt className="w-5 h-5 text-sky-400" />}
          label="VAT على المصروفات"
          value={fmtSAR(totals?.vatOnExpense)}
          accent="text-sky-400"
          loading={isLoading}
        />
        <StatCard
          icon={<Calculator className="w-5 h-5 text-rose-400" />}
          label="صافي VAT للسداد"
          value={fmtSAR(totals?.netVat)}
          accent="text-rose-400"
          loading={isLoading}
        />
      </div>

      {/* Monthly breakdown table */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-400" />
          <h2 className="text-sm font-semibold text-white">التوزيع الشهري — {year}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/3 text-white/50 text-xs uppercase tracking-wide">
                <th className="px-5 py-3 text-right font-medium">الشهر</th>
                <th className="px-5 py-3 text-left font-medium">الإيرادات</th>
                <th className="px-5 py-3 text-left font-medium">VAT الإيرادات</th>
                <th className="px-5 py-3 text-left font-medium">المصروفات</th>
                <th className="px-5 py-3 text-left font-medium">VAT المصروفات</th>
                <th className="px-5 py-3 text-left font-medium">صافي VAT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <TableSkeleton rows={12} cols={6} />
              ) : (
                <>
                  {fullYear.map((entry, idx) => {
                    const isCurrentMonth =
                      year === CURRENT_YEAR && idx + 1 === new Date().getMonth() + 1;
                    return (
                      <tr
                        key={idx}
                        className={`
                          hover:bg-white/3 transition-colors
                          ${isCurrentMonth ? 'bg-blue-500/5' : ''}
                          ${entry === null ? 'opacity-40' : ''}
                        `}
                      >
                        <td className="px-5 py-3 text-white font-medium">
                          {MONTH_NAMES[idx]}
                          {isCurrentMonth && (
                            <span className="mr-2 text-[10px] px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded-full">
                              الحالي
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-left text-white/80 font-mono text-xs">
                          {fmtSAR(entry?.income)}
                        </td>
                        <td className="px-5 py-3 text-left text-amber-400 font-mono text-xs">
                          {fmtSAR(entry?.vatOnIncome)}
                        </td>
                        <td className="px-5 py-3 text-left text-white/60 font-mono text-xs">
                          {fmtSAR(entry?.expense)}
                        </td>
                        <td className="px-5 py-3 text-left text-sky-400 font-mono text-xs">
                          {fmtSAR(entry?.vatOnExpense)}
                        </td>
                        <td
                          className={`px-5 py-3 text-left font-mono text-xs font-semibold ${
                            (entry?.netVat ?? 0) >= 0 ? 'text-rose-400' : 'text-emerald-400'
                          }`}
                        >
                          {fmtSAR(entry?.netVat)}
                        </td>
                      </tr>
                    );
                  })}

                  {/* Totals row */}
                  <tr className="bg-white/8 border-t-2 border-white/20 font-bold">
                    <td className="px-5 py-4 text-white">الإجمالي السنوي</td>
                    <td className="px-5 py-4 text-left text-blue-400 font-mono text-xs">
                      {fmtSAR(totals?.income)}
                    </td>
                    <td className="px-5 py-4 text-left text-amber-400 font-mono text-xs">
                      {fmtSAR(totals?.vatOnIncome)}
                    </td>
                    <td className="px-5 py-4 text-left text-white/80 font-mono text-xs">
                      {fmtSAR(totals?.expense)}
                    </td>
                    <td className="px-5 py-4 text-left text-sky-400 font-mono text-xs">
                      {fmtSAR(totals?.vatOnExpense)}
                    </td>
                    <td className="px-5 py-4 text-left text-rose-400 font-mono text-xs">
                      {fmtSAR(totals?.netVat)}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function VatReport() {
  const { token } = useAuth();
  const [tab, setTab] = useState<Tab>('monthly');

  const tabs: { value: Tab; label: string }[] = [
    { value: 'monthly', label: 'شهري' },
    { value: 'annual', label: 'سنوي' },
  ];

  return (
    <div className="min-h-screen bg-surface-1 text-white" dir="rtl">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/20 rounded-xl">
              <FileText className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">تقرير ضريبة القيمة المضافة</h1>
              <p className="text-sm text-white/40 mt-0.5">ZATCA VAT Report — 15%</p>
            </div>
          </div>

          {/* Tab selector */}
          <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-1 w-fit">
            {tabs.map((t) => (
              <button
                key={t.value}
                onClick={() => setTab(t.value)}
                className={`
                  px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200
                  ${tab === t.value
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                    : 'text-white/50 hover:text-white/80'}
                `}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        {tab === 'monthly' ? (
          <MonthlyView token={token} />
        ) : (
          <AnnualView token={token} />
        )}

        {/* Footer note */}
        <div className="flex items-start gap-3 bg-amber-500/5 border border-amber-500/15 rounded-xl px-5 py-4 print:border print:border-amber-200">
          <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300/70 leading-relaxed">
            جميع الأسعار تشمل ضريبة القيمة المضافة 15% وفقاً لأنظمة هيئة الزكاة والضريبة والجمارك
          </p>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          .print\\:hidden { display: none !important; }
          .bg-\\[\\#040812\\] { background: white !important; }
        }
      `}</style>
    </div>
  );
}

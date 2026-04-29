import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Activity, Database, Server, Clock, Cpu, HardDrive, CheckCircle, XCircle } from 'lucide-react';
import api from '../../lib/api';

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d} يوم ${h} ساعة ${m} دقيقة`;
}

function formatBytes(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

export default function Health() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-health'],
    queryFn: () => api.get('/super-admin/health').then(r => r.data),
    refetchInterval: 30000,
  });

  const isHealthy = data?.status === 'healthy';
  const mem = data?.memoryUsage;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-white flex items-center gap-2">
          <Activity className="w-5 h-5 text-emerald-400" /> صحة النظام
        </h2>
        <button onClick={() => refetch()} className="text-xs text-slate-500 hover:text-white transition-colors">تحديث</button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[1,2,3,4].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}</div>
      ) : (
        <>
          {/* Status banner */}
          <div className={`flex items-center gap-3 p-4 rounded-xl border ${isHealthy ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
            {isHealthy ? <CheckCircle className="w-6 h-6 text-emerald-400" /> : <XCircle className="w-6 h-6 text-red-400" />}
            <div>
              <p className={`font-bold ${isHealthy ? 'text-emerald-400' : 'text-red-400'}`}>{isHealthy ? 'النظام يعمل بشكل طبيعي' : 'يوجد مشكلة في النظام'}</p>
              <p className="text-xs text-slate-500">{new Date(data.timestamp).toLocaleString('ar-SA')}</p>
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { icon: Server, label: 'وقت التشغيل', value: formatUptime(data.uptime), color: 'text-blue-400' },
              { icon: Database, label: 'قاعدة البيانات', value: data.database === 'connected' ? 'متصلة' : 'منقطعة', color: data.database === 'connected' ? 'text-emerald-400' : 'text-red-400' },
              { icon: Cpu, label: 'Node.js', value: data.nodeVersion, color: 'text-purple-400' },
              { icon: HardDrive, label: 'البيئة', value: data.environment, color: 'text-amber-400' },
            ].map((m, i) => (
              <motion.div key={m.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                <m.icon className={`w-5 h-5 ${m.color} mb-2`} />
                <p className="text-sm font-bold text-white">{m.value}</p>
                <p className="text-xs text-slate-500">{m.label}</p>
              </motion.div>
            ))}
          </div>

          {/* Memory */}
          {mem && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
              <h3 className="font-bold text-white text-sm mb-3">استهلاك الذاكرة</h3>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'RSS', value: formatBytes(mem.rss) },
                  { label: 'Heap Used', value: formatBytes(mem.heapUsed) },
                  { label: 'Heap Total', value: formatBytes(mem.heapTotal) },
                ].map(m => (
                  <div key={m.label}>
                    <p className="text-lg font-black text-white">{m.value}</p>
                    <p className="text-xs text-slate-500">{m.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-center">
              <p className="text-2xl font-black text-white">{data.activeVendors}</p>
              <p className="text-xs text-slate-500">تجار نشطين</p>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-center">
              <p className="text-2xl font-black text-white">{data.totalUsers}</p>
              <p className="text-xs text-slate-500">إجمالي المستخدمين</p>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-center">
              <p className="text-2xl font-black text-white">{data.todayBookings}</p>
              <p className="text-xs text-slate-500">حجوزات اليوم</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

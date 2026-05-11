import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Phone, Car, Users } from 'lucide-react';
import api from '../../lib/api';
import { Customer } from '../../types';
import { formatDate } from '../../lib/utils';
import { useIndustryFlags } from '../../hooks/useIndustryFlags';
import { Stagger, StaggerItem } from '../../components/ui/Stagger';
import { MotivationalEmpty } from '../../components/ui/MotivationalEmpty';
import { LastUpdated } from '../../components/ui/TrustSignals';

export default function AdminCustomers() {
  const [search, setSearch] = useState('');
  const flags = useIndustryFlags();

  const { data: customers = [], isLoading, dataUpdatedAt } = useQuery<Customer[]>({
    queryKey: ['customers'],
    queryFn: () => api.get('/customers').then(r => r.data),
  });

  const filtered = customers.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.vehiclePlate?.toLowerCase().includes(q);
  });

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-5" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-white">العملاء</h1>
        <div className="badge bg-brand-700/30 text-brand-300 border-brand-700/30">{customers.length} عميل</div>
      </div>

      <div className="relative">
        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={flags.vehicleFieldsEnabled
            ? 'بحث بالاسم، الجوال، أو رقم اللوحة...'
            : 'بحث بالاسم أو الجوال...'}
          className="input-field pr-9"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="card animate-pulse h-16" />)}</div>
      ) : (
        <Stagger>
          <div className="space-y-3">
            {filtered.map((customer) => (
              <StaggerItem key={customer.id}>
                <div className="card">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-black text-white">{customer.name}</h3>
                    {!customer.isActive && <span className="badge bg-red-500/20 text-red-400 border-red-500/30 text-xs">موقوف</span>}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-400">
                    <span className="flex items-center gap-1">
                      <Phone size={12} /> {customer.phone}
                    </span>
                    {customer.vehiclePlate && (
                      <span className="flex items-center gap-1">
                        <Car size={12} /> {customer.vehicleType} - {customer.vehiclePlate}
                      </span>
                    )}
                  </div>
                  {customer.vehicleModel && (
                    <p className="text-xs text-slate-500 mt-1">{customer.vehicleModel} {customer.vehicleColor && `· ${customer.vehicleColor}`}</p>
                  )}
                </div>
                <div className="text-left shrink-0">
                  <p className="text-xs text-slate-400">{formatDate(customer.createdAt)}</p>
                  <a
                    href={`tel:${customer.phone}`}
                    className="text-xs text-brand-400 hover:text-brand-300 block mt-1"
                  >
                    اتصل
                  </a>
                </div>
              </div>
                </div>
              </StaggerItem>
            ))}

            {filtered.length === 0 && (
              <MotivationalEmpty
                icon={Users}
                accent="blue"
                title={search ? 'لا نتائج لبحثك' : 'ما عندك عملاء حتى الآن — وهذي فرصة'}
                body={search ? undefined : 'كل عميل تستقبله الآن يصبح قاعدة عملاء دائمة. ابدأ بحجز يدوي أو شارك رابط متجرك.'}
              />
            )}
          </div>
        </Stagger>
      )}

      <LastUpdated at={dataUpdatedAt ? new Date(dataUpdatedAt) : null} />
    </div>
  );
}

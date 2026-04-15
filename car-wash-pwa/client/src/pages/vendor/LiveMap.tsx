import { useEffect, useRef, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Users, Car, RefreshCw } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

declare global {
  interface Window {
    L: any;
    _leafletLoaded: boolean;
  }
}

function loadLeaflet(): Promise<void> {
  if (window._leafletLoaded) return Promise.resolve();
  return new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => {
      window._leafletLoaded = true;
      resolve();
    };
    document.head.appendChild(script);
  });
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'قيد الانتظار',
  confirmed: 'مؤكد',
  on_way: 'في الطريق',
  in_progress: 'جارٍ التنفيذ',
  arrived: 'وصل',
  completed: 'مكتمل',
  available: 'متاح',
};

// Determine marker color for an on-duty employee
function getEmployeeColor(emp: any): string {
  if (!emp.isOnDuty) return '#6b7280'; // gray — off duty
  if (emp.activeBooking) return '#eab308'; // yellow — busy
  return '#22c55e'; // green — available
}

export default function LiveMap() {
  const { token } = useAuth();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<Record<number, any>>({});
  const [mapReady, setMapReady] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Poll active tracking (existing endpoint)
  const { data: trackingData, refetch: refetchTracking } = useQuery({
    queryKey: ['tracking-vendor-active', refreshKey],
    queryFn: async () => {
      const { data } = await axios.get('/api/tracking/vendor/active', {
        headers: { Authorization: `Bearer ${token}` },
      });
      return data;
    },
    enabled: !!token && mapReady,
    refetchInterval: 10000,
  });

  // Fetch on-duty employees with active bookings
  const { data: onDutyData = [], refetch: refetchOnDuty } = useQuery({
    queryKey: ['employees-on-duty', refreshKey],
    queryFn: async () => {
      const { data } = await axios.get('/api/employees/on-duty', {
        headers: { Authorization: `Bearer ${token}` },
      });
      return data as any[];
    },
    enabled: !!token && mapReady,
    refetchInterval: 10000,
  });

  const trackingEmployees: any[] = trackingData?.employees ?? [];
  const activeBookingsCount: number = trackingData?.activeBookingsCount ?? 0;

  // Merge on-duty data with tracking data by employee id
  const onDutyMap: Record<number, any> = {};
  onDutyData.forEach((e: any) => { onDutyMap[e.id] = e; });

  const mergedEmployees = trackingEmployees.map((te: any) => ({
    ...te,
    isOnDuty: onDutyMap[te.id]?.isOnDuty ?? false,
    activeBooking: onDutyMap[te.id]?.activeBooking ?? null,
  }));

  // Also include on-duty employees that may not have location in tracking yet
  const trackedIds = new Set(trackingEmployees.map((te: any) => te.id));
  const onDutyOnlyEmployees = onDutyData.filter((e: any) => !trackedIds.has(e.id) && e.location);
  const allEmployees = [
    ...mergedEmployees,
    ...onDutyOnlyEmployees.map((e: any) => ({
      id: e.id,
      nameAr: e.name,
      name: e.name,
      phone: e.phone,
      lat: e.location?.lat ?? null,
      lng: e.location?.lng ?? null,
      isOnDuty: e.isOnDuty,
      activeBooking: e.activeBooking,
      currentBookingStatus: e.activeBooking?.status ?? null,
    })),
  ];

  // Legend counts
  const availableCount = onDutyData.filter((e: any) => e.isOnDuty && !e.activeBooking).length;
  const busyCount = onDutyData.filter((e: any) => e.isOnDuty && e.activeBooking).length;
  // Off-duty = tracking employees who are NOT in onDutyData
  const offDutyCount = trackingEmployees.filter((te: any) => !onDutyMap[te.id]?.isOnDuty).length;

  const handleRefresh = useCallback(() => {
    setRefreshKey(k => k + 1);
    refetchTracking();
    refetchOnDuty();
  }, [refetchTracking, refetchOnDuty]);

  // Load Leaflet and init map
  useEffect(() => {
    let cancelled = false;

    loadLeaflet().then(() => {
      if (cancelled || !mapRef.current || mapInstanceRef.current) return;
      const L = window.L;

      const map = L.map(mapRef.current, {
        center: [24.7136, 46.6753],
        zoom: 11,
        zoomControl: false,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '©OpenStreetMap ©CartoDB',
        subdomains: 'abcd',
        maxZoom: 20,
      }).addTo(map);

      L.control.zoom({ position: 'bottomleft' }).addTo(map);

      mapInstanceRef.current = map;
      setMapReady(true);
    });

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update markers when data changes
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !allEmployees.length) return;
    const L = window.L;
    const map = mapInstanceRef.current;

    const seenIds = new Set<number>();

    allEmployees.forEach((emp: any) => {
      if (!emp.lat || !emp.lng) return;
      seenIds.add(emp.id);

      const initial = (emp.nameAr ?? emp.name ?? 'م').charAt(0);
      const color = getEmployeeColor(emp);
      const borderColor = emp.isOnDuty
        ? (emp.activeBooking ? '#fde68a' : '#86efac')
        : '#9ca3af';

      const iconHtml = `
        <div style="
          width:36px; height:36px; border-radius:50%;
          background:${color}; border:3px solid ${borderColor};
          display:flex; align-items:center; justify-content:center;
          color:white; font-weight:bold; font-size:14px;
          box-shadow:0 2px 10px ${color}99;
          cursor:pointer;
        ">${initial}</div>`;

      const icon = L.divIcon({ html: iconHtml, className: '', iconSize: [36, 36], iconAnchor: [18, 18] });

      const statusLabel = emp.activeBooking
        ? STATUS_LABEL[emp.activeBooking.status] ?? emp.activeBooking.status
        : (emp.isOnDuty ? 'متاح' : 'خارج الدوام');

      const popupHtml = `
        <div dir="rtl" style="font-family:system-ui;min-width:180px;padding:4px;">
          <p style="font-weight:bold;color:#1e293b;margin:0 0 4px;font-size:14px">${emp.nameAr ?? emp.name ?? '—'}</p>
          <p style="color:#64748b;font-size:12px;margin:0 0 4px">${emp.phone ?? ''}</p>
          <p style="font-size:12px;margin:0 0 6px">
            <span style="padding:2px 8px;border-radius:12px;background:${color}22;color:${color};font-weight:600">${statusLabel}</span>
          </p>
          ${emp.activeBooking ? `<p style="font-size:11px;color:#475569;margin:0 0 4px">حجز: #${emp.activeBooking.bookingNumber}</p>` : ''}
          <a href="/vendor/dispatch" style="font-size:11px;color:#2563eb;text-decoration:underline">تعيين حجز ←</a>
        </div>`;

      if (markersRef.current[emp.id]) {
        markersRef.current[emp.id].setLatLng([emp.lat, emp.lng]);
        markersRef.current[emp.id].setPopupContent(popupHtml);
        markersRef.current[emp.id].setIcon(icon);
      } else {
        const marker = L.marker([emp.lat, emp.lng], { icon })
          .bindPopup(popupHtml)
          .addTo(map);
        marker.on('click', () => setSelectedEmp(emp));
        markersRef.current[emp.id] = marker;
      }
    });

    // Remove stale markers
    Object.keys(markersRef.current).forEach((idStr) => {
      const id = Number(idStr);
      if (!seenIds.has(id)) {
        map.removeLayer(markersRef.current[id]);
        delete markersRef.current[id];
      }
    });
  }, [allEmployees, mapReady]);

  return (
    <div className="min-h-screen bg-surface-1 text-white flex flex-col" dir="rtl">
      {/* Top header */}
      <div className="px-4 pt-6 pb-3 flex items-center gap-3">
        <div className="p-2 bg-blue-600/20 rounded-xl">
          <Users className="w-6 h-6 text-blue-400" />
        </div>
        <h1 className="text-2xl font-bold text-white ml-auto">الخريطة المباشرة</h1>
        <div className="flex items-center gap-2">
          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 bg-slate-800/80 border border-slate-700/50 rounded-xl px-3 py-2 hover:bg-slate-700/80 transition-colors"
            title="تحديث"
          >
            <RefreshCw className="w-4 h-4 text-slate-300" />
          </button>
          <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/50 rounded-xl px-3 py-2">
            <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-sm text-slate-300">
              <span className="font-bold text-white">{allEmployees.length}</span> موظف نشط
            </span>
          </div>
          <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/50 rounded-xl px-3 py-2">
            <Car className="w-4 h-4 text-orange-400" />
            <span className="text-sm text-slate-300">
              <span className="font-bold text-white">{activeBookingsCount}</span> حجز جارٍ
            </span>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 mx-4 mb-4 rounded-2xl overflow-hidden border border-slate-700/50 relative" style={{ minHeight: 500 }}>
        <div ref={mapRef} className="w-full h-full" style={{ minHeight: 500 }} />

        {!mapReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Availability legend — top right */}
        <div className="absolute top-4 left-4 bg-slate-900/90 backdrop-blur border border-slate-700/50 rounded-xl p-3 z-[1000] space-y-1.5">
          <p className="text-white text-xs font-semibold mb-2">حالة الموظفين</p>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500 shrink-0" />
            <span className="text-slate-300 text-xs">متاح للعمل ({availableCount} موظف)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500 shrink-0" />
            <span className="text-slate-300 text-xs">مشغول بحجز ({busyCount} موظف)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-500 shrink-0" />
            <span className="text-slate-300 text-xs">خارج الدوام ({offDutyCount} موظف)</span>
          </div>
        </div>

        {/* Old legend replaced above */}
      </div>

      {/* Employee card popup on click */}
      {selectedEmp && (
        <div className="mx-4 mb-4 bg-slate-800/90 border border-slate-700/50 rounded-2xl p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-black text-white text-lg">{selectedEmp.nameAr ?? selectedEmp.name}</h3>
              <p className="text-slate-400 text-sm">{selectedEmp.phone}</p>
            </div>
            <button
              onClick={() => setSelectedEmp(null)}
              className="text-slate-400 hover:text-white text-xl leading-none"
            >
              ×
            </button>
          </div>

          {/* Status badge */}
          <div className="flex items-center gap-2 mb-3">
            <span
              className="px-3 py-1 rounded-full text-sm font-semibold"
              style={{
                background: `${getEmployeeColor(selectedEmp)}22`,
                color: getEmployeeColor(selectedEmp),
              }}
            >
              {selectedEmp.isOnDuty
                ? (selectedEmp.activeBooking ? 'مشغول بحجز' : 'متاح للعمل')
                : 'خارج الدوام'}
            </span>
          </div>

          {selectedEmp.activeBooking && (
            <p className="text-slate-300 text-sm mb-3">
              الحجز الحالي: <span className="font-bold">#{selectedEmp.activeBooking.bookingNumber}</span>
            </p>
          )}

          <Link
            to="/vendor/dispatch"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            تعيين حجز ←
          </Link>
        </div>
      )}
    </div>
  );
}

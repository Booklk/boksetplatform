import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone, MessageCircle, Navigation, MapPin, Clock,
  User, AlertCircle, Loader2, ArrowRight, Wifi, WifiOff,
  RefreshCw, CheckCircle
} from 'lucide-react';
import api from '../../lib/api';

/* ─── types ─────────────────────────────────────────────────── */
interface Booking {
  id: string;
  bookingNumber: string;
  status: string;
  employee?: { id: string; name: string; phone: string };
  address?: string;
  lat?: number | string;
  lng?: number | string;
  scheduledAt?: string;
  service?: { name: string };
  package?: { name: string };
  vendor?: { name: string };
}

interface TrackingPayload {
  lat?: number;
  lng?: number;
  location?: { lat: number | string; lng: number | string };
  updatedAt?: string;
}

interface LiveTrackingPayload {
  vehicleLat: number | null;
  vehicleLng: number | null;
  vehicleName: string | null;
  employeeName: string;
  employeePhone: string | null;
  status: string;
  eta_minutes: number | null;
  customerLat: number | null;
  customerLng: number | null;
  distance_km: number | null;
}

interface EmployeeLoc { lat: number; lng: number }

/* ─── status config ──────────────────────────────────────────── */
const STATUS_CFG: Record<string, { label: string; colorCls: string; bgCls: string; dotCls: string }> = {
  pending:     { label: 'قيد الانتظار',  colorCls: 'text-yellow-400', bgCls: 'bg-yellow-400/10 border-yellow-400/30',  dotCls: 'bg-yellow-400' },
  confirmed:   { label: 'مؤكد',          colorCls: 'text-blue-400',   bgCls: 'bg-blue-400/10 border-blue-400/30',      dotCls: 'bg-blue-400' },
  on_way:      { label: 'في الطريق',     colorCls: 'text-cyan-400',   bgCls: 'bg-cyan-400/10 border-cyan-400/30',      dotCls: 'bg-cyan-400' },
  arrived:     { label: 'وصل',           colorCls: 'text-green-400',  bgCls: 'bg-green-400/10 border-green-400/30',    dotCls: 'bg-green-400' },
  in_progress: { label: 'جاري الغسيل',  colorCls: 'text-purple-400', bgCls: 'bg-purple-400/10 border-purple-400/30',  dotCls: 'bg-purple-400' },
  done:        { label: 'منتهي',         colorCls: 'text-slate-300',  bgCls: 'bg-slate-400/10 border-slate-400/30',    dotCls: 'bg-slate-400' },
  completed:   { label: 'مكتمل',         colorCls: 'text-emerald-400',bgCls: 'bg-emerald-400/10 border-emerald-400/30',dotCls: 'bg-emerald-400' },
  cancelled:   { label: 'ملغي',          colorCls: 'text-red-400',    bgCls: 'bg-red-400/10 border-red-400/30',        dotCls: 'bg-red-400' },
};

/* ─── Leaflet loader ─────────────────────────────────────────── */
declare global {
  interface Window { L: any; _mapLoaded: boolean }
}

function loadLeaflet(): Promise<void> {
  if (window._mapLoaded) return Promise.resolve();
  return new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => { window._mapLoaded = true; resolve(); };
    document.head.appendChild(script);
  });
}

const DARK_TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

const CUSTOMER_ICON_HTML = `
  <div style="width:36px;height:36px;background:linear-gradient(135deg,#3b82f6,#06b6d4);border-radius:50%;border:3px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(59,130,246,0.55)">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
    </svg>
  </div>`;

const EMPLOYEE_ICON_HTML = `
  <div style="width:42px;height:42px;background:linear-gradient(135deg,#ef4444,#f97316);border-radius:50%;border:3px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(239,68,68,0.65)">
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="white">
      <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
    </svg>
  </div>`;

/* ══════════════════════════════════════════════════════════════
     MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
export default function LiveTracking() {
  const { bookingId, token } = useParams<{ bookingId: string; token?: string }>();
  const navigate = useNavigate();
  // When accessed via public /track/:bookingId/:token route
  const isPublicRoute = !!token;

  const mapRef            = useRef<HTMLDivElement>(null);
  const mapInstanceRef    = useRef<any>(null);
  const customerMarkerRef = useRef<any>(null);
  const employeeMarkerRef = useRef<any>(null);
  const routeLineRef      = useRef<any>(null);
  const wsRef             = useRef<WebSocket | null>(null);

  const [employeeLoc, setEmployeeLoc]   = useState<EmployeeLoc | null>(null);
  const [wsConnected, setWsConnected]   = useState(false);
  const [mapReady, setMapReady]         = useState(false);
  const [lastUpdate, setLastUpdate]     = useState<Date | null>(null);

  const [liveServerEta, setLiveServerEta] = useState<number | null>(null);
  const [liveVehicleName, setLiveVehicleName] = useState<string | null>(null);
  const [liveEmployeeName, setLiveEmployeeName] = useState<string | null>(null);
  const [liveEmployeePhone, setLiveEmployeePhone] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);

  /* ── fetch booking (skipped for public token route — use live endpoint instead) ── */
  const {
    data: booking,
    isLoading: bookingLoading,
    isError: bookingError,
    refetch: refetchBooking,
  } = useQuery<Booking>({
    queryKey: ['booking-tracking', bookingId],
    queryFn: () => api.get(`/bookings/${bookingId}`).then(r => r.data),
    enabled: !!bookingId && !isPublicRoute,
    refetchInterval: 30_000,
  });

  /* ── poll live endpoint every 5 s (public token route) ── */
  const { data: liveData, isLoading: liveLoading, isError: liveError } = useQuery<LiveTrackingPayload>({
    queryKey: ['tracking-live', bookingId, token],
    queryFn: () => api.get(`/tracking/booking/${bookingId}/live`, { params: { token } }).then(r => r.data),
    enabled: !!bookingId && isPublicRoute,
    refetchInterval: 5_000,
    retry: false,
  });

  useEffect(() => {
    if (!liveData) return;
    if (liveData.vehicleLat !== null && liveData.vehicleLng !== null) {
      setEmployeeLoc({ lat: liveData.vehicleLat!, lng: liveData.vehicleLng! });
      setLastUpdate(new Date());
    }
    setLiveServerEta(liveData.eta_minutes);
    setLiveVehicleName(liveData.vehicleName);
    setLiveEmployeeName(liveData.employeeName);
    setLiveEmployeePhone(liveData.employeePhone);
    setLiveStatus(liveData.status);
  }, [liveData]);

  /* ── poll REST tracking every 5 s (authenticated route) ── */
  const { data: trackingData } = useQuery<TrackingPayload>({
    queryKey: ['tracking', bookingId],
    queryFn: () => api.get(`/tracking/booking/${bookingId}`).then(r => r.data),
    enabled: !!bookingId && !isPublicRoute,
    refetchInterval: 5_000,
    retry: false,
  });

  useEffect(() => {
    if (!trackingData) return;
    // support both { lat, lng } and { location: { lat, lng } }
    const lat = trackingData.lat ?? (trackingData.location?.lat);
    const lng = trackingData.lng ?? (trackingData.location?.lng);
    if (lat != null && lng != null) {
      setEmployeeLoc({ lat: parseFloat(String(lat)), lng: parseFloat(String(lng)) });
      setLastUpdate(new Date());
    }
  }, [trackingData]);

  /* ── WebSocket ── */
  useEffect(() => {
    if (!bookingId) return;
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
    let ws: WebSocket;

    try {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        ws.send(JSON.stringify({ type: 'join', room: `booking:${bookingId}` }));
      };
      ws.onclose  = () => setWsConnected(false);
      ws.onerror  = () => setWsConnected(false);
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'location' && msg.lat != null && msg.lng != null) {
            setEmployeeLoc({ lat: msg.lat, lng: msg.lng });
            setLastUpdate(new Date());
          }
          if (msg.type === 'status_update') refetchBooking();
        } catch { /* ignore */ }
      };
    } catch { /* ws unavailable */ }

    return () => wsRef.current?.close();
  }, [bookingId]);

  /* ── init map ── */
  useEffect(() => {
    let mounted = true;
    loadLeaflet().then(() => {
      if (!mounted || !mapRef.current || mapInstanceRef.current) return;
      const L = window.L;

      const lat = (isPublicRoute ? liveData?.customerLat : (booking?.lat ? parseFloat(String(booking.lat)) : null)) ?? 24.82;
      const lng = (isPublicRoute ? liveData?.customerLng : (booking?.lng ? parseFloat(String(booking.lng)) : null)) ?? 46.62;

      const map = L.map(mapRef.current, { zoomControl: false, attributionControl: false })
        .setView([lat, lng], 14);

      L.tileLayer(DARK_TILES, { maxZoom: 19 }).addTo(map);
      L.control.zoom({ position: 'topleft' }).addTo(map);

      mapInstanceRef.current = map;
      setMapReady(true);
    });
    return () => { mounted = false; };
  }, []);

  /* ── customer marker (when booking data ready) ── */
  useEffect(() => {
    const custLat = isPublicRoute ? liveData?.customerLat : (booking?.lat ? parseFloat(String(booking.lat)) : null);
    const custLng = isPublicRoute ? liveData?.customerLng : (booking?.lng ? parseFloat(String(booking.lng)) : null);
    if (!mapReady || custLat == null || custLng == null) return;
    const L   = window.L;
    const map = mapInstanceRef.current;
    const lat = custLat;
    const lng = custLng;
    const icon = L.divIcon({ html: CUSTOMER_ICON_HTML, className: '', iconSize: [36, 36], iconAnchor: [18, 18] });

    if (customerMarkerRef.current) {
      customerMarkerRef.current.setLatLng([lat, lng]);
    } else {
      customerMarkerRef.current = L.marker([lat, lng], { icon })
        .addTo(map)
        .bindPopup('<div style="direction:rtl;font-weight:700;font-size:13px">موقع العميل</div>');
      map.setView([lat, lng], 14);
    }
  }, [mapReady, booking?.lat, booking?.lng, liveData?.customerLat, liveData?.customerLng, isPublicRoute]);

  /* ── employee marker ── */
  const updateEmployeeMarker = useCallback((loc: EmployeeLoc) => {
    if (!mapReady) return;
    const L   = window.L;
    const map = mapInstanceRef.current;
    if (!map) return;

    const icon = L.divIcon({ html: EMPLOYEE_ICON_HTML, className: '', iconSize: [42, 42], iconAnchor: [21, 21] });

    if (employeeMarkerRef.current) {
      employeeMarkerRef.current.setLatLng([loc.lat, loc.lng]);
    } else {
      employeeMarkerRef.current = L.marker([loc.lat, loc.lng], { icon })
        .addTo(map)
        .bindPopup('<div style="direction:rtl;font-weight:700;font-size:13px">موقع الموظف</div>');
    }

    const custLatLng = customerMarkerRef.current?.getLatLng();
    if (custLatLng) {
      const latlngs = [[loc.lat, loc.lng], [custLatLng.lat, custLatLng.lng]];
      if (routeLineRef.current) {
        routeLineRef.current.setLatLngs(latlngs);
      } else {
        routeLineRef.current = L.polyline(latlngs, {
          color: '#3b82f6', weight: 2.5, opacity: 0.7, dashArray: '9 6',
        }).addTo(map);
      }
      map.fitBounds(L.latLngBounds(latlngs), { padding: [60, 60] });
    } else {
      map.panTo([loc.lat, loc.lng], { animate: true });
    }
  }, [mapReady]);

  useEffect(() => {
    if (employeeLoc) updateEmployeeMarker(employeeLoc);
  }, [employeeLoc, updateEmployeeMarker]);

  /* ── ETA ── */
  const etaMinutes = useMemo(() => {
    // For public route: use server-calculated ETA
    if (isPublicRoute) return liveServerEta;
    if (!employeeLoc || !booking?.lat || !booking?.lng) return null;
    const R = 6371;
    const dLat = (Number(booking.lat) - employeeLoc.lat) * Math.PI / 180;
    const dLng = (Number(booking.lng) - employeeLoc.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(employeeLoc.lat * Math.PI / 180)
      * Math.cos(Number(booking.lat) * Math.PI / 180)
      * Math.sin(dLng / 2) ** 2;
    const distKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.max(1, Math.ceil((distKm / 40) * 60));
  }, [employeeLoc, booking, isPublicRoute, liveServerEta]);

  /* ── derived ── */
  const statusKey  = (isPublicRoute ? liveStatus : booking?.status) ?? 'pending';
  const statusCfg  = STATUS_CFG[statusKey] ?? STATUS_CFG['pending'];
  const isLive     = ['on_way', 'arrived', 'in_progress'].includes(statusKey);
  const empPhone   = isPublicRoute ? liveEmployeePhone : booking?.employee?.phone;
  const telLink    = empPhone ? `tel:${empPhone}` : null;
  const waLink     = empPhone ? `https://wa.me/${empPhone.replace(/[^0-9]/g, '')}` : null;
  const displayEmployeeName = isPublicRoute ? liveEmployeeName : booking?.employee?.name;
  const displayVehicleName  = liveVehicleName;

  /* ── loading ── */
  if (bookingLoading || (isPublicRoute && liveLoading && !liveData)) {
    return (
      <div className="min-h-screen bg-surface-1 flex items-center justify-center" dir="rtl">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center mx-auto shadow-xl shadow-blue-500/30 animate-pulse">
            <Navigation size={28} className="text-white" />
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <Loader2 size={15} className="animate-spin" />
            <span className="font-semibold text-sm">جاري تحميل التتبع...</span>
          </div>
        </motion.div>
      </div>
    );
  }

  /* ── error ── */
  if ((!isPublicRoute && (bookingError || !booking)) || (isPublicRoute && liveError && !liveData)) {
    return (
      <div className="min-h-screen bg-surface-1 flex items-center justify-center px-4" dir="rtl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center mx-auto">
            <AlertCircle size={28} className="text-red-400" />
          </div>
          <div>
            <h2 className="text-white font-bold text-lg mb-1">تعذّر تحميل الحجز</h2>
            <p className="text-slate-400 text-sm">تأكد من رقم الحجز وحاول مرة أخرى</p>
          </div>
          <div className="flex gap-3 justify-center">
            {!isPublicRoute && (
              <button onClick={() => refetchBooking()} className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold">
                <RefreshCw size={14} /> إعادة المحاولة
              </button>
            )}
            <button onClick={() => navigate(-1)} className="flex items-center gap-2 bg-white/10 text-white px-5 py-2.5 rounded-xl text-sm font-medium">
              <ArrowRight size={14} /> رجوع
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  /* ── main UI ── */
  return (
    <div dir="rtl" className="min-h-screen bg-surface-1 text-white flex flex-col">

      {/* Orbs */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden>
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/8 blur-[100px] rounded-full" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-purple-600/8 blur-[100px] rounded-full" />
      </div>

      {/* ── Top bar ── */}
      <motion.div
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.45 }}
        className="relative z-20 bg-surface-1/90 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center gap-3"
      >
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors flex-shrink-0"
        >
          <ArrowRight size={17} className="text-slate-400" />
        </button>

        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-white text-sm truncate">
            تتبع الطلب {booking?.bookingNumber ? `#${booking.bookingNumber}` : `#${bookingId}`}
          </h1>
          {booking?.vendor?.name && (
            <p className="text-[11px] text-slate-500 truncate">{booking.vendor.name}</p>
          )}
        </div>

        {/* WS badge */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold ${
          wsConnected
            ? 'bg-green-500/10 border-green-500/25 text-green-400'
            : 'bg-white/5 border-white/10 text-slate-500'
        }`}>
          {wsConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
          {wsConnected ? 'مباشر' : 'غير متصل'}
        </div>
      </motion.div>

      {/* ── Booking info card ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.45 }}
        className="relative z-10 mx-4 mt-4"
      >
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 space-y-3.5">

          {/* Status row */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className={`inline-flex items-center gap-2 border rounded-full px-3 py-1 ${statusCfg.bgCls}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dotCls} ${isLive ? 'animate-pulse' : ''}`} />
              <span className={`text-xs font-bold ${statusCfg.colorCls}`}>{statusCfg.label}</span>
            </div>
            {booking && (booking.service?.name || booking.package?.name) && (
              <span className="text-xs text-slate-400 truncate">
                {[booking?.service?.name, booking?.package?.name].filter(Boolean).join(' · ')}
              </span>
            )}
          </div>

          {/* Employee row */}
          {(displayEmployeeName || booking?.employee) ? (
            <div className="flex items-center gap-3 bg-white/[0.06] rounded-xl p-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-500/25">
                <User size={17} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{displayEmployeeName ?? booking?.employee?.name}</p>
                <p className="text-[11px] text-slate-500">
                  {displayVehicleName ? displayVehicleName : 'الموظف المعيّن'}
                </p>
              </div>
              <div className="flex gap-2">
                {telLink && (
                  <a href={telLink} className="p-2 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 transition-colors" title="اتصل بالموظف">
                    <Phone size={14} className="text-blue-400" />
                  </a>
                )}
                {waLink && (
                  <a href={waLink} target="_blank" rel="noreferrer" className="p-2 rounded-xl bg-green-500/15 hover:bg-green-500/25 transition-colors" title="واتساب">
                    <MessageCircle size={14} className="text-green-400" />
                  </a>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-500 text-sm py-1">
              <User size={14} />
              <span>لم يُعيَّن موظف بعد</span>
            </div>
          )}

          {/* Address */}
          {!isPublicRoute && booking?.address && (
            <div className="flex items-start gap-2 text-slate-400 text-xs leading-relaxed">
              <MapPin size={13} className="mt-0.5 flex-shrink-0 text-blue-400" />
              <span>{booking.address}</span>
            </div>
          )}

          {/* Schedule */}
          {!isPublicRoute && booking?.scheduledAt && (
            <div className="flex items-center gap-2 text-slate-400 text-xs">
              <Clock size={13} className="flex-shrink-0 text-purple-400" />
              <span>
                {new Intl.DateTimeFormat('ar-SA', { dateStyle: 'medium', timeStyle: 'short' })
                  .format(new Date(booking.scheduledAt))}
              </span>
            </div>
          )}

          {/* ETA badge */}
          {etaMinutes && ['confirmed', 'on_way'].includes(statusKey) && (
            <div className="relative bg-emerald-900/40 border border-emerald-500/30 rounded-2xl p-4 text-center overflow-hidden">
              {/* animated pulse ring */}
              <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="w-24 h-24 rounded-full border-2 border-emerald-500/20 animate-ping opacity-40" />
              </span>
              <div className="relative z-10">
                <div className="text-emerald-400 text-sm font-bold mb-1">⏱️ وقت الوصول المتوقع</div>
                <div className="text-white text-3xl font-black">{etaMinutes} <span className="text-lg">دقيقة</span></div>
                <div className="text-emerald-300 text-sm font-semibold mt-1">يصل خلال {etaMinutes} دقيقة</div>
                <div className="text-slate-400 text-xs mt-1">يتحدث تلقائياً مع تحرك الموظف</div>
              </div>
            </div>
          )}

          {/* Completed CTA */}
          {['completed', 'done'].includes(statusKey) && (
            <div className="bg-emerald-900/30 border border-emerald-500/25 rounded-2xl p-4 text-center">
              <div className="text-emerald-400 text-lg font-black mb-1">تم الانتهاء ✅</div>
              {!isPublicRoute && bookingId && (
                <a
                  href={`/app/rate/${bookingId}`}
                  className="inline-flex items-center gap-2 mt-2 bg-emerald-600/80 hover:bg-emerald-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors"
                >
                  قيّم الخدمة ⭐
                </a>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Map ── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.25, duration: 0.5 }}
        className="relative z-10 mx-4 mt-4 flex-1"
      >
        <div
          className="relative rounded-2xl overflow-hidden border border-white/10 bg-[#0a0f1e]"
          style={{ minHeight: 340 }}
        >
          <div ref={mapRef} className="w-full h-full" style={{ minHeight: 340 }} />

          {/* No location – only when tracking should be active */}
          <AnimatePresence>
            {isLive && !employeeLoc && (
              <motion.div
                key="no-loc"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center bg-surface-1/80 backdrop-blur-sm z-[1000]"
              >
                <div className="text-center space-y-3 px-6">
                  <motion.div
                    animate={{ scale: [1, 1.12, 1] }}
                    transition={{ repeat: Infinity, duration: 2.2 }}
                    className="w-14 h-14 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center mx-auto"
                  >
                    <Navigation size={24} className="text-blue-400" />
                  </motion.div>
                  <p className="text-white font-bold text-sm">الموظف لم يبدأ التتبع بعد</p>
                  <p className="text-slate-400 text-xs">سيظهر موقعه هنا فور انطلاقه</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Not an active tracking status */}
          {!isLive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-1/75 backdrop-blur-sm z-[1000]">
              <div className="text-center space-y-3 px-6">
                <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-white/10 flex items-center justify-center mx-auto">
                  {statusKey === 'completed' || statusKey === 'done' ? (
                    <CheckCircle size={24} className="text-emerald-400" />
                  ) : (
                    <MapPin size={24} className="text-slate-500" />
                  )}
                </div>
                <p className="text-slate-400 font-medium text-sm">
                  {statusKey === 'completed' || statusKey === 'done'
                    ? 'تم إتمام الخدمة بنجاح'
                    : 'التتبع المباشر يبدأ عند انطلاق الموظف'}
                </p>
              </div>
            </div>
          )}

          {/* Loading map */}
          {!mapReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-surface-1 z-[999]">
              <Loader2 size={26} className="text-blue-400 animate-spin" />
            </div>
          )}

          {/* Legend overlay – top-left via CSS (map uses leaflet controls on top-left) */}
          {employeeLoc && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="absolute top-3 right-3 z-[1001] space-y-1.5"
            >
              <div className="bg-surface-1/85 backdrop-blur-xl border border-white/10 rounded-xl px-3 py-1.5 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-red-500 to-orange-400 flex-shrink-0" />
                <span className="text-[11px] text-slate-300 font-medium">الموظف</span>
              </div>
              <div className="bg-surface-1/85 backdrop-blur-xl border border-white/10 rounded-xl px-3 py-1.5 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex-shrink-0" />
                <span className="text-[11px] text-slate-300 font-medium">موقعك</span>
              </div>
              {lastUpdate && (
                <div className="bg-surface-1/85 backdrop-blur-xl border border-white/10 rounded-xl px-3 py-1.5">
                  <span className="text-[10px] text-slate-500">
                    آخر تحديث {lastUpdate.toLocaleTimeString('ar-SA', { timeStyle: 'short' })}
                  </span>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* ── Bottom actions ── */}
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.38, duration: 0.45 }}
        className="relative z-10 px-4 py-4 space-y-3"
      >
        {(booking?.employee || isPublicRoute) && (
          <div className="grid grid-cols-2 gap-3">
            {telLink ? (
              <a
                href={telLink}
                className="flex items-center justify-center gap-2 bg-blue-600/80 hover:bg-blue-600 text-white py-3.5 rounded-2xl font-bold text-sm transition-colors shadow-lg shadow-blue-500/20"
              >
                <Phone size={16} />
                اتصل بالموظف
              </a>
            ) : (
              <button disabled className="flex items-center justify-center gap-2 bg-white/5 text-slate-600 py-3.5 rounded-2xl font-bold text-sm cursor-not-allowed">
                <Phone size={16} /> اتصل بالموظف
              </button>
            )}
            {waLink ? (
              <a
                href={waLink}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 bg-green-600/80 hover:bg-green-600 text-white py-3.5 rounded-2xl font-bold text-sm transition-colors shadow-lg shadow-green-500/20"
              >
                <MessageCircle size={16} />
                واتساب
              </a>
            ) : (
              <button disabled className="flex items-center justify-center gap-2 bg-white/5 text-slate-600 py-3.5 rounded-2xl font-bold text-sm cursor-not-allowed">
                <MessageCircle size={16} /> واتساب
              </button>
            )}
          </div>
        )}

        {!isPublicRoute && (
          <button
            onClick={() => navigate('/app/bookings')}
            className="w-full flex items-center justify-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 py-3 rounded-2xl text-sm font-medium transition-colors"
          >
            <ArrowRight size={15} />
            جميع حجوزاتي
          </button>
        )}
      </motion.div>
    </div>
  );
}

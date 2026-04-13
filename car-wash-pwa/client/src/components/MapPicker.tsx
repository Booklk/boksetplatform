import { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation } from 'lucide-react';

interface MapPickerProps {
  lat?: number;
  lng?: number;
  onChange: (lat: number, lng: number, address?: string) => void;
}

// Default center: North Riyadh
const DEFAULT_LAT = 24.8200;
const DEFAULT_LNG = 46.6200;

declare global {
  interface Window {
    L: any;
    _mapLoaded: boolean;
  }
}

function loadLeaflet(): Promise<void> {
  if (window._mapLoaded) return Promise.resolve();
  return new Promise((resolve) => {
    // CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    // JS
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => { window._mapLoaded = true; resolve(); };
    document.head.appendChild(script);
  });
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ar`
    );
    const data = await res.json();
    const { road, suburb, city, state } = data.address ?? {};
    return [road, suburb, city ?? state].filter(Boolean).join('، ') || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

export default function MapPicker({ lat, lng, onChange }: MapPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [address, setAddress] = useState('');
  const [loadingAddr, setLoadingAddr] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    loadLeaflet().then(() => {
      if (!isMounted || !mapRef.current || mapInstanceRef.current) return;
      const L = window.L;

      const initialLat = lat ?? DEFAULT_LAT;
      const initialLng = lng ?? DEFAULT_LNG;

      const map = L.map(mapRef.current, { zoomControl: true, attributionControl: false })
        .setView([initialLat, initialLng], 14);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

      const icon = L.divIcon({
        html: `<div class="flex items-center justify-center w-10 h-10 bg-blue-600 rounded-full border-4 border-white shadow-xl">
                 <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="white">
                   <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                 </svg>
               </div>`,
        className: '',
        iconSize: [40, 40],
        iconAnchor: [20, 40],
      });

      const marker = L.marker([initialLat, initialLng], { icon, draggable: true }).addTo(map);
      markerRef.current = marker;
      mapInstanceRef.current = map;

      async function updatePosition(latlng: { lat: number; lng: number }) {
        setLoadingAddr(true);
        const addr = await reverseGeocode(latlng.lat, latlng.lng);
        setAddress(addr);
        onChange(latlng.lat, latlng.lng, addr);
        setLoadingAddr(false);
      }

      marker.on('dragend', () => updatePosition(marker.getLatLng()));
      map.on('click', (e: any) => { marker.setLatLng(e.latlng); updatePosition(e.latlng); });

      if (lat && lng) updatePosition({ lat, lng });
    });
    return () => { isMounted = false; };
  }, []);

  function getCurrentLocation() {
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const { latitude: lt, longitude: lg } = coords;
        markerRef.current?.setLatLng([lt, lg]);
        mapInstanceRef.current?.setView([lt, lg], 16);
        setLoadingAddr(true);
        const addr = await reverseGeocode(lt, lg);
        setAddress(addr);
        onChange(lt, lg, addr);
        setLoadingAddr(false);
        setGpsLoading(false);
      },
      () => setGpsLoading(false),
      { enableHighAccuracy: true }
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative rounded-xl overflow-hidden border border-slate-600/50" style={{ height: 280 }}>
        <div ref={mapRef} style={{ height: '100%', width: '100%' }} />
        <button
          type="button"
          onClick={getCurrentLocation}
          disabled={gpsLoading}
          className="absolute bottom-3 left-3 z-[1000] bg-brand-700 hover:bg-brand-600 text-white px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg transition-colors"
        >
          <Navigation size={15} className={gpsLoading ? 'animate-spin' : ''} />
          {gpsLoading ? 'جاري تحديد موقعك...' : 'موقعي الحالي'}
        </button>
      </div>
      {address && (
        <div className="flex items-start gap-2 bg-brand-900/30 border border-brand-600/30 rounded-xl p-3">
          <MapPin size={16} className="text-brand-400 mt-0.5 shrink-0" />
          <p className="text-sm text-slate-300">
            {loadingAddr ? 'جاري تحديد العنوان...' : address}
          </p>
        </div>
      )}
      <p className="text-xs text-slate-500 text-center">انقر على الخريطة أو اسحب المؤشر لتحديد موقعك بدقة</p>
    </div>
  );
}

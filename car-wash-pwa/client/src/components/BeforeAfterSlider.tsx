import { useRef, useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Camera, ArrowLeftRight } from 'lucide-react';

interface BeforeAfterSliderProps {
  beforeUrl?: string;
  afterUrl?: string;
  label?: string;
}

export default function BeforeAfterSlider({ beforeUrl, afterUrl, label }: BeforeAfterSliderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(50); // percent
  const dragging = useRef(false);

  const clamp = (val: number, min: number, max: number) =>
    Math.max(min, Math.min(max, val));

  const updatePosition = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = clamp(((clientX - rect.left) / rect.width) * 100, 2, 98);
    setPosition(pct);
  }, []);

  // Mouse events
  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    updatePosition(e.clientX);
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      updatePosition(e.clientX);
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [updatePosition]);

  // Touch events
  const onTouchStart = (e: React.TouchEvent) => {
    dragging.current = true;
    updatePosition(e.touches[0].clientX);
  };

  useEffect(() => {
    const onTouchMove = (e: TouchEvent) => {
      if (!dragging.current) return;
      e.preventDefault();
      updatePosition(e.touches[0].clientX);
    };
    const onTouchEnd = () => { dragging.current = false; };
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [updatePosition]);

  // Placeholder when no images
  if (!beforeUrl || !afterUrl) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="relative overflow-hidden rounded-2xl bg-slate-800/60 border border-slate-700/40"
        style={{ aspectRatio: '16/9' }}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-500">
          <Camera size={40} strokeWidth={1.5} />
          <p className="text-sm font-bold">لم يتم رفع الصور بعد</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      className="relative overflow-hidden rounded-2xl select-none shadow-2xl"
      style={{ aspectRatio: '16/9' }}
      ref={containerRef}
    >
      {label && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 bg-black/60 text-white text-xs font-bold px-3 py-1 rounded-full backdrop-blur">
          {label}
        </div>
      )}

      {/* After image — full width, clipped by left side of divider */}
      <div className="absolute inset-0">
        <img
          src={afterUrl}
          alt="بعد"
          className="w-full h-full object-cover"
          draggable={false}
        />
      </div>

      {/* Before image — shown only on left of divider */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${position}%` }}
      >
        <img
          src={beforeUrl}
          alt="قبل"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ width: `${(100 / position) * 100}%`, maxWidth: 'none' }}
          draggable={false}
        />
      </div>

      {/* Badge: قبل */}
      <div
        className="absolute top-3 z-10 pointer-events-none"
        style={{ right: `calc(100% - ${position}% + 8px)` }}
      >
        <span className="bg-red-500/90 text-white text-xs font-black px-2 py-0.5 rounded-full shadow-lg">
          قبل
        </span>
      </div>

      {/* Badge: بعد */}
      <div
        className="absolute top-3 left-3 z-10 pointer-events-none"
        style={{ left: `calc(${position}% + 8px)` }}
      >
        <span className="bg-green-500/90 text-white text-xs font-black px-2 py-0.5 rounded-full shadow-lg">
          بعد
        </span>
      </div>

      {/* Divider line */}
      <div
        className="absolute top-0 bottom-0 z-10 flex items-center justify-center cursor-ew-resize"
        style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
      >
        {/* Line */}
        <div className="absolute top-0 bottom-0 w-0.5 bg-white/90 shadow-[0_0_8px_rgba(255,255,255,0.6)]" />

        {/* Handle circle */}
        <div className="relative z-10 w-10 h-10 bg-white rounded-full shadow-[0_0_16px_rgba(0,0,0,0.5)] flex items-center justify-center border-2 border-white/80">
          <ArrowLeftRight size={16} className="text-slate-800" />
        </div>
      </div>

      {/* Drag overlay for easier interaction */}
      <div
        className="absolute inset-0 z-0 cursor-ew-resize"
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
      />
    </motion.div>
  );
}

/**
 * PresenceIndicator — tiny live-status chip.
 *
 * Shows a green dot when the WebSocket is connected plus the count of
 * other teammates currently online. Expands on hover to show names.
 * Only renders for authenticated vendor users.
 */

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Radio, WifiOff } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useRealtime } from '../hooks/useRealtime';
import { springs } from '../design/motion';

export default function PresenceIndicator() {
  const { user } = useAuth();
  const { status, presence } = useRealtime();
  const [open, setOpen] = useState(false);

  const others = useMemo(
    () => presence.filter((p) => p.userId !== user?.id),
    [presence, user?.id],
  );

  // Only show for authenticated team members of a vendor.
  if (!user || user.role === 'customer') return null;

  const online = status === 'online';
  const dotColor = online ? 'bg-success-400' : 'bg-ink-500';

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      dir="rtl"
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-xs font-bold text-ink-200 transition-colors"
        aria-label="حالة الفريق المباشرة"
      >
        <span className={`relative flex h-2 w-2`}>
          {online && (
            <span className={`absolute inline-flex h-full w-full rounded-full ${dotColor} opacity-75 animate-ping`} />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${dotColor}`} />
        </span>
        {online ? (
          others.length > 0 ? (
            <span>{others.length} متصل</span>
          ) : (
            <span className="text-ink-400">فقط أنت</span>
          )
        ) : (
          <WifiOff size={12} className="text-ink-500" />
        )}
      </button>

      <AnimatePresence>
        {open && online && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.96 }}
            transition={springs.gentle}
            className="absolute top-10 end-0 w-60 z-50 rounded-2xl bg-ink-900 border border-white/10 shadow-2xl p-3"
          >
            <p className="text-[11px] font-black text-ink-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Radio size={11} className="text-success-400" />
              الفريق الآن
            </p>
            {presence.length === 0 ? (
              <p className="text-xs text-ink-500">لا أحد متصل</p>
            ) : (
              <ul className="space-y-1.5">
                {presence.map((p) => {
                  const isMe = p.userId === user.id;
                  return (
                    <li key={p.userId} className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-success-400" />
                        <span className={`truncate ${isMe ? 'text-primary-300 font-bold' : 'text-white'}`}>
                          {p.name}{isMe ? ' (أنت)' : ''}
                        </span>
                      </span>
                      <span className="text-[10px] text-ink-500 shrink-0">{labelFor(p.role)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function labelFor(role: string): string {
  switch (role) {
    case 'vendor_admin': return 'مالك';
    case 'admin':        return 'مدير';
    case 'employee':     return 'موظف';
    default:              return role;
  }
}

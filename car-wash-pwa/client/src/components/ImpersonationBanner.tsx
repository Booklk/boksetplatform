/**
 * ImpersonationBanner — sticky bar at the top of the viewport when a
 * super admin is currently acting as a vendor_admin. One click restores
 * the original session.
 *
 * State is kept in sessionStorage so a reload stays in impersonation,
 * but closing the tab ends the session cleanly.
 */

import { UserCog, LogOut } from 'lucide-react';

export default function ImpersonationBanner() {
  const originToken = sessionStorage.getItem('impersonation_origin_token');
  const vendorName = sessionStorage.getItem('impersonation_vendor') ?? 'التاجر';
  if (!originToken) return null;

  function exit() {
    const token = sessionStorage.getItem('impersonation_origin_token');
    const user = sessionStorage.getItem('impersonation_origin_user');
    if (token) localStorage.setItem('token', token);
    if (user) localStorage.setItem('user', user);
    sessionStorage.removeItem('impersonation_origin_token');
    sessionStorage.removeItem('impersonation_origin_user');
    sessionStorage.removeItem('impersonation_vendor');
    window.location.href = '/super-admin/dashboard';
  }

  return (
    <div
      dir="rtl"
      className="fixed top-0 inset-x-0 z-[100] bg-gradient-to-l from-indigo-600 to-purple-600 text-white text-xs font-bold px-4 py-1.5 flex items-center justify-center gap-3 shadow-lg"
    >
      <UserCog size={14} />
      <span>أنت تدخل كـ <strong>{vendorName}</strong> — كل إجراء محفوظ في سجل الأنشطة</span>
      <button
        onClick={exit}
        className="inline-flex items-center gap-1 bg-white/20 hover:bg-white/30 px-2.5 py-0.5 rounded-md transition-colors"
      >
        <LogOut size={12} />
        خروج
      </button>
    </div>
  );
}

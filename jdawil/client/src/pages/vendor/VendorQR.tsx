/**
 * /vendor/qr — printable QR + merchant number for the vendor's storefront.
 * Uses the public /api/vendor-storefront/qr/:slug endpoint (SVG PNG-like).
 */

import { useQuery } from '@tanstack/react-query';
import { Download, Copy, QrCode, Printer, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { Button, Card, PageHeader, Skeleton } from '../../components/ui';
import api from '../../lib/api';

interface SettingsResp { merchantNumber: string }

export default function VendorQR() {
  const { user } = useAuth();
  const slug = (user as any)?.vendor?.slug as string | undefined;

  const { data } = useQuery<SettingsResp>({
    queryKey: ['storefront-settings'],
    queryFn: async () => (await api.get('/vendor-storefront/settings')).data,
  });

  const qrUrl = slug ? `/api/vendor-storefront/qr/${slug}` : '';
  const storeUrl = slug ? `${window.location.origin}/store/${slug}` : '';
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  async function copy(text: string, setFlag: (v: boolean) => void) {
    try {
      await navigator.clipboard.writeText(text);
      setFlag(true);
      setTimeout(() => setFlag(false), 2000);
      toast.success('تم النسخ');
    } catch { toast.error('تعذّر النسخ'); }
  }

  async function download() {
    const res = await fetch(qrUrl);
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `qr-${slug}.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="min-h-screen bg-ink-950 text-white p-4 sm:p-6" dir="rtl">
      <div className="max-w-2xl mx-auto">
        <PageHeader
          icon={<QrCode size={20} />}
          title="رمز QR لمتجرك"
          subtitle="اطبعه واستخدمه في طاولاتك، بطاقات العمل، وواجهة المحل."
        />

        {!slug ? (
          <Skeleton className="h-80 rounded-2xl" />
        ) : (
          <>
            <Card variant="elevated" padding="lg" className="mb-4 text-center">
              <div className="inline-block bg-white rounded-2xl p-6 mb-4">
                <img src={qrUrl} alt="QR Code" className="w-64 h-64" />
              </div>
              <div className="flex items-center justify-center gap-2">
                <Button
                  leftIcon={<Download size={14} />}
                  onClick={download}
                >
                  تحميل SVG
                </Button>
                <Button
                  variant="secondary"
                  leftIcon={<Printer size={14} />}
                  onClick={() => window.print()}
                >
                  طباعة
                </Button>
              </div>
            </Card>

            <Card variant="default" padding="md" className="mb-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink-400 mb-1">رابط المتجر</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs text-primary-300 font-mono truncate" dir="ltr">{storeUrl}</code>
                <Button size="sm" variant="secondary" leftIcon={copiedUrl ? <CheckCircle2 size={13} /> : <Copy size={13} />} onClick={() => copy(storeUrl, setCopiedUrl)}>
                  نسخ
                </Button>
              </div>
            </Card>

            {data?.merchantNumber && (
              <Card variant="default" padding="md">
                <p className="text-[11px] font-bold uppercase tracking-wider text-ink-400 mb-1">رقم التاجر</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xl font-black font-mono" dir="ltr">{data.merchantNumber}</code>
                  <Button size="sm" variant="secondary" leftIcon={copiedCode ? <CheckCircle2 size={13} /> : <Copy size={13} />} onClick={() => copy(data.merchantNumber, setCopiedCode)}>
                    نسخ
                  </Button>
                </div>
                <p className="text-[11px] text-ink-500 mt-2 leading-relaxed">
                  استخدمه في الفواتير المطبوعة، الحجوزات الهاتفية، ودعم العملاء.
                </p>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}

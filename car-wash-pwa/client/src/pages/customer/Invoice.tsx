import { useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowRight, Printer, RefreshCw, FileX } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../hooks/useAuth';

interface InvoiceData {
  bookingNumber: string;
  html: string;
}

export default function InvoicePage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const { data, isLoading, isError, refetch } = useQuery<InvoiceData>({
    queryKey: ['invoice', bookingId],
    queryFn: () =>
      axios
        .get(`/api/invoices/booking/${bookingId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((r) => r.data),
    enabled: !!bookingId,
    retry: 1,
  });

  const handlePrint = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.print();
    } else {
      window.open(`/api/invoices/booking/${bookingId}`, '_blank');
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-surface-1" dir="rtl">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900/80 backdrop-blur border-b border-slate-700/50 shrink-0">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors"
        >
          <ArrowRight size={18} />
          <span className="text-sm font-bold">رجوع</span>
        </button>

        <div className="text-center">
          <p className="text-xs text-slate-400">فاتورة</p>
          {data?.bookingNumber && (
            <p className="text-white font-black text-sm">#{data.bookingNumber}</p>
          )}
        </div>

        <button
          onClick={handlePrint}
          disabled={!data}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-2 rounded-xl text-sm font-bold transition-colors"
        >
          <Printer size={14} />
          طباعة
        </button>
      </div>

      {/* Content area */}
      <div className="flex-1 flex flex-col">
        {isLoading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full"
            />
            <p className="text-slate-400">جاري تحميل الفاتورة...</p>
          </div>
        )}

        {isError && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
              <FileX size={28} className="text-red-400" />
            </div>
            <div>
              <h2 className="text-white font-black text-lg mb-1">لا يمكن تحميل الفاتورة</h2>
              <p className="text-slate-400 text-sm">تأكد من اتصالك بالإنترنت وحاول مجدداً</p>
            </div>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold transition-colors"
            >
              <RefreshCw size={15} />
              إعادة المحاولة
            </button>
          </motion.div>
        )}

        {data && !isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex flex-col"
          >
            <iframe
              ref={iframeRef}
              srcDoc={data.html}
              title={`فاتورة #${data.bookingNumber}`}
              className="flex-1 w-full border-0"
              style={{ minHeight: 'calc(100vh - 64px)' }}
              sandbox="allow-same-origin allow-modals"
            />
          </motion.div>
        )}
      </div>
    </div>
  );
}

/**
 * /app/bookings/:id/deposit?bookingId&vendorId&amount
 *
 * Lightweight checkout step after a booking is created with a required
 * deposit. Re-uses PaymentMethodPicker — the server already picked up
 * the booking via /payment-gateway/checkout { bookingId, provider } so
 * this page just needs to know the vendor + amount for display.
 */

import { useSearchParams, useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Coins, ArrowLeft } from 'lucide-react';
import { Card, PageHeader, Button } from '../../components/ui';
import PaymentMethodPicker from '../../components/PaymentMethodPicker';
import { fadeInUp } from '../../design/motion';

export default function Deposit() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const bookingId = Number(params.get('bookingId') ?? id ?? 0);
  const vendorId  = Number(params.get('vendorId')  ?? 0);
  const amount    = Number(params.get('amount')    ?? 0);

  if (!bookingId || !vendorId) {
    return (
      <div className="min-h-screen bg-ink-950 text-white p-6" dir="rtl">
        <p className="text-center text-sm text-ink-400">رابط غير صحيح</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-950 text-white p-4 sm:p-6" dir="rtl">
      <div className="max-w-lg mx-auto">
        <PageHeader
          icon={<Coins size={20} />}
          title="دفع العربون"
          subtitle={`حجزك محفوظ مؤقتاً. أكمل دفع العربون لتأكيده.`}
        />

        <motion.div variants={fadeInUp} initial="hidden" animate="visible">
          <Card variant="elevated" padding="lg" className="mb-4 bg-gradient-to-br from-warn-500/5 to-transparent border-warn-500/20">
            <p className="text-xs text-ink-400 mb-1">قيمة العربون المطلوبة</p>
            <p className="text-4xl font-black text-warn-300 tabular-nums">
              {amount.toLocaleString('ar-SA')}
              <span className="text-base text-ink-400 font-bold"> ر.س</span>
            </p>
            <p className="text-[11px] text-ink-500 mt-2">
              الباقي يُدفع في الموقع عند تنفيذ الخدمة. لن يتم تأكيد الحجز حتى استلام العربون.
            </p>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp} initial="hidden" animate="visible">
          <Card variant="default" padding="md" className="mb-4">
            <h3 className="text-sm font-black mb-3">اختر طريقة الدفع</h3>
            <PaymentMethodPicker
              vendorId={vendorId}
              bookingId={bookingId}
              onPaid={() => navigate('/app/bookings')}
            />
          </Card>
        </motion.div>

        <Button
          variant="ghost"
          size="sm"
          leftIcon={<ArrowLeft size={14} />}
          onClick={() => navigate('/app/bookings')}
        >
          تجاوز الآن (سيبقى الحجز معلّقاً)
        </Button>
      </div>
    </div>
  );
}

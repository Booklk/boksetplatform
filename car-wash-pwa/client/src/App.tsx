import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from './hooks/useAuth';
import { useDomainVendor } from './hooks/useDomainVendor';
import { BottomNav } from './components/BottomNav';
import InstallPrompt from './components/InstallPrompt';
import PushNotificationBanner from './components/PushNotificationBanner';
import CommandPalette from './components/CommandPalette';
import WhatsAppFAB from './components/WhatsAppFAB';
import ImpersonationBanner from './components/ImpersonationBanner';
import Copilot from './components/Copilot';
import LiveBookingNotifier from './components/LiveBookingNotifier';
import MilestoneCelebrant from './components/MilestoneCelebrant';

// Eagerly loaded (critical path)
import Landing from './pages/Landing';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'));
import Navbar from './components/Navbar';
import NotFound from './pages/NotFound';
import NetworkStatus from './components/NetworkStatus';
import UpgradeGate from './components/UpgradeGate';
import UpdateToast from './components/UpdateToast';

// Lazy loaded pages
const CustomerHome = lazy(() => import('./pages/customer/Home'));
const CustomerBookings = lazy(() => import('./pages/customer/MyBookings'));
const BookingPage = lazy(() => import('./pages/customer/Booking'));
const RatePage = lazy(() => import('./pages/customer/Rate'));
const CustomerVehicles = lazy(() => import('./pages/customer/Vehicles'));
const CustomerLoyalty = lazy(() => import('./pages/customer/Loyalty'));
const LiveTracking = lazy(() => import('./pages/customer/LiveTracking'));

const EmployeeDashboard = lazy(() => import('./pages/employee/Dashboard'));
const EmployeeOrderDetail = lazy(() => import('./pages/employee/OrderDetail'));
const EmployeeNewBooking = lazy(() => import('./pages/employee/NewBooking'));

const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminServices = lazy(() => import('./pages/admin/Services'));
const AdminBookings = lazy(() => import('./pages/admin/Bookings'));
const AdminCustomers = lazy(() => import('./pages/admin/Customers'));
const AdminEmployees = lazy(() => import('./pages/admin/Employees'));
const AdminInventory = lazy(() => import('./pages/admin/Inventory'));
const AdminFinancials = lazy(() => import('./pages/admin/Financials'));

// New SaaS pages
const Marketplace = lazy(() => import('./pages/Marketplace'));
const VendorLanding = lazy(() => import('./pages/VendorLanding'));
const Blog = lazy(() => import('./pages/Blog'));
const BlogArticle = lazy(() => import('./pages/BlogArticle'));
const IndustryLandingPage = lazy(() => import('./pages/IndustryLanding'));
const VendorOnboarding = lazy(() => import('./pages/VendorOnboarding'));
const FastOnboard = lazy(() => import('./pages/FastOnboard'));

// Business pages
const Demo = lazy(() => import('./pages/Demo'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Terms = lazy(() => import('./pages/Terms'));
const CityLanding = lazy(() => import('./pages/CityLanding'));
const PricingPage = lazy(() => import('./pages/Pricing'));

const VendorDashboard = lazy(() => import('./pages/vendor/Dashboard'));
const VendorQueue = lazy(() => import('./pages/vendor/Queue'));
const VendorPOS = lazy(() => import('./pages/vendor/POS'));
const QueueDisplay = lazy(() => import('./pages/QueueDisplay'));
const QueueJoin = lazy(() => import('./pages/QueueJoin'));
const VendorBranding = lazy(() => import('./pages/vendor/Branding'));
const VendorBrandKit = lazy(() => import('./pages/vendor/BrandKit'));
const VendorCampaigns = lazy(() => import('./pages/vendor/Campaigns'));
const VendorGiftCards = lazy(() => import('./pages/vendor/GiftCards'));
const VendorShop = lazy(() => import('./pages/vendor/Shop'));
const VendorEmployeePerformance = lazy(() => import('./pages/vendor/EmployeePerformance'));
const VendorTimeBlocks = lazy(() => import('./pages/vendor/TimeBlocks'));
const VendorExports = lazy(() => import('./pages/vendor/Exports'));
const VendorPromos = lazy(() => import('./pages/vendor/Promos'));
const VendorAnalytics = lazy(() => import('./pages/vendor/Analytics'));
const VendorCalendar = lazy(() => import('./pages/vendor/Calendar'));
const VendorLiveMap = lazy(() => import('./pages/vendor/LiveMap'));
const VendorSubscriptions = lazy(() => import('./pages/vendor/Subscriptions'));
const VendorCorporate = lazy(() => import('./pages/vendor/Corporate'));
const VendorPlatformSub = lazy(() => import('./pages/vendor/PlatformSubscription'));
const VendorFleet = lazy(() => import('./pages/vendor/Fleet'));
const VendorEmployees = lazy(() => import('./pages/vendor/Employees'));
const VendorSetup = lazy(() => import('./pages/vendor/Setup'));
const VendorPayroll = lazy(() => import('./pages/vendor/Payroll'));
const VendorVatReport = lazy(() => import('./pages/vendor/VatReport'));
const VendorRatings = lazy(() => import('./pages/vendor/Ratings'));
const VendorShifts = lazy(() => import('./pages/vendor/Shifts'));
const VendorSupport = lazy(() => import('./pages/vendor/Support'));
const VendorDispatch = lazy(() => import('./pages/vendor/Dispatch'));
const VendorSettings = lazy(() => import('./pages/vendor/Settings'));
const VendorOperations = lazy(() => import('./pages/vendor/Operations'));
const VendorInvoices = lazy(() => import('./pages/vendor/Invoices'));
const VendorSuppliers = lazy(() => import('./pages/vendor/Suppliers'));
const VendorExpenses = lazy(() => import('./pages/vendor/Expenses'));
const VendorProfitCalculator = lazy(() => import('./pages/vendor/ProfitCalculator'));
const VendorWizard = lazy(() => import('./pages/vendor/VendorWizard'));
const VendorDynamicPricing = lazy(() => import('./pages/vendor/DynamicPricing'));
const VendorServices = lazy(() => import('./pages/vendor/Services'));

// Phase 1: Customer Acquisition Engine
const VendorAutomations = lazy(() => import('./pages/vendor/Automations'));
const VendorCustomerSegments = lazy(() => import('./pages/vendor/CustomerSegments'));
const VendorFinancialStatements = lazy(() => import('./pages/vendor/FinancialStatements'));
const VendorCRM = lazy(() => import('./pages/vendor/CRM'));
const VendorHelpCenter = lazy(() => import('./pages/vendor/HelpCenter'));
const VendorAdvancedAnalytics = lazy(() => import('./pages/vendor/AdvancedAnalytics'));
const VendorNotificationCenter = lazy(() => import('./pages/vendor/NotificationCenter'));
const VendorAuditLog = lazy(() => import('./pages/vendor/AuditLog'));
const VendorReferralProgram = lazy(() => import('./pages/vendor/ReferralProgram'));
const VendorBranches = lazy(() => import('./pages/vendor/Branches'));
const VendorPaymentGateway = lazy(() => import('./pages/vendor/PaymentGateway'));
const VendorAutopilot = lazy(() => import('./pages/vendor/Autopilot'));
const VendorKyc = lazy(() => import('./pages/vendor/Kyc'));
const VendorAIAdvisor = lazy(() => import('./pages/vendor/AIAdvisor'));
const VendorLeaderboard = lazy(() => import('./pages/vendor/Leaderboard'));
const VendorReferVendor = lazy(() => import('./pages/vendor/ReferVendor'));
const VendorStoreBuilder = lazy(() => import('./pages/vendor/StoreBuilder'));
const VendorGallery = lazy(() => import('./pages/vendor/Gallery'));
const VendorPages = lazy(() => import('./pages/vendor/Pages'));
const VendorPageRenderer = lazy(() => import('./pages/VendorPage'));
const VendorCustomerImport = lazy(() => import('./pages/vendor/CustomerImport'));

const AdminLogin = lazy(() => import('./pages/super-admin/AdminLogin'));
const SuperAdminKyc = lazy(() => import('./pages/super-admin/KycReview'));
const SuperAdminDashboard = lazy(() => import('./pages/super-admin/Dashboard'));
const SuperAdminVendors = lazy(() => import('./pages/super-admin/Vendors'));
const SuperAdminRevenue = lazy(() => import('./pages/super-admin/Revenue'));
const SuperAdminSupport = lazy(() => import('./pages/super-admin/Support'));
const SuperAdminUsers = lazy(() => import('./pages/super-admin/Users'));
const SuperAdminHealth = lazy(() => import('./pages/super-admin/Health'));
const SuperAdminAnnounce = lazy(() => import('./pages/super-admin/Announce'));
const SuperAdminAuditLogs = lazy(() => import('./pages/super-admin/AuditLogs'));
const SuperAdminPlans = lazy(() => import('./pages/super-admin/Plans'));

// Appointment booking
const AppointmentBooking = lazy(() => import('./pages/customer/AppointmentBooking'));
const VendorSchedule = lazy(() => import('./pages/vendor/Schedule'));

const CustomerSubscriptions = lazy(() => import('./pages/customer/Subscriptions'));
const CustomerInvoice = lazy(() => import('./pages/customer/Invoice'));
const CustomerBookingDetail = lazy(() => import('./pages/customer/BookingDetail'));
const CustomerAchievements = lazy(() => import('./pages/customer/Achievements'));
const CustomerReferral = lazy(() => import('./pages/customer/Referral'));
const Onboarding = lazy(() => import('./pages/auth/Onboarding'));

// ─── Loading Fallback ────────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a14]">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center space-y-6"
      >
        {/* Animated logo */}
        <div className="relative mx-auto w-20 h-20">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-blue-500 border-r-blue-400/50"
          />
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-2 rounded-full border-[2px] border-transparent border-b-cyan-400 border-l-cyan-300/50"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.span
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-2xl font-black bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent"
            >
              B
            </motion.span>
          </div>
        </div>
        <motion.div
          animate={{ opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <p className="text-slate-500 text-sm font-medium">جاري التحميل...</p>
        </motion.div>
      </motion.div>
    </div>
  );
}

// ─── Auth Guards ─────────────────────────────────────────────────────────────
function RequireAuth({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <PageLoader />;
  if (!user) {
    // Super admin routes → redirect to admin login
    if (roles?.includes('super_admin')) return <Navigate to="/super-admin/login" replace />;
    return <Navigate to="/login" replace />;
  }
  if (roles && !roles.includes(user.role)) {
    // Redirect to correct dashboard based on actual role
    const roleHome: Record<string, string> = {
      super_admin: '/super-admin',
      vendor_admin: '/vendor',
      admin: '/admin',
      employee: '/employee',
      customer: '/app',
    };
    return <Navigate to={roleHome[user.role] ?? '/'} replace />;
  }
  return <>{children}</>;
}

function AppLayout({ children, withSidebar }: { children: React.ReactNode; withSidebar?: boolean }) {
  const { user } = useAuth();
  const isCustomer = user?.role === 'customer';
  const hasSidebar = withSidebar ||
    user?.role === 'admin' ||
    user?.role === 'vendor_admin' ||
    user?.role === 'super_admin';
  return (
    <div className={`min-h-screen ${hasSidebar ? 'md:pr-64' : ''}`}>
      <Navbar />
      {isCustomer && <PushNotificationBanner />}
      <main className={`pt-14 ${isCustomer ? 'pb-24 md:pb-4' : 'pb-20 md:pb-4'}`}>
        {children}
      </main>
      {isCustomer && <BottomNav />}
      <WhatsAppFAB />
    </div>
  );
}

// Wrapper for lazy pages inside Suspense
function S({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}

// ─── Inner component that lives inside BrowserRouter (has access to router hooks) ───
function AppRoutes() {
  useDomainVendor();
  const { init } = useAuth();
  const location = useLocation();
  useEffect(() => { init(); }, []);

  return (
    <>
    <NetworkStatus />
    <InstallPrompt />
    <UpdateToast />
    <ImpersonationBanner />
    <LiveBookingNotifier />
    <MilestoneCelebrant />
    <Copilot />
    <CommandPalette />
    <AnimatePresence mode="wait">
    <Routes location={location} key={location.pathname}>
        {/* ── Public ────────────────────────────────────────────────────── */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<S><ForgotPassword /></S>} />
        {/* Marketplace hidden until 200+ vendors — uncomment to enable */}
        {/* <Route path="/marketplace" element={<S><Marketplace /></S>} /> */}
        <Route path="/blog" element={<S><Blog /></S>} />
        <Route path="/blog/:slug" element={<S><BlogArticle /></S>} />
        <Route path="/for/:industry" element={<S><IndustryLandingPage /></S>} />
        <Route path="/store/:slug" element={<S><VendorLanding /></S>} />
        <Route path="/store/:slug/p/:pageSlug" element={<S><VendorPageRenderer /></S>} />
        <Route path="/store/:slug/book" element={<S><AppointmentBooking /></S>} />
        <Route path="/onboard" element={<S><FastOnboard /></S>} />
        <Route path="/start" element={<S><FastOnboard /></S>} />
        <Route path="/onboard-legacy" element={<S><VendorOnboarding /></S>} />
        <Route path="/demo" element={<S><Demo /></S>} />
        <Route path="/privacy" element={<S><Privacy /></S>} />
        <Route path="/terms" element={<S><Terms /></S>} />
        <Route path="/city/:city" element={<S><CityLanding /></S>} />
        <Route path="/pricing" element={<S><PricingPage /></S>} />

        {/* ── Customer ──────────────────────────────────────────────────── */}
        <Route path="/app" element={
          <RequireAuth roles={['customer']}>
            <AppLayout><S><CustomerHome /></S></AppLayout>
          </RequireAuth>
        } />
        <Route path="/app/bookings" element={
          <RequireAuth roles={['customer']}>
            <AppLayout><S><CustomerBookings /></S></AppLayout>
          </RequireAuth>
        } />
        <Route path="/app/book/:packageId" element={
          <RequireAuth roles={['customer']}>
            <AppLayout><S><BookingPage /></S></AppLayout>
          </RequireAuth>
        } />
        <Route path="/app/rate/:bookingId" element={
          <RequireAuth roles={['customer']}>
            <AppLayout><S><RatePage /></S></AppLayout>
          </RequireAuth>
        } />
        <Route path="/app/vehicles" element={
          <RequireAuth roles={['customer']}>
            <AppLayout><S><CustomerVehicles /></S></AppLayout>
          </RequireAuth>
        } />
        <Route path="/app/loyalty" element={
          <RequireAuth roles={['customer']}>
            <AppLayout><S><CustomerLoyalty /></S></AppLayout>
          </RequireAuth>
        } />
        <Route path="/app/tracking/:bookingId" element={
          <RequireAuth roles={['customer']}>
            <S><LiveTracking /></S>
          </RequireAuth>
        } />

        {/* ── Employee ──────────────────────────────────────────────────── */}
        <Route path="/employee" element={
          <RequireAuth roles={['employee']}>
            <AppLayout><S><EmployeeDashboard /></S></AppLayout>
          </RequireAuth>
        } />
        <Route path="/employee/order/:id" element={
          <RequireAuth roles={['employee']}>
            <AppLayout><S><EmployeeOrderDetail /></S></AppLayout>
          </RequireAuth>
        } />
        <Route path="/employee/new-booking" element={
          <RequireAuth roles={['employee']}>
            <AppLayout><S><EmployeeNewBooking /></S></AppLayout>
          </RequireAuth>
        } />

        {/* ── Admin (legacy vendor admin) ───────────────────────────────── */}
        <Route path="/admin" element={
          <RequireAuth roles={['admin', 'vendor_admin']}>
            <AppLayout withSidebar><S><AdminDashboard /></S></AppLayout>
          </RequireAuth>
        } />
        <Route path="/admin/services" element={
          <RequireAuth roles={['admin', 'vendor_admin']}>
            <AppLayout withSidebar><S><AdminServices /></S></AppLayout>
          </RequireAuth>
        } />
        <Route path="/admin/bookings" element={
          <RequireAuth roles={['admin', 'vendor_admin']}>
            <AppLayout withSidebar><S><AdminBookings /></S></AppLayout>
          </RequireAuth>
        } />
        <Route path="/admin/customers" element={
          <RequireAuth roles={['admin', 'vendor_admin']}>
            <AppLayout withSidebar><S><AdminCustomers /></S></AppLayout>
          </RequireAuth>
        } />
        <Route path="/admin/employees" element={
          <RequireAuth roles={['admin', 'vendor_admin']}>
            <AppLayout withSidebar><S><AdminEmployees /></S></AppLayout>
          </RequireAuth>
        } />
        <Route path="/admin/inventory" element={
          <RequireAuth roles={['admin', 'vendor_admin']}>
            <AppLayout withSidebar><S><AdminInventory /></S></AppLayout>
          </RequireAuth>
        } />
        <Route path="/admin/financials" element={
          <RequireAuth roles={['admin', 'vendor_admin']}>
            <AppLayout withSidebar><S><AdminFinancials /></S></AppLayout>
          </RequireAuth>
        } />

        {/* ── Vendor Admin (new SaaS) ───────────────────────────────────── */}
        <Route path="/vendor/wizard" element={
          <RequireAuth roles={['vendor_admin', 'admin']}>
            <S><VendorWizard /></S>
          </RequireAuth>
        } />
        <Route path="/vendor" element={
          <RequireAuth roles={['vendor_admin', 'admin']}>
            <S><VendorDashboard /></S>
          </RequireAuth>
        } />
        <Route path="/vendor/branding" element={
          <RequireAuth roles={['vendor_admin', 'admin']}>
            <S><VendorBranding /></S>
          </RequireAuth>
        } />
        <Route path="/vendor/brand-kit" element={
          <RequireAuth roles={['vendor_admin', 'admin']}>
            <S><VendorBrandKit /></S>
          </RequireAuth>
        } />
        <Route path="/vendor/campaigns" element={
          <RequireAuth roles={['vendor_admin', 'admin']}>
            <UpgradeGate featureId="campaigns"><S><VendorCampaigns /></S></UpgradeGate>
          </RequireAuth>
        } />
        <Route path="/vendor/gift-cards" element={
          <RequireAuth roles={['vendor_admin', 'admin', 'employee']}>
            <UpgradeGate featureId="loyalty"><S><VendorGiftCards /></S></UpgradeGate>
          </RequireAuth>
        } />
        <Route path="/vendor/shop" element={
          <RequireAuth roles={['vendor_admin', 'admin']}>
            <S><VendorShop /></S>
          </RequireAuth>
        } />
        <Route path="/vendor/employee-performance" element={
          <RequireAuth roles={['vendor_admin', 'admin']}>
            <UpgradeGate featureId="employee_management"><S><VendorEmployeePerformance /></S></UpgradeGate>
          </RequireAuth>
        } />
        <Route path="/vendor/time-blocks" element={
          <RequireAuth roles={['vendor_admin', 'admin']}>
            <S><VendorTimeBlocks /></S>
          </RequireAuth>
        } />
        <Route path="/vendor/exports" element={
          <RequireAuth roles={['vendor_admin', 'admin']}>
            <S><VendorExports /></S>
          </RequireAuth>
        } />
        <Route path="/vendor/promos" element={
          <RequireAuth roles={['vendor_admin', 'admin']}>
            <S><VendorPromos /></S>
          </RequireAuth>
        } />
        <Route path="/vendor/analytics" element={
          <RequireAuth roles={['vendor_admin', 'admin']}>
            <S><VendorAnalytics /></S>
          </RequireAuth>
        } />
        <Route path="/vendor/calendar" element={
          <RequireAuth roles={['vendor_admin', 'admin']}>
            <S><VendorCalendar /></S>
          </RequireAuth>
        } />
        <Route path="/vendor/livemap" element={
          <RequireAuth roles={['vendor_admin', 'admin']}>
            <UpgradeGate featureId="gps_tracking"><S><VendorLiveMap /></S></UpgradeGate>
          </RequireAuth>
        } />
        <Route path="/vendor/subscriptions" element={
          <RequireAuth roles={['vendor_admin', 'admin']}>
            <S><VendorSubscriptions /></S>
          </RequireAuth>
        } />
        <Route path="/vendor/corporate" element={
          <RequireAuth roles={['vendor_admin', 'admin']}>
            <S><VendorCorporate /></S>
          </RequireAuth>
        } />
        <Route path="/vendor/platform-sub" element={
          <RequireAuth roles={['vendor_admin', 'admin']}>
            <S><VendorPlatformSub /></S>
          </RequireAuth>
        } />
        <Route path="/vendor/queue" element={
          <RequireAuth roles={['vendor_admin', 'admin', 'employee']}>
            <S><VendorQueue /></S>
          </RequireAuth>
        } />
        <Route path="/vendor/pos" element={
          <RequireAuth roles={['vendor_admin', 'admin', 'employee']}>
            <UpgradeGate featureId="pos"><S><VendorPOS /></S></UpgradeGate>
          </RequireAuth>
        } />
        <Route path="/vendor/schedule" element={
          <RequireAuth roles={['vendor_admin', 'admin', 'employee']}>
            <S><VendorSchedule /></S>
          </RequireAuth>
        } />
        <Route path="/vendor/fleet" element={
          <RequireAuth roles={['vendor_admin', 'admin']}>
            <S><VendorFleet /></S>
          </RequireAuth>
        } />
        <Route path="/vendor/employees" element={
          <RequireAuth roles={['vendor_admin', 'admin']}>
            <UpgradeGate featureId="employee_management"><S><VendorEmployees /></S></UpgradeGate>
          </RequireAuth>
        } />
        <Route path="/vendor/setup" element={
          <RequireAuth roles={['vendor_admin', 'admin']}>
            <S><VendorSetup /></S>
          </RequireAuth>
        } />
        <Route path="/vendor/payroll" element={
          <RequireAuth roles={['vendor_admin', 'admin']}>
            <UpgradeGate featureId="employee_management"><S><VendorPayroll /></S></UpgradeGate>
          </RequireAuth>
        } />
        <Route path="/vendor/vat-report" element={
          <RequireAuth roles={['vendor_admin', 'admin']}>
            <UpgradeGate featureId="vat_reports"><S><VendorVatReport /></S></UpgradeGate>
          </RequireAuth>
        } />
        <Route path="/vendor/ratings" element={
          <RequireAuth roles={['vendor_admin', 'admin']}>
            <S><VendorRatings /></S>
          </RequireAuth>
        } />
        <Route path="/vendor/shifts" element={
          <RequireAuth roles={['vendor_admin', 'admin']}>
            <UpgradeGate featureId="employee_management"><S><VendorShifts /></S></UpgradeGate>
          </RequireAuth>
        } />
        <Route path="/vendor/support" element={
          <RequireAuth roles={['vendor_admin', 'admin']}>
            <S><VendorSupport /></S>
          </RequireAuth>
        } />
        <Route path="/vendor/dispatch" element={
          <RequireAuth roles={['vendor_admin', 'admin']}>
            <UpgradeGate featureId="dispatch"><S><VendorDispatch /></S></UpgradeGate>
          </RequireAuth>
        } />
        <Route path="/vendor/settings" element={
          <RequireAuth roles={['vendor_admin', 'admin']}>
            <S><VendorSettings /></S>
          </RequireAuth>
        } />
        <Route path="/vendor/operations" element={
          <RequireAuth roles={['vendor_admin', 'admin']}>
            <S><VendorOperations /></S>
          </RequireAuth>
        } />
        <Route path="/vendor/invoices" element={
          <RequireAuth roles={['vendor_admin', 'admin']}>
            <S><VendorInvoices /></S>
          </RequireAuth>
        } />
        <Route path="/vendor/suppliers" element={
          <RequireAuth roles={['vendor_admin', 'admin']}>
            <UpgradeGate featureId="inventory"><S><VendorSuppliers /></S></UpgradeGate>
          </RequireAuth>
        } />
        <Route path="/vendor/expenses" element={
          <RequireAuth roles={['vendor_admin', 'admin']}>
            <AppLayout withSidebar><S><VendorExpenses /></S></AppLayout>
          </RequireAuth>
        } />
        <Route path="/vendor/profit-calculator" element={
          <RequireAuth roles={['vendor_admin', 'admin']}>
            <AppLayout withSidebar><S><VendorProfitCalculator /></S></AppLayout>
          </RequireAuth>
        } />
        <Route path="/vendor/services" element={
          <RequireAuth roles={['vendor_admin', 'admin']}>
            <AppLayout withSidebar><S><VendorServices /></S></AppLayout>
          </RequireAuth>
        } />
        <Route path="/vendor/dynamic-pricing" element={
          <RequireAuth roles={['vendor_admin', 'admin']}>
            <AppLayout withSidebar><S><VendorDynamicPricing /></S></AppLayout>
          </RequireAuth>
        } />

        {/* ── Phase 1: Customer Acquisition ─────────────────────────────── */}
        <Route path="/vendor/automations" element={
          <RequireAuth roles={['vendor_admin', 'admin']}>
            <UpgradeGate featureId="automations"><S><VendorAutomations /></S></UpgradeGate>
          </RequireAuth>
        } />
        <Route path="/vendor/segments" element={
          <RequireAuth roles={['vendor_admin', 'admin']}>
            <UpgradeGate featureId="customer_segments"><S><VendorCustomerSegments /></S></UpgradeGate>
          </RequireAuth>
        } />
        <Route path="/vendor/financial-statements" element={
          <RequireAuth roles={['vendor_admin', 'admin']}>
            <UpgradeGate featureId="financial_statements"><S><VendorFinancialStatements /></S></UpgradeGate>
          </RequireAuth>
        } />
        <Route path="/vendor/crm" element={
          <RequireAuth roles={['vendor_admin', 'admin']}>
            <UpgradeGate featureId="crm"><S><VendorCRM /></S></UpgradeGate>
          </RequireAuth>
        } />
        <Route path="/vendor/advanced-analytics" element={
          <RequireAuth roles={['vendor_admin', 'admin']}>
            <UpgradeGate featureId="advanced_dashboard"><S><VendorAdvancedAnalytics /></S></UpgradeGate>
          </RequireAuth>
        } />
        <Route path="/vendor/help" element={
          <RequireAuth roles={['vendor_admin', 'admin', 'employee']}>
            <S><VendorHelpCenter /></S>
          </RequireAuth>
        } />
        <Route path="/vendor/notifications" element={
          <RequireAuth roles={['vendor_admin', 'admin', 'employee']}>
            <S><VendorNotificationCenter /></S>
          </RequireAuth>
        } />
        <Route path="/vendor/audit-log" element={
          <RequireAuth roles={['vendor_admin', 'admin']}>
            <S><VendorAuditLog /></S>
          </RequireAuth>
        } />
        <Route path="/vendor/referrals" element={
          <RequireAuth roles={['vendor_admin', 'admin']}>
            <S><VendorReferralProgram /></S>
          </RequireAuth>
        } />
        <Route path="/vendor/branches" element={
          <RequireAuth roles={['vendor_admin', 'admin']}>
            <S><VendorBranches /></S>
          </RequireAuth>
        } />
        <Route path="/vendor/payment-gateway" element={
          <RequireAuth roles={['vendor_admin', 'admin']}>
            <S><VendorPaymentGateway /></S>
          </RequireAuth>
        } />
        <Route path="/vendor/autopilot" element={
          <RequireAuth roles={['vendor_admin', 'admin']}>
            <S><VendorAutopilot /></S>
          </RequireAuth>
        } />
        <Route path="/vendor/kyc" element={
          <RequireAuth roles={['vendor_admin', 'admin']}>
            <S><VendorKyc /></S>
          </RequireAuth>
        } />
        <Route path="/vendor/ai-advisor" element={
          <RequireAuth roles={['vendor_admin', 'admin']}>
            <UpgradeGate featureId="ai_advisor"><S><VendorAIAdvisor /></S></UpgradeGate>
          </RequireAuth>
        } />
        <Route path="/vendor/leaderboard" element={
          <RequireAuth roles={['vendor_admin', 'admin', 'employee']}>
            <UpgradeGate featureId="employee_management"><S><VendorLeaderboard /></S></UpgradeGate>
          </RequireAuth>
        } />
        <Route path="/vendor/refer" element={
          <RequireAuth roles={['vendor_admin', 'admin']}>
            <S><VendorReferVendor /></S>
          </RequireAuth>
        } />
        <Route path="/vendor/store-builder" element={
          <RequireAuth roles={['vendor_admin', 'admin']}>
            <S><VendorStoreBuilder /></S>
          </RequireAuth>
        } />
        <Route path="/vendor/gallery" element={
          <RequireAuth roles={['vendor_admin', 'admin']}>
            <AppLayout withSidebar><S><VendorGallery /></S></AppLayout>
          </RequireAuth>
        } />
        <Route path="/vendor/pages" element={
          <RequireAuth roles={['vendor_admin', 'admin']}>
            <AppLayout withSidebar><S><VendorPages /></S></AppLayout>
          </RequireAuth>
        } />
        <Route path="/vendor/customer-import" element={
          <RequireAuth roles={['vendor_admin', 'admin']}>
            <UpgradeGate featureId="crm"><S><VendorCustomerImport /></S></UpgradeGate>
          </RequireAuth>
        } />

        {/* ── Public Live Tracking (token-based, no auth) ───────────────── */}
        <Route path="/track/:bookingId/:token" element={<S><LiveTracking /></S>} />

        {/* ── Public Queue Pages ─────────────────────────────────────────── */}
        <Route path="/queue/:vendorSlug" element={<S><QueueDisplay /></S>} />
        <Route path="/queue/:vendorSlug/join" element={<S><QueueJoin /></S>} />

        {/* ── Customer extras ───────────────────────────────────────────── */}
        <Route path="/app/subscriptions" element={
          <RequireAuth roles={['customer']}>
            <AppLayout><S><CustomerSubscriptions /></S></AppLayout>
          </RequireAuth>
        } />
        <Route path="/app/invoice/:bookingId" element={
          <RequireAuth roles={['customer']}>
            <AppLayout><S><CustomerInvoice /></S></AppLayout>
          </RequireAuth>
        } />
        <Route path="/app/booking/:id" element={
          <RequireAuth roles={['customer']}>
            <AppLayout><S><CustomerBookingDetail /></S></AppLayout>
          </RequireAuth>
        } />
        <Route path="/app/achievements" element={
          <RequireAuth roles={['customer']}>
            <AppLayout><S><CustomerAchievements /></S></AppLayout>
          </RequireAuth>
        } />
        <Route path="/app/referrals" element={
          <RequireAuth roles={['customer']}>
            <AppLayout><S><CustomerReferral /></S></AppLayout>
          </RequireAuth>
        } />
        <Route path="/onboarding" element={<S><Onboarding /></S>} />

        {/* ── Super Admin ───────────────────────────────────────────────── */}
        <Route path="/super-admin/login" element={<S><AdminLogin /></S>} />
        <Route path="/super-admin" element={
          <RequireAuth roles={['super_admin']}>
            <S><SuperAdminDashboard /></S>
          </RequireAuth>
        } />
        <Route path="/super-admin/vendors" element={
          <RequireAuth roles={['super_admin']}>
            <S><SuperAdminVendors /></S>
          </RequireAuth>
        } />
        <Route path="/super-admin/revenue" element={
          <RequireAuth roles={['super_admin']}>
            <S><SuperAdminRevenue /></S>
          </RequireAuth>
        } />
        <Route path="/super-admin/support" element={
          <RequireAuth roles={['super_admin']}>
            <S><SuperAdminSupport /></S>
          </RequireAuth>
        } />
        <Route path="/super-admin/users" element={
          <RequireAuth roles={['super_admin']}>
            <S><SuperAdminUsers /></S>
          </RequireAuth>
        } />
        <Route path="/super-admin/kyc" element={
          <RequireAuth roles={['super_admin']}>
            <S><SuperAdminKyc /></S>
          </RequireAuth>
        } />
        <Route path="/super-admin/health" element={
          <RequireAuth roles={['super_admin']}>
            <S><SuperAdminHealth /></S>
          </RequireAuth>
        } />
        <Route path="/super-admin/announce" element={
          <RequireAuth roles={['super_admin']}>
            <S><SuperAdminAnnounce /></S>
          </RequireAuth>
        } />
        <Route path="/super-admin/audit-logs" element={
          <RequireAuth roles={['super_admin']}>
            <S><SuperAdminAuditLogs /></S>
          </RequireAuth>
        } />
        <Route path="/super-admin/plans" element={
          <RequireAuth roles={['super_admin']}>
            <S><SuperAdminPlans /></S>
          </RequireAuth>
        } />

        {/* ── Catch-all — 404 page ─────────────────────────────────────── */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnimatePresence>
    </>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

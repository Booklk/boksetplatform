import {
  pgTable, text, integer, decimal, boolean, timestamp,
  jsonb, serial, varchar, unique, numeric, index, type AnyPgColumn,
} from 'drizzle-orm/pg-core';

// ─── VENDORS (Multi-Tenant Core) ──────────────────────────────────────────────

export const vendors = pgTable('vendors', {
  id: serial('id').primaryKey(),
  nameAr: varchar('name_ar', { length: 255 }).notNull(),
  nameEn: varchar('name_en', { length: 255 }),
  slug: varchar('slug', { length: 100 }).notNull().unique(), // URL: /store/:slug
  logoUrl: text('logo_url'),
  coverImageUrl: text('cover_image_url'),
  primaryColor: varchar('primary_color', { length: 7 }).default('#1e3a8a'), // hex
  phone: varchar('phone', { length: 20 }),
  email: varchar('email', { length: 255 }),
  address: text('address'),
  city: varchar('city', { length: 100 }).default('الرياض'),
  serviceAreas: jsonb('service_areas').$type<string[]>().default([]),
  ownerId: integer('owner_id').references((): AnyPgColumn => users.id),

  // Platform subscription
  subscriptionStatus: varchar('subscription_status', { length: 20 }).notNull().default('trial'),
  // trial | active | suspended | expired
  subscriptionPlan: varchar('subscription_plan', { length: 20 }).default('yearly'),
  // basic | pro | enterprise
  subscriptionAmount: decimal('subscription_amount', { precision: 10, scale: 2 }),
  subscriptionStartDate: timestamp('subscription_start_date'),
  subscriptionEndDate: timestamp('subscription_end_date'),
  trialEndsAt: timestamp('trial_ends_at'),

  // BYOC: vendor's own WhatsApp Business credentials (AES-256 encrypted)
  whatsappPhoneId: varchar('whatsapp_phone_id', { length: 255 }), // encrypted
  whatsappToken: text('whatsapp_token'), // encrypted

  // BYOC: vendor's own payment gateway (jsonb encrypted)
  paymentConfig: jsonb('payment_config').$type<{
    provider: 'stcpay' | 'checkout' | 'tabby' | 'tamara' | 'moyasar';
    merchantId?: string;
    apiKey?: string;
    secretKey?: string;
    sandboxMode?: boolean;
  } | null>(),

  // Custom domain for white-label per-vendor experiences
  customDomain: varchar('custom_domain', { length: 255 }).unique(), // e.g. crystalwash.sa

  // Industry / sector (القطاع)
  industry: varchar('industry', { length: 50 }).notNull().default('car_wash'),
  // car_wash | home_cleaning | ac_maintenance | plumbing | electrical |
  // pest_control | landscaping | carpet_cleaning | furniture_moving |
  // sanitization | personal_training | home_cooking | barber | other
  industryLabel: varchar('industry_label', { length: 100 }), // custom Arabic label if industry=other

  // Business Identity (السجل التجاري والهوية)
  crNumber: varchar('cr_number', { length: 20 }),           // رقم السجل التجاري
  vatNumber: varchar('vat_number', { length: 20 }),          // الرقم الضريبي (VAT/TIN)
  nationalAddress: text('national_address'),                  // العنوان الوطني
  bankName: varchar('bank_name', { length: 100 }),           // اسم البنك
  bankIban: varchar('bank_iban', { length: 34 }),             // IBAN
  ownerName: varchar('owner_name', { length: 255 }),         // اسم المالك / الممثل النظامي
  businessType: varchar('business_type', { length: 50 }),    // مؤسسة فردية | شركة | ...
  maroofNumber: varchar('maroof_number', { length: 20 }),    // رقم معروف (وزارة التجارة)

  // PWA app icon (shown when customer saves to home screen)
  appIconUrl: text('app_icon_url'), // Custom PWA app icon (512x512)

  // Marketplace visibility (optional — vendor chooses to appear or not)
  showInMarketplace: boolean('show_in_marketplace').notNull().default(false),

  // Appearance
  descriptionAr: text('description_ar'),
  rating: decimal('rating', { precision: 3, scale: 2 }).default('0'),
  reviewsCount: integer('reviews_count').default(0),

  // Google Reviews integration
  googleReviewLink: text('google_review_link'),

  isActive: boolean('is_active').notNull().default(true),
  autoReorderEnabled: boolean('auto_reorder_enabled').notNull().default(false),
  settings: jsonb('settings').$type<Record<string, unknown>>().default({}),

  // Founding Member — first 100 vendors, price locked forever
  isFoundingMember: boolean('is_founding_member').notNull().default(false),
  foundingMemberSince: timestamp('founding_member_since'),

  // AI Brand Kit
  brandKit: jsonb('brand_kit').$type<{
    description: string;
    coverImageUrl: string;
    qrCodeDataUrl: string;
    socialPostText: string;
    generatedAt: string;
  } | null>().default(null),
  brandKitGeneratedCount: integer('brand_kit_generated_count').notNull().default(0),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ─── USERS ────────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  vendorId: integer('vendor_id').references((): AnyPgColumn => vendors.id),
  // null = super_admin | has value = belongs to this vendor (admin/employee/customer)
  name: varchar('name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 20 }).notNull(),
  email: varchar('email', { length: 255 }),
  passwordHash: text('password_hash'),
  firebaseUid: varchar('firebase_uid', { length: 255 }),
  role: varchar('role', { length: 20 }).notNull().default('customer'),
  // super_admin | vendor_admin | admin | employee | customer
  isActive: boolean('is_active').notNull().default(true),
  isOnDuty: boolean('is_on_duty').default(false),
  lastReminderSentAt: timestamp('last_reminder_sent_at'), // proactive wash reminder throttle
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ─── SERVICES ─────────────────────────────────────────────────────────────────

export const services = pgTable('services', {
  id: serial('id').primaryKey(),
  vendorId: integer('vendor_id').notNull().references(() => vendors.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  icon: varchar('icon', { length: 100 }),
  imageUrl: text('image_url'),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── PACKAGES ─────────────────────────────────────────────────────────────────

export const packages = pgTable('packages', {
  id: serial('id').primaryKey(),
  vendorId: integer('vendor_id').notNull().references(() => vendors.id, { onDelete: 'cascade' }),
  serviceId: integer('service_id').notNull().references(() => services.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  duration: integer('duration').notNull(), // minutes
  features: jsonb('features').$type<string[]>().notNull().default([]),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── CUSTOMERS ────────────────────────────────────────────────────────────────

export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  vendorId: integer('vendor_id').notNull().references(() => vendors.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // Single vehicle (legacy, vehicles table is preferred)
  vehicleType: varchar('vehicle_type', { length: 100 }),
  vehiclePlate: varchar('vehicle_plate', { length: 20 }),
  vehicleColor: varchar('vehicle_color', { length: 50 }),
  vehicleModel: varchar('vehicle_model', { length: 100 }),
  defaultAddress: text('default_address'),
  defaultLat: decimal('default_lat', { precision: 10, scale: 7 }),
  defaultLng: decimal('default_lng', { precision: 10, scale: 7 }),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── VEHICLES (Multiple per customer, per vendor) ─────────────────────────────

export const vehicles = pgTable('vehicles', {
  id: serial('id').primaryKey(),
  customerId: integer('customer_id').notNull().references(() => customers.id),
  vendorId: integer('vendor_id').notNull().references(() => vendors.id),
  label: varchar('label', { length: 100 }), // e.g. "سيارتي الرئيسية"
  type: varchar('type', { length: 50 }), // سيدان | SUV | بيكاب | فان
  plate: varchar('plate', { length: 20 }),
  color: varchar('color', { length: 50 }),
  model: varchar('model', { length: 100 }),
  year: integer('year'),
  isDefault: boolean('is_default').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── BOOKINGS ─────────────────────────────────────────────────────────────────

export const bookings = pgTable('bookings', {
  id: serial('id').primaryKey(),
  vendorId: integer('vendor_id').notNull().references(() => vendors.id, { onDelete: 'cascade' }),
  bookingNumber: varchar('booking_number', { length: 20 }).notNull().unique(),
  customerId: integer('customer_id').notNull().references(() => users.id),
  employeeId: integer('employee_id').references(() => users.id),
  fleetVehicleId: integer('fleet_vehicle_id').references(() => fleetVehicles.id),
  packageId: integer('package_id').notNull().references(() => packages.id),
  vehicleId: integer('vehicle_id').references(() => vehicles.id),
  vehicleType: varchar('vehicle_type', { length: 100 }),
  vehiclePlate: varchar('vehicle_plate', { length: 20 }),
  vehicleColor: varchar('vehicle_color', { length: 50 }),
  vehicleModel: varchar('vehicle_model', { length: 100 }),
  address: text('address').notNull(),
  lat: decimal('lat', { precision: 10, scale: 7 }),
  lng: decimal('lng', { precision: 10, scale: 7 }),
  scheduledAt: timestamp('scheduled_at').notNull(),
  status: varchar('status', { length: 30 }).notNull().default('pending'),
  // pending | confirmed | on_way | arrived | in_progress | completed | cancelled
  statusHistory: jsonb('status_history').$type<{ status: string; at: string; by?: number }[]>().default([]),
  notes: text('notes'),
  rating: integer('rating'), // 1-5
  ratingComment: text('rating_comment'),
  ratedAt: timestamp('rated_at'),
  totalPrice: decimal('total_price', { precision: 10, scale: 2 }),
  discountAmount: decimal('discount_amount', { precision: 10, scale: 2 }).default('0'),
  promoCodeId: integer('promo_code_id'),
  paymentMethod: varchar('payment_method', { length: 30 }).default('cash'),
  // cash | stcpay | mada | apple_pay | corporate
  paymentStatus: varchar('payment_status', { length: 20 }).default('pending'),
  // pending | paid | refunded
  invoiceUrl: text('invoice_url'), // PDF invoice path
  // Rating reply by vendor
  vendorReply: text('vendor_reply'),
  vendorRepliedAt: timestamp('vendor_replied_at'),
  // Cancellation
  cancelledAt: timestamp('cancelled_at'),
  cancelReason: text('cancel_reason'),
  refundAmount: decimal('refund_amount', { precision: 10, scale: 2 }),
  // Tracking token for public live-tracking link (no auth required)
  trackingToken: varchar('tracking_token', { length: 64 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ─── BOOKING PHOTOS (before/after/damage) ─────────────────────────────────────

export const bookingPhotos = pgTable('booking_photos', {
  id: serial('id').primaryKey(),
  bookingId: integer('booking_id').notNull().references(() => bookings.id),
  phase: varchar('phase', { length: 20 }).notNull(), // before | after | damage
  photoUrl: text('photo_url').notNull(),
  uploadedBy: integer('uploaded_by').references(() => users.id),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── PAYMENTS ─────────────────────────────────────────────────────────────────

export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  bookingId: integer('booking_id').notNull().references(() => bookings.id),
  vendorId: integer('vendor_id').notNull().references(() => vendors.id),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).default('SAR'),
  method: varchar('method', { length: 30 }).notNull(), // stcpay | mada | apple_pay | cash | corporate
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  // pending | processing | paid | failed | refunded
  gatewayRef: varchar('gateway_ref', { length: 255 }),
  gatewayResponse: jsonb('gateway_response'),
  paidAt: timestamp('paid_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── PROMO CODES ──────────────────────────────────────────────────────────────

export const promoCodes = pgTable('promo_codes', {
  id: serial('id').primaryKey(),
  vendorId: integer('vendor_id').notNull().references(() => vendors.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 50 }).notNull(),
  descriptionAr: text('description_ar'),
  discountType: varchar('discount_type', { length: 10 }).notNull(), // percent | fixed
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }).notNull(),
  minOrderAmount: decimal('min_order_amount', { precision: 10, scale: 2 }).default('0'),
  maxUses: integer('max_uses'), // null = unlimited
  usedCount: integer('used_count').notNull().default(0),
  validFrom: timestamp('valid_from'),
  validUntil: timestamp('valid_until'),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const promoCodeUsages = pgTable('promo_code_usages', {
  id: serial('id').primaryKey(),
  promoCodeId: integer('promo_code_id').notNull().references(() => promoCodes.id),
  customerId: integer('customer_id').notNull().references(() => users.id),
  bookingId: integer('booking_id').references(() => bookings.id),
  discountAmount: decimal('discount_amount', { precision: 10, scale: 2 }),
  usedAt: timestamp('used_at').notNull().defaultNow(),
});

// ─── LOYALTY PROGRAMS (per vendor — optional) ─────────────────────────────────

export const loyaltyPrograms = pgTable('loyalty_programs', {
  id: serial('id').primaryKey(),
  vendorId: integer('vendor_id').notNull().references(() => vendors.id),
  programType: varchar('program_type', { length: 20 }).notNull().default('disabled'),
  // points | punch_card | disabled

  // If points:
  pointsPerSAR: decimal('points_per_sar', { precision: 5, scale: 2 }).default('1'),
  pointsValueInSAR: decimal('points_value_in_sar', { precision: 5, scale: 2 }).default('0.05'),
  minRedeemPoints: integer('min_redeem_points').default(100),

  // If punch_card:
  washesRequired: integer('washes_required').default(6),
  freeWashPackageId: integer('free_wash_package_id').references(() => packages.id),
  freeWashDescription: text('free_wash_description').default('الغسلة السابعة مجانية'),

  isActive: boolean('is_active').notNull().default(false),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ─── LOYALTY POINTS (per vendor, per customer) ────────────────────────────────

export const loyaltyPoints = pgTable('loyalty_points', {
  id: serial('id').primaryKey(),
  vendorId: integer('vendor_id').notNull().references(() => vendors.id),
  customerId: integer('customer_id').notNull().references(() => users.id),
  transactionType: varchar('transaction_type', { length: 20 }).notNull(),
  // earn | redeem | expire | bonus
  points: integer('points').notNull(),
  bookingId: integer('booking_id').references(() => bookings.id),
  description: text('description'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── PUNCH CARDS (per vendor, per customer) ───────────────────────────────────

export const punchCards = pgTable('punch_cards', {
  id: serial('id').primaryKey(),
  customerId: integer('customer_id').notNull().references(() => users.id),
  vendorId: integer('vendor_id').notNull().references(() => vendors.id),
  vehicleId: integer('vehicle_id').references(() => vehicles.id),
  stampsEarned: integer('stamps_earned').notNull().default(0),
  stampsRequired: integer('stamps_required').notNull().default(6),
  isRedeemed: boolean('is_redeemed').notNull().default(false),
  redeemedAt: timestamp('redeemed_at'),
  redeemedBookingId: integer('redeemed_booking_id').references(() => bookings.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'), // when stamps reached required
});

// ─── LOYALTY TIERS (for points-based only, per vendor) ────────────────────────

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  vendorId: integer('vendor_id').notNull().references(() => vendors.id),
  nameAr: varchar('name_ar', { length: 100 }).notNull(),
  minPoints: integer('min_points').notNull(),
  maxPoints: integer('max_points'),
  discountPercent: decimal('discount_percent', { precision: 5, scale: 2 }).default('0'),
  pointsMultiplier: decimal('points_multiplier', { precision: 3, scale: 1 }).default('1'),
  benefits: jsonb('benefits').$type<string[]>().default([]),
  color: varchar('color', { length: 7 }).default('#6366f1'),
  icon: varchar('icon', { length: 50 }).default('star'),
  sortOrder: integer('sort_order').notNull().default(0),
});

// ─── SUBSCRIPTION PLANS (per vendor) ─────────────────────────────────────────

export const subscriptionPlans = pgTable('subscription_plans', {
  id: serial('id').primaryKey(),
  vendorId: integer('vendor_id').notNull().references(() => vendors.id),
  nameAr: varchar('name_ar', { length: 255 }).notNull(),
  packageId: integer('package_id').references(() => packages.id),
  billingCycle: varchar('billing_cycle', { length: 20 }).notNull(), // weekly | monthly
  washesIncluded: integer('washes_included').notNull(),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  discountPercent: decimal('discount_percent', { precision: 5, scale: 2 }).default('0'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const customerSubscriptions = pgTable('customer_subscriptions', {
  id: serial('id').primaryKey(),
  customerId: integer('customer_id').notNull().references(() => users.id),
  planId: integer('plan_id').notNull().references(() => subscriptionPlans.id),
  vendorId: integer('vendor_id').notNull().references(() => vendors.id),
  vehicleId: integer('vehicle_id').references(() => vehicles.id),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  // active | paused | cancelled | expired
  startDate: timestamp('start_date').notNull().defaultNow(),
  endDate: timestamp('end_date').notNull(),
  nextBillingDate: timestamp('next_billing_date'),
  washesRemaining: integer('washes_remaining').notNull(),
  autoRenew: boolean('auto_renew').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── EMPLOYEE LOCATIONS (GPS Tracking) ───────────────────────────────────────

export const employeeLocations = pgTable('employee_locations', {
  id: serial('id').primaryKey(),
  employeeId: integer('employee_id').notNull().references(() => users.id),
  vendorId: integer('vendor_id').notNull().references(() => vendors.id),
  lat: decimal('lat', { precision: 10, scale: 7 }).notNull(),
  lng: decimal('lng', { precision: 10, scale: 7 }).notNull(),
  accuracy: decimal('accuracy', { precision: 8, scale: 2 }),
  heading: decimal('heading', { precision: 6, scale: 2 }),
  speed: decimal('speed', { precision: 8, scale: 2 }),
  bookingId: integer('booking_id').references(() => bookings.id),
  recordedAt: timestamp('recorded_at').notNull().defaultNow(),
});

// ─── PUSH SUBSCRIPTIONS (Web Push / VAPID) ───────────────────────────────────

export const pushSubscriptions = pgTable('push_subscriptions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  deviceType: varchar('device_type', { length: 20 }).default('web'), // web | android | ios
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── WHATSAPP SESSIONS (Bot State Machine) ────────────────────────────────────

export const whatsappSessions = pgTable('whatsapp_sessions', {
  id: serial('id').primaryKey(),
  phone: varchar('phone', { length: 20 }).notNull().unique(),
  customerId: integer('customer_id').references(() => users.id),
  vendorId: integer('vendor_id').references(() => vendors.id),
  state: varchar('state', { length: 50 }).notNull().default('idle'),
  // idle | selecting_vendor | selecting_service | selecting_package | entering_address | confirming | done
  context: jsonb('context').$type<Record<string, unknown>>().default({}),
  lastMessageAt: timestamp('last_message_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at'),
});

// ─── CORPORATE ACCOUNTS ───────────────────────────────────────────────────────

export const corporateAccounts = pgTable('corporate_accounts', {
  id: serial('id').primaryKey(),
  vendorId: integer('vendor_id').notNull().references(() => vendors.id),
  nameAr: varchar('name_ar', { length: 255 }).notNull(),
  vatNumber: varchar('vat_number', { length: 50 }),
  contactName: varchar('contact_name', { length: 255 }),
  contactPhone: varchar('contact_phone', { length: 20 }),
  billingCycle: varchar('billing_cycle', { length: 20 }).default('monthly'),
  creditLimit: decimal('credit_limit', { precision: 10, scale: 2 }).default('0'),
  currentBalance: decimal('current_balance', { precision: 10, scale: 2 }).default('0'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const corporateMembers = pgTable('corporate_members', {
  id: serial('id').primaryKey(),
  corporateId: integer('corporate_id').notNull().references(() => corporateAccounts.id),
  userId: integer('user_id').notNull().references(() => users.id),
  role: varchar('role', { length: 20 }).default('member'), // admin | member
  maxMonthlyBookings: integer('max_monthly_bookings'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── VENDOR SUBSCRIPTION PAYMENTS (to platform) ──────────────────────────────

export const vendorSubscriptionPayments = pgTable('vendor_subscription_payments', {
  id: serial('id').primaryKey(),
  vendorId: integer('vendor_id').notNull().references(() => vendors.id),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  period: varchar('period', { length: 20 }), // e.g. "2025-01"
  plan: varchar('plan', { length: 20 }), // basic | pro | enterprise
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  // pending | paid | failed
  paidAt: timestamp('paid_at'),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── INVENTORY ────────────────────────────────────────────────────────────────

export const inventory = pgTable('inventory', {
  id: serial('id').primaryKey(),
  vendorId: integer('vendor_id').notNull().references(() => vendors.id),
  name: varchar('name', { length: 255 }).notNull(),
  unit: varchar('unit', { length: 50 }).notNull(),
  quantity: decimal('quantity', { precision: 10, scale: 2 }).notNull().default('0'),
  minQuantity: decimal('min_quantity', { precision: 10, scale: 2 }).notNull().default('0'),
  costPerUnit: decimal('cost_per_unit', { precision: 10, scale: 2 }).notNull().default('0'),
  supplier: varchar('supplier', { length: 255 }),
  notes: text('notes'),
  supplierId: integer('supplier_id'),  // FK to suppliers (added via migration)
  reorderQuantity: numeric('reorder_quantity').default('10'),  // how much to order when low
  autoReorderEnabled: boolean('auto_reorder_enabled').notNull().default(true),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const inventoryTransactions = pgTable('inventory_transactions', {
  id: serial('id').primaryKey(),
  vendorId: integer('vendor_id').notNull().references(() => vendors.id),
  inventoryId: integer('inventory_id').notNull().references(() => inventory.id),
  type: varchar('type', { length: 20 }).notNull(), // in | out | adjustment
  quantity: decimal('quantity', { precision: 10, scale: 2 }).notNull(),
  notes: text('notes'),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── FINANCIALS ───────────────────────────────────────────────────────────────

export const financials = pgTable('financials', {
  id: serial('id').primaryKey(),
  vendorId: integer('vendor_id').notNull().references(() => vendors.id),
  type: varchar('type', { length: 30 }).notNull(), // income | expense | salary | maintenance
  category: varchar('category', { length: 100 }),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  description: text('description').notNull(),
  notes: text('notes'),
  referenceId: integer('reference_id'),
  referenceType: varchar('reference_type', { length: 50 }), // booking | manual
  employeeId: integer('employee_id').references(() => users.id),
  date: timestamp('date').notNull().defaultNow(),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── WHATSAPP CAMPAIGNS (Manual broadcast campaigns) ─────────────────────────

export const whatsappCampaigns = pgTable('whatsapp_campaigns', {
  id: serial('id').primaryKey(),
  vendorId: integer('vendor_id').notNull().references(() => vendors.id),
  name: varchar('name', { length: 255 }).notNull(),
  segment: varchar('segment', { length: 50 }).notNull(),
  // all | inactive_21 | inactive_14 | top_customers | custom
  message: text('message').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  // draft | sending | sent | failed
  recipientCount: integer('recipient_count').default(0),
  sentCount: integer('sent_count').default(0),
  failedCount: integer('failed_count').default(0),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── TIME BLOCKS (Pause bookings for maintenance/breaks) ─────────────────────

export const timeBlocks = pgTable('time_blocks', {
  id: serial('id').primaryKey(),
  vendorId: integer('vendor_id').notNull().references(() => vendors.id),
  title: varchar('title', { length: 255 }).notNull(),
  reason: varchar('reason', { length: 50 }).default('maintenance'),
  // maintenance | break | holiday | full | other
  startsAt: timestamp('starts_at').notNull(),
  endsAt: timestamp('ends_at').notNull(),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── GIFT CARDS ───────────────────────────────────────────────────────────────

export const giftCards = pgTable('gift_cards', {
  id: serial('id').primaryKey(),
  vendorId: integer('vendor_id').notNull().references(() => vendors.id),
  code: varchar('code', { length: 20 }).notNull().unique(),
  originalAmount: decimal('original_amount', { precision: 10, scale: 2 }).notNull(),
  currentBalance: decimal('current_balance', { precision: 10, scale: 2 }).notNull(),
  issuedTo: text('issued_to'), // customer name (optional)
  issuedToPhone: varchar('issued_to_phone', { length: 20 }),
  redeemedByUserId: integer('redeemed_by_user_id').references(() => users.id),
  redeemedAt: timestamp('redeemed_at'),
  redeemedBookingId: integer('redeemed_booking_id').references(() => bookings.id),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  // active | partially_used | redeemed | expired
  expiresAt: timestamp('expires_at'),
  purchasedByUserId: integer('purchased_by_user_id').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── VENDOR PRODUCTS (Sell products alongside wash service) ───────────────────

export const vendorProducts = pgTable('vendor_products', {
  id: serial('id').primaryKey(),
  vendorId: integer('vendor_id').notNull().references(() => vendors.id),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  imageUrl: text('image_url'),
  stock: integer('stock').notNull().default(0),
  category: varchar('category', { length: 100 }).default('general'),
  // general | care | fragrance | accessories | cleaning
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Products added to a booking (delivered by employee with the wash)
export const bookingProducts = pgTable('booking_products', {
  id: serial('id').primaryKey(),
  bookingId: integer('booking_id').notNull().references(() => bookings.id),
  vendorId: integer('vendor_id').notNull().references(() => vendors.id),
  productId: integer('product_id').references(() => vendorProducts.id),
  productName: varchar('product_name', { length: 255 }).notNull(), // snapshot
  quantity: integer('quantity').notNull().default(1),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal('total_price', { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── SERVICE-INVENTORY LINKS (Auto deduct on booking complete) ────────────────

export const serviceInventoryLinks = pgTable('service_inventory_links', {
  id: serial('id').primaryKey(),
  vendorId: integer('vendor_id').notNull().references(() => vendors.id),
  serviceId: integer('service_id').notNull().references(() => services.id),
  inventoryId: integer('inventory_id').notNull().references(() => inventory.id),
  quantityPerUse: decimal('quantity_per_use', { precision: 10, scale: 3 }).notNull().default('1'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── WASH COST FACTORS (Real Profit Calculator) ───────────────────────────────
// Each vendor defines their cost per wash for each expense factor
export const washCostFactors = pgTable('wash_cost_factors', {
  id: serial('id').primaryKey(),
  vendorId: integer('vendor_id').notNull().references(() => vendors.id),
  name: varchar('name', { length: 100 }).notNull(), // e.g. "صابون", "ماء", "بنزين"
  nameKey: varchar('name_key', { length: 50 }), // optional slug: soap, water, fuel
  costPerWash: decimal('cost_per_wash', { precision: 8, scale: 2 }).notNull().default('0'),
  unit: varchar('unit', { length: 30 }), // ريال / مل / لتر
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────

export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  vendorId: integer('vendor_id').references(() => vendors.id),
  bookingId: integer('booking_id').references(() => bookings.id),
  userId: integer('user_id').references(() => users.id),
  type: varchar('type', { length: 50 }).notNull(),
  phone: varchar('phone', { length: 20 }).notNull(),
  message: text('message').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  sentAt: timestamp('sent_at'),
  error: text('error'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── FLEET VEHICLES (Vendor's own vehicles/equipment) ────────────────────────

export const fleetVehicles = pgTable('fleet_vehicles', {
  id: serial('id').primaryKey(),
  vendorId: integer('vendor_id').notNull().references(() => vendors.id),
  assignedEmployeeId: integer('assigned_employee_id').references(() => users.id),

  // Identity
  nameAr: varchar('name_ar', { length: 255 }).notNull(), // e.g. "دبة الماء رقم ١"
  type: varchar('type', { length: 50 }).notNull(),
  // car | pickup | water_tank | van | motorcycle | equipment
  plateNumber: varchar('plate_number', { length: 20 }),
  color: varchar('color', { length: 50 }),
  brand: varchar('brand', { length: 100 }), // Toyota, Ford...
  model: varchar('model', { length: 100 }),
  year: integer('year'),

  // Mileage tracking
  currentMileage: integer('current_mileage').default(0), // km
  lastMileageUpdate: timestamp('last_mileage_update'),

  // Status
  status: varchar('status', { length: 20 }).default('active'),
  // active | maintenance | inactive | sold

  notes: text('notes'),
  imageUrl: text('image_url'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ─── FLEET MAINTENANCE RECORDS ────────────────────────────────────────────────

export const fleetMaintenance = pgTable('fleet_maintenance', {
  id: serial('id').primaryKey(),
  vehicleId: integer('vehicle_id').notNull().references(() => fleetVehicles.id),
  vendorId: integer('vendor_id').notNull().references(() => vendors.id),

  // Maintenance details
  type: varchar('type', { length: 50 }).notNull(),
  // oil_change | tire_rotation | brake_check | full_service | repair | inspection | other
  descriptionAr: text('description_ar'),
  mileageAtService: integer('mileage_at_service').notNull(), // km at time of service
  cost: decimal('cost', { precision: 10, scale: 2 }),
  serviceProvider: varchar('service_provider', { length: 255 }), // workshop name

  // Documents
  receiptUrl: text('receipt_url'),

  performedAt: timestamp('performed_at').notNull().defaultNow(),
  performedBy: integer('performed_by').references(() => users.id), // which employee
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── MAINTENANCE REMINDER SETTINGS ───────────────────────────────────────────

export const maintenanceSettings = pgTable('maintenance_settings', {
  id: serial('id').primaryKey(),
  vehicleId: integer('vehicle_id').notNull().references(() => fleetVehicles.id).unique(),
  vendorId: integer('vendor_id').notNull().references(() => vendors.id),

  // Mileage-based reminders
  mileageIntervalKm: integer('mileage_interval_km').default(5000), // 5000 or 10000
  nextServiceMileage: integer('next_service_mileage'), // auto-calculated

  // Time-based reminders
  timeIntervalDays: integer('time_interval_days'), // e.g. 90 days
  nextServiceDate: timestamp('next_service_date'),

  // Notification prefs
  notifyViaApp: boolean('notify_via_app').default(true),
  notifyViaWhatsapp: boolean('notify_via_whatsapp').default(true),
  alertAtKmBefore: integer('alert_at_km_before').default(500), // warn 500km before due

  isActive: boolean('is_active').default(true),
  lastAlertSentAt: timestamp('last_alert_sent_at'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ─── QUEUE MANAGEMENT ─────────────────────────────────────────────────────────

export const queueSessions = pgTable('queue_sessions', {
  id: serial('id').primaryKey(),
  vendorId: integer('vendor_id').notNull().references(() => vendors.id),
  date: varchar('date', { length: 10 }).notNull(), // YYYY-MM-DD
  isOpen: boolean('is_open').default(true),
  currentNumber: integer('current_number').default(0),
  totalServed: integer('total_served').default(0),
  openedAt: timestamp('opened_at').defaultNow(),
  closedAt: timestamp('closed_at'),
});

export const queueTickets = pgTable('queue_tickets', {
  id: serial('id').primaryKey(),
  vendorId: integer('vendor_id').notNull().references(() => vendors.id),
  sessionId: integer('session_id').notNull().references(() => queueSessions.id),
  ticketNumber: integer('ticket_number').notNull(),
  customerId: integer('customer_id').references(() => users.id),
  customerName: varchar('customer_name', { length: 255 }),
  customerPhone: varchar('customer_phone', { length: 20 }),
  vehiclePlate: varchar('vehicle_plate', { length: 20 }),
  vehicleType: varchar('vehicle_type', { length: 50 }),
  serviceId: integer('service_id').references(() => services.id),
  status: varchar('status', { length: 20 }).default('waiting'),
  // waiting | called | in_service | completed | cancelled | no_show
  calledAt: timestamp('called_at'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  waitMinutes: integer('wait_minutes'), // actual wait time
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── APPOINTMENTS (Time-based bookings for fixed location) ─────────────────────

export const appointmentSlots = pgTable('appointment_slots', {
  id: serial('id').primaryKey(),
  vendorId: integer('vendor_id').notNull().references(() => vendors.id),
  date: varchar('date', { length: 10 }).notNull(), // YYYY-MM-DD
  startTime: varchar('start_time', { length: 5 }).notNull(), // HH:MM
  endTime: varchar('end_time', { length: 5 }).notNull(),
  capacity: integer('capacity').default(1), // how many cars in this slot
  bookedCount: integer('booked_count').default(0),
  isBlocked: boolean('is_blocked').default(false),
});

// ─── POS TRANSACTIONS ─────────────────────────────────────────────────────────

export const posTransactions = pgTable('pos_transactions', {
  id: serial('id').primaryKey(),
  vendorId: integer('vendor_id').notNull().references(() => vendors.id),
  ticketId: integer('ticket_id').references(() => queueTickets.id),
  bookingId: integer('booking_id').references(() => bookings.id),
  employeeId: integer('employee_id').references(() => users.id),

  transactionNumber: varchar('transaction_number', { length: 20 }).notNull(),
  items: jsonb('items').$type<Array<{
    serviceId?: number;
    name: string;
    price: number;
    qty: number;
  }>>().default([]),

  subtotal: decimal('subtotal', { precision: 10, scale: 2 }).notNull(),
  vatAmount: decimal('vat_amount', { precision: 10, scale: 2 }).notNull(), // 15% VAT
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),

  paymentMethod: varchar('payment_method', { length: 20 }).notNull().default('cash'),
  // cash | mada | stcpay | apple_pay | credit
  paymentStatus: varchar('payment_status', { length: 20 }).default('paid'),

  customerName: varchar('customer_name', { length: 255 }),
  customerPhone: varchar('customer_phone', { length: 20 }),

  receiptSentViaWhatsapp: boolean('receipt_sent_via_whatsapp').default(false),

  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── EMPLOYEE PERFORMANCE (daily stats) ──────────────────────────────────────

export const employeeStats = pgTable('employee_stats', {
  id: serial('id').primaryKey(),
  employeeId: integer('employee_id').notNull().references(() => users.id),
  vendorId: integer('vendor_id').notNull().references(() => vendors.id),
  date: timestamp('date').notNull(),
  bookingsCompleted: integer('bookings_completed').default(0),
  revenueGenerated: decimal('revenue_generated', { precision: 10, scale: 2 }).default('0'),
  avgRating: decimal('avg_rating', { precision: 3, scale: 2 }),
  totalWorkMinutes: integer('total_work_minutes').default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({ uniq: unique().on(t.employeeId, t.date) }));

// ─── PAYROLL ──────────────────────────────────────────────────────────────────

export const payrollRecords = pgTable('payroll_records', {
  id: serial('id').primaryKey(),
  vendorId: integer('vendor_id').notNull().references(() => vendors.id),
  employeeId: integer('employee_id').notNull().references(() => users.id),
  month: integer('month').notNull(),   // 1-12
  year: integer('year').notNull(),
  baseSalary: decimal('base_salary', { precision: 10, scale: 2 }).notNull().default('0'),
  commissionRate: decimal('commission_rate', { precision: 5, scale: 2 }).default('0'), // % per booking
  commissionAmount: decimal('commission_amount', { precision: 10, scale: 2 }).default('0'),
  bonusAmount: decimal('bonus_amount', { precision: 10, scale: 2 }).default('0'),
  deductions: decimal('deductions', { precision: 10, scale: 2 }).default('0'),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull().default('0'),
  bookingsCount: integer('bookings_count').default(0),
  revenueGenerated: decimal('revenue_generated', { precision: 10, scale: 2 }).default('0'),
  notes: text('notes'),
  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending | paid
  paidAt: timestamp('paid_at'),
  paidBy: integer('paid_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({ uniq: unique().on(t.employeeId, t.month, t.year) }));

// ─── EMPLOYEE SALARY CONFIG ───────────────────────────────────────────────────

export const employeeSalaryConfig = pgTable('employee_salary_config', {
  id: serial('id').primaryKey(),
  employeeId: integer('employee_id').notNull().references(() => users.id).unique(),
  vendorId: integer('vendor_id').notNull().references(() => vendors.id),
  baseSalary: decimal('base_salary', { precision: 10, scale: 2 }).notNull().default('0'),
  commissionRate: decimal('commission_rate', { precision: 5, scale: 2 }).default('0'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ─── CANCELLATION POLICY ──────────────────────────────────────────────────────
// Stored in vendors.settings.cancellationPolicy, but also as standalone table for future

export const cancellationLogs = pgTable('cancellation_logs', {
  id: serial('id').primaryKey(),
  bookingId: integer('booking_id').notNull().references(() => bookings.id),
  vendorId: integer('vendor_id').notNull().references(() => vendors.id),
  cancelledBy: integer('cancelled_by').references(() => users.id),
  reason: text('reason'),
  refundAmount: decimal('refund_amount', { precision: 10, scale: 2 }).default('0'),
  refundPercent: integer('refund_percent').default(0),
  refundStatus: varchar('refund_status', { length: 20 }).default('pending'), // pending | processed | skipped
  hoursBeforeService: decimal('hours_before_service', { precision: 6, scale: 2 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── EMPLOYEE SHIFTS ──────────────────────────────────────────────────────────

export const employeeShifts = pgTable('employee_shifts', {
  id: serial('id').primaryKey(),
  vendorId: integer('vendor_id').notNull().references(() => vendors.id),
  employeeId: integer('employee_id').notNull().references(() => users.id),
  date: timestamp('date').notNull(), // the day of the shift
  startTime: varchar('start_time', { length: 5 }).notNull(), // HH:MM
  endTime: varchar('end_time', { length: 5 }).notNull(),     // HH:MM
  shiftType: varchar('shift_type', { length: 20 }).default('regular'), // regular | overtime | off
  notes: text('notes'),
  status: varchar('status', { length: 20 }).default('scheduled'), // scheduled | completed | absent | cancelled
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ─── SUPPORT TICKETS ──────────────────────────────────────────────────────────

export const supportTickets = pgTable('support_tickets', {
  id: serial('id').primaryKey(),
  vendorId: integer('vendor_id').references(() => vendors.id), // null = from non-vendor user
  submittedBy: integer('submitted_by').references(() => users.id),
  subject: varchar('subject', { length: 255 }).notNull(),
  category: varchar('category', { length: 50 }).notNull().default('general'),
  // general | billing | technical | feature_request | bug
  priority: varchar('priority', { length: 20 }).default('medium'),
  // low | medium | high | urgent
  status: varchar('status', { length: 20 }).notNull().default('open'),
  // open | in_progress | resolved | closed
  description: text('description').notNull(),
  attachmentUrls: jsonb('attachment_urls').$type<string[]>().default([]),
  adminReply: text('admin_reply'),
  adminRepliedAt: timestamp('admin_replied_at'),
  adminRepliedBy: integer('admin_replied_by').references(() => users.id),
  resolvedAt: timestamp('resolved_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ─── BONUS RULES ──────────────────────────────────────────────────────────────

export const bonusRules = pgTable('bonus_rules', {
  id: serial('id').primaryKey(),
  vendorId: integer('vendor_id').notNull().references(() => vendors.id),
  name: text('name').notNull(),           // "مكافأة 8 غسلات باليوم"
  conditionType: text('condition_type').notNull(), // 'jobs_per_day' | 'rating_avg' | 'revenue_target' | 'no_cancellation_week' | 'top_performer'
  threshold: decimal('threshold', { precision: 10, scale: 2 }).notNull(),   // e.g. 8 (jobs), 4.8 (rating), 1000 (revenue)
  bonusAmount: decimal('bonus_amount', { precision: 10, scale: 2 }).notNull(), // ر.س to add
  period: text('period').notNull().default('monthly'), // 'daily' | 'weekly' | 'monthly'
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

// ─── VEHICLE CREW MEMBERS ─────────────────────────────────────────────────────

export const vehicleCrewMembers = pgTable('vehicle_crew_members', {
  id: serial('id').primaryKey(),
  vehicleId: integer('vehicle_id').notNull().references(() => fleetVehicles.id),
  employeeId: integer('employee_id').notNull().references(() => users.id),
  vendorId: integer('vendor_id').notNull().references(() => vendors.id),
  role: text('role').notNull().default('technician'), // 'driver' | 'technician'
  isActive: boolean('is_active').notNull().default(true),
  assignedAt: timestamp('assigned_at').defaultNow(),
});

// ─── INVOICES ─────────────────────────────────────────────────────────────────

export const invoices = pgTable('invoices', {
  id: serial('id').primaryKey(),
  vendorId: integer('vendor_id').notNull().references(() => vendors.id),
  bookingId: integer('booking_id').references(() => bookings.id),
  customerId: integer('customer_id').references(() => users.id),

  invoiceNumber: varchar('invoice_number', { length: 50 }).notNull().unique(),

  // Customer info (denormalised for portability)
  customerName: varchar('customer_name', { length: 255 }).notNull().default(''),
  customerPhone: varchar('customer_phone', { length: 20 }).notNull().default(''),

  // Line items as JSONB
  items: jsonb('items').$type<Array<{
    description: string;
    qty: number;
    unitPrice: string | number;
  }>>().notNull().default([]),

  // Amounts
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull().default('0'),       // subtotal before VAT
  vatAmount: decimal('vat_amount', { precision: 10, scale: 2 }).notNull().default('0'), // 15% VAT
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull().default('0'), // grand total

  // Status lifecycle: draft → sent → paid → overdue
  status: varchar('status', { length: 20 }).notNull().default('draft'),

  notes: text('notes'),
  dueDate: timestamp('due_date'),
  sentAt: timestamp('sent_at'),
  paidAt: timestamp('paid_at'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ─── SUPPLIERS ────────────────────────────────────────────────────────────────

export const suppliers = pgTable('suppliers', {
  id: serial('id').primaryKey(),
  vendorId: integer('vendor_id').notNull().references(() => vendors.id),
  nameAr: text('name_ar').notNull(),
  phone: text('phone').notNull(),           // WhatsApp number
  email: text('email'),
  contactPerson: text('contact_person'),    // اسم المندوب
  products: text('products'),              // وصف المنتجات التي يوردها
  notes: text('notes'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

export const supplierOrders = pgTable('supplier_orders', {
  id: serial('id').primaryKey(),
  vendorId: integer('vendor_id').notNull().references(() => vendors.id),
  supplierId: integer('supplier_id').notNull().references(() => suppliers.id),
  inventoryItemId: integer('inventory_item_id').references(() => inventory.id),
  itemName: text('item_name').notNull(),
  quantityRequested: numeric('quantity_requested').notNull(),
  unit: text('unit').notNull().default('وحدة'),
  status: text('status').notNull().default('sent'),  // 'sent' | 'confirmed' | 'received' | 'cancelled'
  notes: text('notes'),
  sentAt: timestamp('sent_at').defaultNow(),
  receivedAt: timestamp('received_at'),
  whatsappSent: boolean('whatsapp_sent').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// ─── REFERRALS ────────────────────────────────────────────────────────────────

export const referrals = pgTable('referrals', {
  id: serial('id').primaryKey(),
  vendorId: integer('vendor_id').notNull().references(() => vendors.id),
  referrerId: integer('referrer_id').notNull().references(() => users.id), // who shared
  referredId: integer('referred_id').references(() => users.id), // who signed up
  referralCode: varchar('referral_code', { length: 20 }).notNull().unique(),
  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending | converted | rewarded
  rewardType: varchar('reward_type', { length: 20 }).default('discount'), // discount | points
  rewardAmount: decimal('reward_amount', { precision: 8, scale: 2 }).default('0'),
  convertedAt: timestamp('converted_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// ██  PHASE 1: Customer Acquisition Engine + Security                        ██
// ═══════════════════════════════════════════════════════════════════════════════

// ─── AUDIT LOGS (Security) ──────────────────────────────────────────────────

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  vendorId: integer('vendor_id').references(() => vendors.id),
  userId: integer('user_id').references(() => users.id),
  action: varchar('action', { length: 100 }).notNull(), // e.g. 'payment.refund', 'employee.delete'
  resource: text('resource').notNull(), // API path
  resourceId: integer('resource_id'), // ID of affected resource
  method: varchar('method', { length: 10 }), // GET, POST, PUT, DELETE
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  ip: varchar('ip', { length: 45 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── MARKETING AUTOMATION ───────────────────────────────────────────────────

export const automationWorkflows = pgTable('automation_workflows', {
  id: serial('id').primaryKey(),
  vendorId: integer('vendor_id').notNull().references(() => vendors.id),
  name: varchar('name', { length: 255 }).notNull(),
  nameAr: varchar('name_ar', { length: 255 }),
  triggerType: varchar('trigger_type', { length: 50 }).notNull(),
  // booking_completed | booking_cancelled | inactive_7d | inactive_14d | inactive_21d
  // new_customer | birthday | low_rating | subscription_expiring | abandoned_booking
  triggerConfig: jsonb('trigger_config').$type<Record<string, unknown>>().default({}),
  isActive: boolean('is_active').notNull().default(true),
  totalExecutions: integer('total_executions').notNull().default(0),
  totalConversions: integer('total_conversions').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const automationSteps = pgTable('automation_steps', {
  id: serial('id').primaryKey(),
  workflowId: integer('workflow_id').notNull().references(() => automationWorkflows.id, { onDelete: 'cascade' }),
  stepOrder: integer('step_order').notNull().default(1),
  actionType: varchar('action_type', { length: 50 }).notNull(),
  // send_whatsapp | send_push | send_sms | add_points | apply_promo | wait | condition_check
  config: jsonb('config').$type<{
    message?: string;
    templateName?: string;
    promoCode?: string;
    points?: number;
    delayMinutes?: number;
    conditionField?: string;
    conditionOperator?: string;
    conditionValue?: string;
  }>().default({}),
  delayMinutes: integer('delay_minutes').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const automationExecutions = pgTable('automation_executions', {
  id: serial('id').primaryKey(),
  workflowId: integer('workflow_id').notNull().references(() => automationWorkflows.id, { onDelete: 'cascade' }),
  customerId: integer('customer_id').notNull().references(() => customers.id),
  currentStep: integer('current_step').notNull().default(1),
  status: varchar('status', { length: 20 }).notNull().default('running'),
  // running | completed | failed | paused
  nextRunAt: timestamp('next_run_at'), // when to process next step (for delays)
  startedAt: timestamp('started_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
});

export const automationStepLogs = pgTable('automation_step_logs', {
  id: serial('id').primaryKey(),
  executionId: integer('execution_id').notNull().references(() => automationExecutions.id, { onDelete: 'cascade' }),
  stepId: integer('step_id').notNull().references(() => automationSteps.id),
  status: varchar('status', { length: 20 }).notNull(), // sent | failed | skipped
  sentAt: timestamp('sent_at').defaultNow(),
  error: text('error'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
});

// ─── ABANDONED BOOKING RECOVERY ─────────────────────────────────────────────

export const abandonedBookings = pgTable('abandoned_bookings', {
  id: serial('id').primaryKey(),
  vendorId: integer('vendor_id').notNull().references(() => vendors.id),
  customerId: integer('customer_id').references(() => customers.id),
  customerPhone: varchar('customer_phone', { length: 20 }),
  packageId: integer('package_id').references(() => packages.id),
  serviceId: integer('service_id').references(() => services.id),
  address: text('address'),
  lat: decimal('lat', { precision: 10, scale: 7 }),
  lng: decimal('lng', { precision: 10, scale: 7 }),
  stepReached: integer('step_reached').default(1), // which booking step they stopped at
  recoveryMessageSent: boolean('recovery_message_sent').notNull().default(false),
  recoveredAt: timestamp('recovered_at'), // null = still abandoned
  recoveryMethod: varchar('recovery_method', { length: 20 }), // whatsapp | push | sms
  abandonedAt: timestamp('abandoned_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── CUSTOMER SEGMENTATION & SCORING ────────────────────────────────────────

export const customerSegments = pgTable('customer_segments', {
  id: serial('id').primaryKey(),
  vendorId: integer('vendor_id').notNull().references(() => vendors.id),
  name: varchar('name', { length: 255 }).notNull(),
  nameAr: varchar('name_ar', { length: 255 }),
  description: text('description'),
  criteria: jsonb('criteria').$type<{
    rules: Array<{
      field: string;       // totalSpend | bookingCount | lastBookingDaysAgo | avgRating | churnRisk | ltvEstimate
      operator: string;    // gt | gte | lt | lte | eq | between
      value: number | [number, number];
    }>;
    logic: 'and' | 'or';
  }>().notNull(),
  color: varchar('color', { length: 7 }).default('#3b82f6'),
  customerCount: integer('customer_count').notNull().default(0),
  lastCalculatedAt: timestamp('last_calculated_at'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const customerSegmentMembers = pgTable('customer_segment_members', {
  id: serial('id').primaryKey(),
  segmentId: integer('segment_id').notNull().references(() => customerSegments.id, { onDelete: 'cascade' }),
  customerId: integer('customer_id').notNull().references(() => customers.id),
  addedAt: timestamp('added_at').notNull().defaultNow(),
});

export const customerScores = pgTable('customer_scores', {
  id: serial('id').primaryKey(),
  vendorId: integer('vendor_id').notNull().references(() => vendors.id),
  customerId: integer('customer_id').notNull().references(() => customers.id),
  // RFM metrics
  totalSpend: decimal('total_spend', { precision: 12, scale: 2 }).notNull().default('0'),
  bookingCount: integer('booking_count').notNull().default(0),
  avgRating: decimal('avg_rating', { precision: 3, scale: 2 }).default('0'),
  lastBookingAt: timestamp('last_booking_at'),
  daysSinceLastBooking: integer('days_since_last_booking').default(0),
  avgBookingFrequencyDays: decimal('avg_booking_frequency_days', { precision: 6, scale: 1 }).default('0'),
  // Predictions
  churnRisk: decimal('churn_risk', { precision: 5, scale: 4 }).notNull().default('0'), // 0.0000 to 1.0000
  ltvEstimate: decimal('ltv_estimate', { precision: 12, scale: 2 }).notNull().default('0'), // projected 12-month value
  // Composite score (0-100)
  score: integer('score').notNull().default(50),
  tier: varchar('tier', { length: 20 }).notNull().default('bronze'), // bronze | silver | gold | platinum
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ─── INDUSTRY TEMPLATES ─────────────────────────────────────────────────────

export const industryTemplates = pgTable('industry_templates', {
  id: serial('id').primaryKey(),
  industry: varchar('industry', { length: 50 }).notNull().unique(),
  nameAr: varchar('name_ar', { length: 100 }).notNull(),
  nameEn: varchar('name_en', { length: 100 }),
  icon: varchar('icon', { length: 50 }), // lucide icon name
  description: text('description'),
  // Default services for this industry
  defaultServices: jsonb('default_services').$type<Array<{
    nameAr: string;
    nameEn?: string;
    icon?: string;
  }>>().default([]),
  // Default packages per service
  defaultPackages: jsonb('default_packages').$type<Array<{
    serviceName: string;
    nameAr: string;
    price: number;
    duration: number; // minutes
    features?: string[];
  }>>().default([]),
  // Default inventory items
  defaultInventory: jsonb('default_inventory').$type<Array<{
    nameAr: string;
    unit: string;
    minQuantity: number;
  }>>().default([]),
  // UI customization hints
  customerFieldLabel: varchar('customer_field_label', { length: 100 }).default('العميل'), // العميل / صاحب المنزل / ...
  bookingFieldLabel: varchar('booking_field_label', { length: 100 }).default('الحجز'), // الحجز / الطلب / الزيارة
  vehicleFieldsEnabled: boolean('vehicle_fields_enabled').notNull().default(false),
  locationRequired: boolean('location_required').notNull().default(true),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── CRM (Customer 360) ─────────────────────────────────────────────────────

export const customerNotes = pgTable('customer_notes', {
  id: serial('id').primaryKey(),
  vendorId: integer('vendor_id').notNull().references(() => vendors.id),
  customerId: integer('customer_id').notNull().references(() => customers.id),
  note: text('note').notNull(),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const customerTags = pgTable('customer_tags', {
  id: serial('id').primaryKey(),
  vendorId: integer('vendor_id').notNull().references(() => vendors.id),
  name: varchar('name', { length: 100 }).notNull(),
  color: varchar('color', { length: 7 }).default('#3b82f6'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const customerTagAssignments = pgTable('customer_tag_assignments', {
  id: serial('id').primaryKey(),
  customerId: integer('customer_id').notNull().references(() => customers.id),
  tagId: integer('tag_id').notNull().references(() => customerTags.id, { onDelete: 'cascade' }),
  assignedAt: timestamp('assigned_at').notNull().defaultNow(),
});

export const customerLifecycleEvents = pgTable('customer_lifecycle_events', {
  id: serial('id').primaryKey(),
  vendorId: integer('vendor_id').notNull().references(() => vendors.id),
  customerId: integer('customer_id').notNull().references(() => customers.id),
  eventType: varchar('event_type', { length: 50 }).notNull(),
  // first_booking | became_regular | became_vip | churning | reactivated | complained | referred_friend
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── RECURRING BOOKINGS ─────────────────────────────────────────────────────

export const recurringBookings = pgTable('recurring_bookings', {
  id: serial('id').primaryKey(),
  vendorId: integer('vendor_id').notNull().references(() => vendors.id),
  customerId: integer('customer_id').notNull().references(() => customers.id),
  packageId: integer('package_id').notNull().references(() => packages.id),
  frequency: varchar('frequency', { length: 20 }).notNull(), // weekly | biweekly | monthly
  preferredDay: integer('preferred_day'), // 0=Sunday ... 6=Saturday
  preferredTime: varchar('preferred_time', { length: 5 }), // "09:00"
  address: text('address'),
  lat: decimal('lat', { precision: 10, scale: 7 }),
  lng: decimal('lng', { precision: 10, scale: 7 }),
  vehicleType: varchar('vehicle_type', { length: 50 }),
  vehiclePlate: varchar('vehicle_plate', { length: 20 }),
  notes: text('notes'),
  isActive: boolean('is_active').notNull().default(true),
  nextScheduledAt: timestamp('next_scheduled_at'),
  lastBookingId: integer('last_booking_id'),
  totalBookingsCreated: integer('total_bookings_created').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ─── NOTIFICATION CENTER ────────────────────────────────────────────────────

export const inAppNotifications = pgTable('in_app_notifications', {
  id: serial('id').primaryKey(),
  vendorId: integer('vendor_id').references(() => vendors.id),
  userId: integer('user_id').notNull().references(() => users.id),
  title: varchar('title', { length: 255 }).notNull(),
  body: text('body').notNull(),
  type: varchar('type', { length: 30 }).notNull().default('info'),
  // info | success | warning | booking | payment | promotion | system
  link: varchar('link', { length: 500 }),
  isRead: boolean('is_read').notNull().default(false),
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── PLATFORM COMMISSION (مؤجل — يتفعل مع الماركت بليس بعد 200 تاجر) ──────
// Uncomment when Marketplace launches:
//
// export const platformCommissions = pgTable('platform_commissions', {
//   id: serial('id').primaryKey(),
//   vendorId: integer('vendor_id').notNull().references(() => vendors.id),
//   bookingId: integer('booking_id').references(() => bookings.id),
//   bookingAmount: decimal('booking_amount', { precision: 10, scale: 2 }).notNull(),
//   commissionRate: decimal('commission_rate', { precision: 5, scale: 4 }).notNull().default('0.03'),
//   commissionAmount: decimal('commission_amount', { precision: 10, scale: 2 }).notNull(),
//   source: varchar('source', { length: 30 }).notNull().default('marketplace'),
//   status: varchar('status', { length: 20 }).notNull().default('pending'),
//   collectedAt: timestamp('collected_at'),
//   createdAt: timestamp('created_at').notNull().defaultNow(),
// });

// ═══════════════════════════════════════════════════════════════════════════════
// ██  DATABASE INDEXES (Performance Optimization)                              ██
// ═══════════════════════════════════════════════════════════════════════════════

// Bookings — most queried table
export const bookingsVendorIdx = index('idx_bookings_vendor_id').on(bookings.vendorId);
export const bookingsStatusIdx = index('idx_bookings_status').on(bookings.status);
export const bookingsCustomerIdx = index('idx_bookings_customer_id').on(bookings.customerId);
export const bookingsEmployeeIdx = index('idx_bookings_employee_id').on(bookings.employeeId);
export const bookingsScheduledIdx = index('idx_bookings_scheduled_at').on(bookings.scheduledAt);
export const bookingsVendorStatusIdx = index('idx_bookings_vendor_status').on(bookings.vendorId, bookings.status);

// Users — login and lookup
export const usersPhoneIdx = index('idx_users_phone').on(users.phone);
export const usersVendorIdx = index('idx_users_vendor_id').on(users.vendorId);
export const usersRoleIdx = index('idx_users_role').on(users.role);

// Customers — vendor-scoped lookups
export const customersVendorIdx = index('idx_customers_vendor_id').on(customers.vendorId);
export const customersUserIdx = index('idx_customers_user_id').on(customers.userId);

// Financials — reporting queries
export const financialsVendorIdx = index('idx_financials_vendor_id').on(financials.vendorId);
export const financialsDateIdx = index('idx_financials_date').on(financials.date);
export const financialsTypeIdx = index('idx_financials_type').on(financials.type);

// Notifications — delivery tracking
export const notificationsUserIdx = index('idx_notifications_user_id').on(notifications.userId);
export const notificationsVendorIdx = index('idx_notifications_vendor_id').on(notifications.vendorId);

// Inventory — stock management
export const inventoryVendorIdx = index('idx_inventory_vendor_id').on(inventory.vendorId);

// Employee locations — GPS tracking
export const empLocationsEmployeeIdx = index('idx_emp_locations_employee_id').on(employeeLocations.employeeId);

// Audit logs — security queries
export const auditLogsVendorIdx = index('idx_audit_logs_vendor_id').on(auditLogs.vendorId);
export const auditLogsCreatedIdx = index('idx_audit_logs_created_at').on(auditLogs.createdAt);

// In-app notifications — user feed
export const inAppNotifUserIdx = index('idx_in_app_notif_user_id').on(inAppNotifications.userId);
export const inAppNotifReadIdx = index('idx_in_app_notif_is_read').on(inAppNotifications.isRead);

// Customer scores — segmentation
export const customerScoresVendorIdx = index('idx_customer_scores_vendor_id').on(customerScores.vendorId);
export const customerScoresTierIdx = index('idx_customer_scores_tier').on(customerScores.tier);

// POS transactions — daily sales
export const posTransVendorIdx = index('idx_pos_trans_vendor_id').on(posTransactions.vendorId);

// Queue tickets — real-time queue
export const queueTicketsSessionIdx = index('idx_queue_tickets_session_id').on(queueTickets.sessionId);
export const queueTicketsStatusIdx = index('idx_queue_tickets_status').on(queueTickets.status);

// Promo codes — vendor-scoped unique code lookup
export const promoCodesVendorCodeIdx = index('idx_promo_codes_vendor_code').on(promoCodes.vendorId, promoCodes.code);

// Services + Packages — vendor-scoped
export const servicesVendorIdx = index('idx_services_vendor_id').on(services.vendorId);
export const packagesVendorIdx = index('idx_packages_vendor_id').on(packages.vendorId);
export const packagesServiceIdx = index('idx_packages_service_id').on(packages.serviceId);

// Fleet vehicles — auto-assign lookups
export const fleetVehiclesVendorIdx = index('idx_fleet_vehicles_vendor_id').on(fleetVehicles.vendorId);

// ═══════════════════════════════════════════════════════════════════════════════
// ██  PLATFORM PLANS (Dynamic — Admin-managed)                                ██
// ═══════════════════════════════════════════════════════════════════════════════

export const platformPlans = pgTable('platform_plans', {
  id: serial('id').primaryKey(),
  slug: varchar('slug', { length: 50 }).notNull().unique(), // starter, professional, business, enterprise
  nameAr: varchar('name_ar', { length: 100 }).notNull(),
  nameEn: varchar('name_en', { length: 100 }),
  description: text('description'),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  billingCycle: varchar('billing_cycle', { length: 20 }).notNull().default('monthly'), // monthly | yearly
  maxEmployees: integer('max_employees').default(-1), // -1 = unlimited
  maxBranches: integer('max_branches').default(1),
  features: jsonb('features').$type<string[]>().notNull().default([]),
  isPopular: boolean('is_popular').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  trialDays: integer('trial_days').notNull().default(14),
  // Feature gates — which features this plan unlocks
  featureGates: jsonb('feature_gates').$type<Record<string, boolean>>().notNull().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// ██  VENDOR REFERRAL SYSTEM (Vendor-to-Vendor)                               ██
// ═══════════════════════════════════════════════════════════════════════════════

export const vendorReferrals = pgTable('vendor_referrals', {
  id: serial('id').primaryKey(),
  referrerVendorId: integer('referrer_vendor_id').notNull().references(() => vendors.id),
  referralCode: varchar('referral_code', { length: 20 }).notNull().unique(),
  referredVendorId: integer('referred_vendor_id').references(() => vendors.id),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  // pending | converted | rewarded | expired
  rewardType: varchar('reward_type', { length: 30 }).notNull().default('free_month'),
  // free_month | discount_percent | cash
  rewardValue: decimal('reward_value', { precision: 10, scale: 2 }).default('0'),
  rewardGranted: boolean('reward_granted').notNull().default(false),
  convertedAt: timestamp('converted_at'),
  rewardedAt: timestamp('rewarded_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// ██  SOCIAL PROOF ACTIVITY LOG                                                ██
// ═══════════════════════════════════════════════════════════════════════════════

export const activityFeed = pgTable('activity_feed', {
  id: serial('id').primaryKey(),
  type: varchar('type', { length: 30 }).notNull(),
  // vendor_joined | booking_completed | milestone_reached
  message: text('message').notNull(),
  city: varchar('city', { length: 100 }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

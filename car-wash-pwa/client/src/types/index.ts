export interface Service {
  id: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  packages: Package[];
}

export interface Package {
  id: number;
  serviceId: number;
  name: string;
  price: string;
  duration: number;
  features: string[];
  isActive: boolean;
}

export interface Booking {
  id: number;
  bookingNumber: string;
  status: BookingStatus;
  scheduledAt: string;
  address: string;
  lat?: string;
  lng?: string;
  totalPrice: string;
  rating?: number;
  ratingComment?: string;
  vehicleType?: string;
  vehiclePlate?: string;
  vehicleColor?: string;
  vehicleModel?: string;
  notes?: string;
  packageName?: string;
  serviceName?: string;
  customerName?: string;
  customerPhone?: string;
  employeeId?: number;
  packageId?: number;
  statusHistory?: { status: string; at: string; by?: number }[];
  updatedAt?: string;
  employeeName?: string;
}

export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'on_way'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface InventoryItem {
  id: number;
  name: string;
  unit: string;
  quantity: string;
  minQuantity: string;
  costPerUnit: string;
  supplier?: string;
  notes?: string;
  updatedAt: string;
}

export interface Financial {
  id: number;
  type: 'income' | 'expense' | 'salary' | 'maintenance';
  category?: string;
  amount: string;
  description: string;
  date: string;
  employeeName?: string;
  referenceId?: number;
  referenceType?: string;
}

export interface FinancialSummary {
  income: number;
  expense: number;
  salary: number;
  maintenance: number;
  net: number;
}

export interface Employee {
  id: number;
  name: string;
  phone: string;
  isActive: boolean;
  createdAt: string;
}

export interface Customer {
  id: number;
  name: string;
  phone: string;
  isActive: boolean;
  createdAt: string;
  vehicleType?: string;
  vehiclePlate?: string;
  vehicleColor?: string;
  vehicleModel?: string;
  defaultAddress?: string;
}

export interface DashboardStats {
  totalBookings: number;
  todayBookings: number;
  completedToday: number;
  pendingCount: number;
  totalIncome: number;
  monthIncome: number;
  avgRating: number;
  totalCustomers: number;
}

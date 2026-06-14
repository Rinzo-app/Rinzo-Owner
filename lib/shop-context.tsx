import React, { createContext, useContext, useMemo, useCallback, useEffect, ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchShopOrders,
  fetchShopServices,
  createShopService,
  updateShopService,
  deleteShopService,
  fetchShopSettings,
  patchShopSettings,
  ApiError,
} from './api';
import { useAuth } from './auth-context';

export type OrderStatus = 'NEW' | 'ACCEPTED' | 'IN_WASH' | 'READY' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'REJECTED' | 'CANCELLED';

export interface OrderItem {
  /** order_items row id — needed for weighing */
  id?: string;
  serviceName: string;
  quantity: number;
  price: number;
  /** Measured weight/quantity (set after the shop weighs) */
  actualQuantity?: number | null;
}

export type AdjustmentStatus = 'NONE' | 'PENDING' | 'APPLIED';

export interface Order {
  id: string;
  customerName: string;
  customerPhone: string;
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  notes?: string;
  /** Weighing / price adjustment */
  adjustmentStatus?: AdjustmentStatus;
  originalTotalAmount?: number | null;
  proposedTotalAmount?: number | null;
}

export interface Service {
  id: string;
  name: string;
  price: number;
  unit: string;
  active: boolean;
  imageUrl?: string | null;
}

export type ShopApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export interface ShopSettings {
  shopName: string;
  isOpen: boolean;
  dailyCapacity: number;
  autoReject: boolean;
  /** How far (km) the shop accepts pickups/deliveries */
  serviceRadiusKm: number;
  /** Storefront/cover photo URL shown to customers; null if none set. */
  imageUrl: string | null;
  /** Admin approval status; null until loaded from the backend. */
  status: ShopApprovalStatus | null;
  // ── Payout details ──
  payoutMethod: 'BANK' | 'UPI' | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankIfsc: string | null;
  upiId: string | null;
  // ── Business KYC ──
  panNumber: string | null;
  gstNumber: string | null;
  panImageUrl: string | null;
  licenseImageUrl: string | null;
  documentsStatus: 'NOT_SUBMITTED' | 'SUBMITTED' | 'VERIFIED' | 'REJECTED';
  documentsRejectionReason: string | null;
  // ── Earnings/balance (read-only) ──
  earnings: { earned: number; paidOut: number; balance: number } | null;
}

interface ShopContextValue {
  orders: Order[];
  services: Service[];
  settings: ShopSettings;
  activeOrderCount: number;
  capacityPercent: number;
  isAtCapacity: boolean;
  addService: (service: Omit<Service, 'id'>) => Promise<void>;
  updateService: (service: Service) => Promise<void>;
  deleteService: (serviceId: string) => Promise<void>;
  updateSettings: (settings: Partial<ShopSettings>) => Promise<void>;
  isLoading: boolean;
  /** True when the owner has no shop yet (backend returned ERR_NO_SHOPS). */
  needsShopSetup: boolean;
  refreshData: () => Promise<void>;
}

const DEFAULT_SETTINGS: ShopSettings = {
  shopName: 'Rinzo Laundry',
  isOpen: true,
  dailyCapacity: 20,
  autoReject: false,
  serviceRadiusKm: 5,
  imageUrl: null,
  status: null,
  payoutMethod: null,
  bankAccountName: null,
  bankAccountNumber: null,
  bankIfsc: null,
  upiId: null,
  panNumber: null,
  gstNumber: null,
  panImageUrl: null,
  licenseImageUrl: null,
  documentsStatus: 'NOT_SUBMITTED',
  documentsRejectionReason: null,
  earnings: null,
};

const ShopContext = createContext<ShopContextValue | null>(null);

export function ShopProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  // Queries must not fire before login: they would all 401, and the
  // cached 401 on shop-settings masks the "no shop yet" (404) signal
  // that drives the create-shop onboarding redirect. They also pause
  // while the account is suspended (everything would 403).
  const { isAuthenticated, userStatus, refreshProfile } = useAuth();
  const queriesEnabled = isAuthenticated && userStatus !== 'SUSPENDED';

  // ── Orders from backend via react-query ──
  const { data: orders = [], isLoading: ordersLoading, refetch: refetchOrders } = useQuery<Order[]>({
    queryKey: ['shop-orders'],
    queryFn: fetchShopOrders,
    enabled: queriesEnabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  // ── Services from backend via react-query ──
  const {
    data: services = [],
    isLoading: servicesLoading,
    refetch: refetchServices,
  } = useQuery<Service[]>({
    queryKey: ['shop-services'],
    queryFn: fetchShopServices,
    enabled: queriesEnabled,
    staleTime: 60_000,
  });

  // ── Settings from backend via react-query ──
  const {
    data: settings = DEFAULT_SETTINGS,
    isLoading: settingsLoading,
    error: settingsError,
    refetch: refetchSettings,
  } = useQuery<ShopSettings>({
    queryKey: ['shop-settings'],
    queryFn: fetchShopSettings,
    enabled: queriesEnabled,
    staleTime: 60_000,
    // Poll so the approval banner clears shortly after the admin acts
    // (RN has no window-focus refetch without extra wiring).
    refetchInterval: 30_000,
  });

  const needsShopSetup =
    settingsError instanceof ApiError && settingsError.status === 404;

  // Suspension can happen mid-session (admin rejects/suspends the shop).
  // The settings poll surfaces it as 403 ERR_SUSPENDED — refresh the
  // auth status so navigation can route to the blocked screen.
  useEffect(() => {
    if (settingsError instanceof ApiError && settingsError.code === 'ERR_SUSPENDED') {
      refreshProfile();
    }
  }, [settingsError, refreshProfile]);

  const isLoading = ordersLoading || servicesLoading || settingsLoading;

  const activeOrderCount = useMemo(() =>
    orders.filter(o =>
      o.status !== 'READY' &&
      o.status !== 'OUT_FOR_DELIVERY' &&
      o.status !== 'DELIVERED' &&
      o.status !== 'REJECTED' &&
      o.status !== 'CANCELLED'
    ).length,
    [orders]
  );

  const capacityPercent = useMemo(() =>
    settings.dailyCapacity > 0 ? Math.min((activeOrderCount / settings.dailyCapacity) * 100, 100) : 0,
    [activeOrderCount, settings.dailyCapacity]
  );

  const isAtCapacity = useMemo(() =>
    activeOrderCount >= settings.dailyCapacity,
    [activeOrderCount, settings.dailyCapacity]
  );

  const addService = useCallback(async (serviceData: Omit<Service, 'id'>) => {
    await createShopService(serviceData);
    queryClient.invalidateQueries({ queryKey: ['shop-services'] });
  }, [queryClient]);

  const updateService = useCallback(async (service: Service) => {
    await updateShopService(service);
    queryClient.invalidateQueries({ queryKey: ['shop-services'] });
  }, [queryClient]);

  const deleteService = useCallback(async (serviceId: string) => {
    await deleteShopService(serviceId);
    queryClient.invalidateQueries({ queryKey: ['shop-services'] });
  }, [queryClient]);

  const updateSettings = useCallback(async (partial: Partial<ShopSettings>) => {
    await patchShopSettings(partial);
    queryClient.invalidateQueries({ queryKey: ['shop-settings'] });
  }, [queryClient]);

  const refreshData = useCallback(async () => {
    await Promise.all([refetchOrders(), refetchServices(), refetchSettings()]);
  }, [refetchOrders, refetchServices, refetchSettings]);

  const value = useMemo(() => ({
    orders,
    services,
    settings,
    activeOrderCount,
    capacityPercent,
    isAtCapacity,
    addService,
    updateService,
    deleteService,
    updateSettings,
    isLoading,
    needsShopSetup,
    refreshData,
  }), [orders, services, settings, activeOrderCount, capacityPercent, isAtCapacity, addService, updateService, deleteService, updateSettings, isLoading, needsShopSetup, refreshData]);

  return (
    <ShopContext.Provider value={value}>
      {children}
    </ShopContext.Provider>
  );
}

export function useShop() {
  const context = useContext(ShopContext);
  if (!context) {
    throw new Error('useShop must be used within a ShopProvider');
  }
  return context;
}

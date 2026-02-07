import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

export type OrderStatus = 'NEW' | 'ACCEPTED' | 'IN_WASH' | 'READY' | 'REJECTED';

export interface OrderItem {
  serviceName: string;
  quantity: number;
  price: number;
}

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
}

export interface Service {
  id: string;
  name: string;
  price: number;
  unit: string;
  active: boolean;
}

export interface ShopSettings {
  shopName: string;
  isOpen: boolean;
  dailyCapacity: number;
  autoReject: boolean;
}

interface ShopContextValue {
  orders: Order[];
  services: Service[];
  settings: ShopSettings;
  activeOrderCount: number;
  capacityPercent: number;
  isAtCapacity: boolean;
  addOrder: (order: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Order | null>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  addService: (service: Omit<Service, 'id'>) => Promise<void>;
  updateService: (service: Service) => Promise<void>;
  deleteService: (serviceId: string) => Promise<void>;
  updateSettings: (settings: Partial<ShopSettings>) => Promise<void>;
  isLoading: boolean;
  refreshData: () => Promise<void>;
}

const ORDERS_KEY = '@saaf_orders';
const SERVICES_KEY = '@saaf_services';
const SETTINGS_KEY = '@saaf_settings';

const DEFAULT_SETTINGS: ShopSettings = {
  shopName: 'Saaf Laundry',
  isOpen: true,
  dailyCapacity: 20,
  autoReject: false,
};

const DEFAULT_SERVICES: Service[] = [
  { id: '1', name: 'Wash & Fold', price: 50, unit: 'per kg', active: true },
  { id: '2', name: 'Dry Clean', price: 150, unit: 'per piece', active: true },
  { id: '3', name: 'Iron Only', price: 20, unit: 'per piece', active: true },
  { id: '4', name: 'Stain Removal', price: 100, unit: 'per piece', active: true },
];

const ShopContext = createContext<ShopContextValue | null>(null);

function generateSampleOrders(): Order[] {
  const names = ['Rahul Sharma', 'Priya Patel', 'Amit Kumar', 'Sneha Gupta', 'Vikram Singh'];
  const phones = ['9876543210', '9876543211', '9876543212', '9876543213', '9876543214'];
  const statuses: OrderStatus[] = ['NEW', 'NEW', 'ACCEPTED', 'IN_WASH', 'READY'];

  return names.map((name, i) => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - (i * 30));
    return {
      id: `order_${i + 1}`,
      customerName: name,
      customerPhone: phones[i],
      items: [
        { serviceName: 'Wash & Fold', quantity: i + 2, price: 50 },
        ...(i % 2 === 0 ? [{ serviceName: 'Iron Only', quantity: 3, price: 20 }] : []),
      ],
      totalAmount: (i + 2) * 50 + (i % 2 === 0 ? 60 : 0),
      status: statuses[i],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      notes: i === 0 ? 'Please handle with care' : undefined,
    };
  });
}

export function ShopProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [services, setServices] = useState<Service[]>(DEFAULT_SERVICES);
  const [settings, setSettings] = useState<ShopSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [ordersData, servicesData, settingsData] = await Promise.all([
        AsyncStorage.getItem(ORDERS_KEY),
        AsyncStorage.getItem(SERVICES_KEY),
        AsyncStorage.getItem(SETTINGS_KEY),
      ]);

      if (ordersData) {
        setOrders(JSON.parse(ordersData));
      } else {
        const sampleOrders = generateSampleOrders();
        setOrders(sampleOrders);
        await AsyncStorage.setItem(ORDERS_KEY, JSON.stringify(sampleOrders));
      }

      if (servicesData) {
        setServices(JSON.parse(servicesData));
      } else {
        await AsyncStorage.setItem(SERVICES_KEY, JSON.stringify(DEFAULT_SERVICES));
      }

      if (settingsData) {
        setSettings(JSON.parse(settingsData));
      } else {
        await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS));
      }
    } catch (err) {
      console.error('Failed to load shop data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeOrderCount = useMemo(() =>
    orders.filter(o => o.status !== 'READY' && o.status !== 'REJECTED').length,
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

  const addOrder = useCallback(async (orderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>): Promise<Order | null> => {
    if (isAtCapacity && settings.autoReject) {
      return null;
    }

    const now = new Date().toISOString();
    const newOrder: Order = {
      ...orderData,
      id: `order_${Crypto.randomUUID()}`,
      createdAt: now,
      updatedAt: now,
    };

    const updated = [newOrder, ...orders];
    setOrders(updated);
    await AsyncStorage.setItem(ORDERS_KEY, JSON.stringify(updated));
    return newOrder;
  }, [orders, isAtCapacity, settings.autoReject]);

  const updateOrderStatus = useCallback(async (orderId: string, status: OrderStatus) => {
    const updated = orders.map(o =>
      o.id === orderId ? { ...o, status, updatedAt: new Date().toISOString() } : o
    );
    setOrders(updated);
    await AsyncStorage.setItem(ORDERS_KEY, JSON.stringify(updated));
  }, [orders]);

  const addService = useCallback(async (serviceData: Omit<Service, 'id'>) => {
    const newService: Service = {
      ...serviceData,
      id: Crypto.randomUUID(),
    };
    const updated = [...services, newService];
    setServices(updated);
    await AsyncStorage.setItem(SERVICES_KEY, JSON.stringify(updated));
  }, [services]);

  const updateService = useCallback(async (service: Service) => {
    const updated = services.map(s => s.id === service.id ? service : s);
    setServices(updated);
    await AsyncStorage.setItem(SERVICES_KEY, JSON.stringify(updated));
  }, [services]);

  const deleteService = useCallback(async (serviceId: string) => {
    const updated = services.filter(s => s.id !== serviceId);
    setServices(updated);
    await AsyncStorage.setItem(SERVICES_KEY, JSON.stringify(updated));
  }, [services]);

  const updateSettings = useCallback(async (partial: Partial<ShopSettings>) => {
    const updated = { ...settings, ...partial };
    setSettings(updated);
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  }, [settings]);

  const value = useMemo(() => ({
    orders,
    services,
    settings,
    activeOrderCount,
    capacityPercent,
    isAtCapacity,
    addOrder,
    updateOrderStatus,
    addService,
    updateService,
    deleteService,
    updateSettings,
    isLoading,
    refreshData: loadData,
  }), [orders, services, settings, activeOrderCount, capacityPercent, isAtCapacity, addOrder, updateOrderStatus, addService, updateService, deleteService, updateSettings, isLoading, loadData]);

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

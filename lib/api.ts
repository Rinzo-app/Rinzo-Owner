import type { Order, OrderStatus, Service, ShopSettings } from "./shop-context";
import { request, ApiError } from "./http-client";

// Re-export so existing consumers don't break
export { ApiError } from "./http-client";

// ── Backend → UI status mapping ──────────────────────────
const STATUS_TO_UI: Record<string, OrderStatus> = {
  PLACED: "NEW",
  SHOP_ACCEPTED: "ACCEPTED",
  PICKUP_OFFERED: "ACCEPTED",
  PICKUP_ASSIGNED: "ACCEPTED",
  PICKED_UP_FROM_CUSTOMER: "IN_WASH",
  AT_SHOP: "IN_WASH",
  READY: "READY",
  DELIVERY_OFFERED: "READY",
  OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
  REJECTED_BY_SHOP: "REJECTED",
};

function mapStatus(backendStatus: string): OrderStatus {
  return STATUS_TO_UI[backendStatus] || "NEW";
}

/** Transform a backend order row → the Order shape the UI expects */
function mapOrder(raw: any): Order {
  const items = Array.isArray(raw.items)
    ? raw.items.map((i: any) => ({
        id: i.id,
        serviceName: i.serviceName || i.name || "Service",
        quantity: i.quantity,
        price: i.price,
        actualQuantity: i.actualQuantity ?? null,
      }))
    : [];

  return {
    id: raw.id,
    customerName: raw.customerName || "Customer",
    customerPhone: raw.customerPhone || "",
    items,
    totalAmount: raw.totalAmount ?? 0,
    status: mapStatus(raw.status),
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt || raw.createdAt,
    notes: raw.notes,
    adjustmentStatus: raw.adjustmentStatus ?? 'NONE',
    originalTotalAmount: raw.originalTotalAmount ?? null,
    proposedTotalAmount: raw.proposedTotalAmount ?? null,
  };
}

// ── Shop-owner order API ─────────────────────────────────

/** GET /api/shop/orders — all orders for shops owned by this user */
export async function fetchShopOrders(): Promise<Order[]> {
  // limit is capped at 100 server-side — asking for more used to 400
  const res = await request<{ data: any[] }>("GET", "/api/shop/orders?limit=100");
  return res.data.map(mapOrder);
}

/** GET /api/orders/:id — single order with items */
export async function fetchOrder(id: string): Promise<Order> {
  const data = await request("GET", `/api/orders/${id}`);
  return mapOrder(data);
}

/** POST /api/orders/:id/accept */
export async function acceptOrder(orderId: string): Promise<Order> {
  const data = await request("POST", `/api/orders/${orderId}/accept`);
  return mapOrder(data);
}

/** POST /api/orders/:id/reject — requires rejectionReason enum value */
export async function rejectOrder(
  orderId: string,
  rejectionReason: string,
): Promise<Order> {
  const data = await request("POST", `/api/orders/${orderId}/reject`, {
    rejectionReason,
  });
  return mapOrder(data);
}

/** POST /api/orders/:id/ready — mark an IN_WASH order as READY */
export async function markReady(orderId: string): Promise<Order> {
  const data = await request("POST", `/api/orders/${orderId}/ready`);
  return mapOrder(data);
}

/** POST /api/orders/:id/weigh — submit actual weights (IN_WASH only) */
export async function weighOrder(
  orderId: string,
  items: Array<{ itemId: string; actualQuantity: number }>,
): Promise<Order> {
  const data = await request("POST", `/api/orders/${orderId}/weigh`, { items });
  return mapOrder(data);
}

// ── Dispute API ──────────────────────────────────────────

export const DISPUTE_CATEGORIES = [
  "Payment Issue",
  "Late Delivery",
  "Wrong Items",
  "Order Damaged",
  "Missing Items",
  "Customer No-show",
  "Wrong Order Info",
  "Rider Issue",
  "App Issue",
  "Other",
];

/** POST /api/disputes — raise a dispute against an order */
export async function createDispute(payload: {
  orderId: string;
  category: string;
  description: string;
}): Promise<any> {
  return request("POST", "/api/disputes", payload);
}

// ── Dispute listing ─────────────────────────────────────

export interface Dispute {
  id: string;
  orderId: string | null;
  category: string;
  description: string;
  status: "OPEN" | "IN_REVIEW" | "RESOLVED" | "CLOSED";
  resolution?: string;
  createdAt: string;
  updatedAt: string | null;
}

/** GET /api/disputes — list the authenticated user's disputes */
export async function fetchMyDisputes(): Promise<Dispute[]> {
  return request<Dispute[]>("GET", "/api/disputes");
}

// ── Service API ──────────────────────────────────────────

/** Map backend pricingType → Owner UI unit string */
function pricingTypeToUnit(pt: string): string {
  switch (pt) {
    case "PER_KG":
      return "per kg";
    case "PER_ITEM":
      return "per piece";
    default:
      return "per kg";
  }
}

/** Map Owner UI unit string → backend pricingType */
function unitToPricingType(unit: string): string {
  switch (unit) {
    case "per kg":
    case "per load":
      return "PER_KG";
    case "per piece":
    case "per set":
      return "PER_ITEM";
    default:
      return "PER_KG";
  }
}

/** Transform a backend service row → the Service shape the UI expects */
function mapService(raw: any): Service {
  return {
    id: raw.id,
    name: raw.name,
    price: raw.price,
    unit: pricingTypeToUnit(raw.pricingType),
    active: raw.isActive ?? true,
    imageUrl: raw.imageUrl ?? null,
  };
}

/** GET /api/shop/services */
export async function fetchShopServices(): Promise<Service[]> {
  const data = await request<any[]>("GET", "/api/shop/services");
  return data.map(mapService);
}

/** POST /api/shop/services */
export async function createShopService(
  service: Omit<Service, "id">,
): Promise<Service> {
  const data = await request("POST", "/api/shop/services", {
    name: service.name,
    price: service.price,
    pricingType: unitToPricingType(service.unit),
    isActive: service.active,
    ...(service.imageUrl !== undefined ? { imageUrl: service.imageUrl } : {}),
  });
  return mapService(data);
}

/** PATCH /api/shop/services/:id */
export async function updateShopService(service: Service): Promise<Service> {
  const data = await request("PATCH", `/api/shop/services/${service.id}`, {
    name: service.name,
    price: service.price,
    pricingType: unitToPricingType(service.unit),
    isActive: service.active,
    ...(service.imageUrl !== undefined ? { imageUrl: service.imageUrl } : {}),
  });
  return mapService(data);
}

/** DELETE /api/shop/services/:id */
export async function deleteShopService(serviceId: string): Promise<void> {
  await request("DELETE", `/api/shop/services/${serviceId}`);
}

/** DELETE /api/auth/me — permanently delete the signed-in account */
export async function deleteAccount(): Promise<void> {
  await request("DELETE", "/api/auth/me");
}

// ── Shop onboarding API ──────────────────────────────────

export interface CreateShopPayload {
  name: string;
  phone: string;
  address: string;
  latitude: number;
  longitude: number;
}

/** POST /api/shop — create the owner's shop (starts as PENDING) */
export async function createShop(payload: CreateShopPayload): Promise<any> {
  return request("POST", "/api/shop", payload);
}

// ── Settings API ─────────────────────────────────────────

/** Transform a backend settings row → the ShopSettings shape the UI expects */
function mapSettings(raw: any): ShopSettings {
  return {
    shopName: raw.name ?? "Rinzo Laundry",
    isOpen: raw.isOpen ?? true,
    dailyCapacity: raw.dailyCapacity ?? 20,
    autoReject: raw.autoRejectEnabled ?? false,
    serviceRadiusKm: raw.serviceRadiusKm ?? 5,
    imageUrl: raw.imageUrl ?? null,
    status: raw.status ?? null,
  };
}

/** GET /api/shop/settings */
export async function fetchShopSettings(): Promise<ShopSettings> {
  const data = await request("GET", "/api/shop/settings");
  return mapSettings(data);
}

/** PATCH /api/shop/settings */
export async function patchShopSettings(
  partial: Partial<ShopSettings>,
): Promise<ShopSettings> {
  // Map Owner field names → backend field names
  const body: Record<string, unknown> = {};
  if (partial.shopName !== undefined) body.name = partial.shopName;
  if (partial.isOpen !== undefined) body.isOpen = partial.isOpen;
  if (partial.dailyCapacity !== undefined)
    body.dailyCapacity = partial.dailyCapacity;
  if (partial.autoReject !== undefined)
    body.autoRejectEnabled = partial.autoReject;
  if (partial.serviceRadiusKm !== undefined)
    body.serviceRadiusKm = partial.serviceRadiusKm;
  if (partial.imageUrl !== undefined) body.imageUrl = partial.imageUrl;

  const data = await request("PATCH", "/api/shop/settings", body);
  return mapSettings(data);
}

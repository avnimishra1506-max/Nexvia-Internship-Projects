export type MarketplaceRole = "CUSTOMER" | "VENDOR" | "ADMIN";
export type FulfillmentStatus = "PLACED" | "PACKED" | "SHIPPED" | "DELIVERED";

const fulfillmentRank: Record<FulfillmentStatus, number> = {
  PLACED: 0,
  PACKED: 1,
  SHIPPED: 2,
  DELIVERED: 3,
};

export function hasAllowedRole(role: MarketplaceRole, allowed: readonly MarketplaceRole[]) {
  return allowed.includes(role);
}

export function deriveOrderStatus(statuses: readonly FulfillmentStatus[]): FulfillmentStatus {
  if (!statuses.length) return "PLACED";
  return statuses.reduce((slowest, current) => fulfillmentRank[current] < fulfillmentRank[slowest] ? current : slowest);
}

export function checkSubOrderTransition(input: {
  actorRole: MarketplaceRole;
  actorId: string;
  vendorId: string;
  paymentStatus: "PENDING" | "PAID" | "FAILED" | "REFUNDED";
  currentStatus: FulfillmentStatus;
  nextStatus: string;
}): { allowed: true } | { allowed: false; reason: "payment_required" | "role_forbidden" | "vendor_mismatch" | "invalid_transition" } {
  if (input.paymentStatus !== "PAID") return { allowed: false, reason: "payment_required" };
  if (!hasAllowedRole(input.actorRole, ["VENDOR", "ADMIN"])) return { allowed: false as const, reason: "role_forbidden" as const };
  if (input.actorRole === "VENDOR" && input.actorId !== input.vendorId) return { allowed: false, reason: "vendor_mismatch" };
  if (input.actorRole === "VENDOR" && input.nextStatus === "DELIVERED") return { allowed: false, reason: "role_forbidden" };
  const nextByStatus: Record<FulfillmentStatus, FulfillmentStatus | null> = {
    PLACED: "PACKED",
    PACKED: "SHIPPED",
    SHIPPED: "DELIVERED",
    DELIVERED: null,
  };
  if (nextByStatus[input.currentStatus] !== input.nextStatus) return { allowed: false, reason: "invalid_transition" };
  return { allowed: true };
}

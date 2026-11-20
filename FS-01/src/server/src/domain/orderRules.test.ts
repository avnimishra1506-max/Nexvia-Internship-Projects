import assert from "node:assert/strict";
import test from "node:test";
import { allocateVendorAmounts, calculateCommission } from "./commission";
import { checkSubOrderTransition, deriveOrderStatus, hasAllowedRole } from "./orderRules";

test("commission is rounded to cents and validates its rate", () => {
  assert.equal(calculateCommission(19.99, 10), 2);
  assert.equal(calculateCommission(19.95, 10), 2);
  assert.throws(() => calculateCommission(10, 101), RangeError);
});

test("vendor allocation distributes coupon discounts and balances commission plus payouts", () => {
  const allocations = allocateVendorAmounts([
    { vendorId: "vendor-b", grossAmount: 30 },
    { vendorId: "vendor-a", grossAmount: 70 },
  ], 10, 10);
  assert.deepEqual(allocations.map((entry) => entry.vendorId), ["vendor-a", "vendor-b"]);
  assert.equal(allocations.reduce((sum, entry) => sum + entry.discount, 0), 10);
  assert.equal(allocations.reduce((sum, entry) => sum + entry.commissionAmount + entry.payoutAmount, 0), 90);
  assert.equal(allocations.reduce((sum, entry) => sum + entry.commissionAmount, 0), 9);
});

test("role checks allow only vendors and admins for suborder actions", () => {
  assert.equal(hasAllowedRole("VENDOR", ["VENDOR", "ADMIN"]), true);
  assert.equal(hasAllowedRole("CUSTOMER", ["VENDOR", "ADMIN"]), false);
});

test("vendors can advance their paid suborders one step but cannot deliver or touch another vendor's", () => {
  const base = { actorRole: "VENDOR" as const, actorId: "vendor-a", vendorId: "vendor-a", paymentStatus: "PAID" as const, currentStatus: "PLACED" as const };
  assert.deepEqual(checkSubOrderTransition({ ...base, nextStatus: "PACKED" }), { allowed: true });
  assert.deepEqual(checkSubOrderTransition({ ...base, nextStatus: "SHIPPED" }), { allowed: false, reason: "invalid_transition" });
  assert.deepEqual(checkSubOrderTransition({ ...base, nextStatus: "DELIVERED" }), { allowed: false, reason: "role_forbidden" });
  assert.deepEqual(checkSubOrderTransition({ ...base, vendorId: "vendor-b", nextStatus: "PACKED" }), { allowed: false, reason: "vendor_mismatch" });
});

test("admins can mark a paid shipped suborder delivered; unpaid orders cannot advance", () => {
  assert.deepEqual(checkSubOrderTransition({ actorRole: "ADMIN", actorId: "admin", vendorId: "vendor-a", paymentStatus: "PAID", currentStatus: "SHIPPED", nextStatus: "DELIVERED" }), { allowed: true });
  assert.deepEqual(checkSubOrderTransition({ actorRole: "ADMIN", actorId: "admin", vendorId: "vendor-a", paymentStatus: "PAID", currentStatus: "PLACED", nextStatus: "SHIPPED" }), { allowed: false, reason: "invalid_transition" });
  assert.deepEqual(checkSubOrderTransition({ actorRole: "ADMIN", actorId: "admin", vendorId: "vendor-a", paymentStatus: "PENDING", currentStatus: "PLACED", nextStatus: "PACKED" }), { allowed: false, reason: "payment_required" });
});

test("order status reflects the least advanced vendor suborder", () => {
  assert.equal(deriveOrderStatus(["SHIPPED", "PACKED"]), "PACKED");
  assert.equal(deriveOrderStatus(["DELIVERED", "DELIVERED"]), "DELIVERED");
});

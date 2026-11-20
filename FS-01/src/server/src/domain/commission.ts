export type VendorGross = { vendorId: string; grossAmount: number };
export type VendorAllocation = {
  vendorId: string;
  subtotal: number;
  discount: number;
  netAmount: number;
  commissionAmount: number;
  payoutAmount: number;
};

const cents = (amount: number) => Math.round(amount * 100);
const money = (amountInCents: number) => amountInCents / 100;

export function calculateCommission(amount: number, percentage: number) {
  if (!Number.isFinite(amount) || amount < 0) throw new RangeError("Amount must be a non-negative number.");
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) throw new RangeError("Commission must be between 0 and 100 percent.");
  return money(Math.round(cents(amount) * percentage / 100));
}

export function allocateVendorAmounts(vendors: readonly VendorGross[], couponDiscount: number, percentage: number): VendorAllocation[] {
  if (!vendors.length) return [];
  if (!Number.isFinite(couponDiscount) || couponDiscount < 0) throw new RangeError("Discount must be a non-negative number.");
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) throw new RangeError("Commission must be between 0 and 100 percent.");

  const sorted = [...vendors].sort((a, b) => a.vendorId.localeCompare(b.vendorId));
  const grossByVendor = sorted.map(({ vendorId, grossAmount }) => {
    if (!Number.isFinite(grossAmount) || grossAmount <= 0) throw new RangeError("Vendor subtotal must be greater than zero.");
    return { vendorId, grossCents: cents(grossAmount) };
  });
  const totalGross = grossByVendor.reduce((sum, vendor) => sum + vendor.grossCents, 0);
  const discountTotal = Math.min(totalGross, cents(couponDiscount));
  let discountAllocated = 0;

  return grossByVendor.map((vendor, index) => {
    const discountCents = index === grossByVendor.length - 1
      ? discountTotal - discountAllocated
      : Math.min(discountTotal - discountAllocated, Math.round(discountTotal * vendor.grossCents / totalGross));
    discountAllocated += discountCents;
    const netCents = vendor.grossCents - discountCents;
    const commissionCents = Math.round(netCents * percentage / 100);
    return {
      vendorId: vendor.vendorId,
      subtotal: money(vendor.grossCents),
      discount: money(discountCents),
      netAmount: money(netCents),
      commissionAmount: money(commissionCents),
      payoutAmount: money(netCents - commissionCents),
    };
  });
}

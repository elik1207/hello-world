import { Coupon } from './types';

export function computeMissingFieldCount(coupon: Partial<Coupon>): number {
    let missingCount = 0;
    if (!coupon.store && !coupon.title) missingCount++;
    if (!coupon.discountValue && !coupon.initialValue) missingCount++;
    if (!coupon.code) missingCount++;
    return missingCount;
}

export function computeNeedsReviewFieldCount(coupon: Partial<Coupon>): number {
    let needsReviewCount = 0;
    if (coupon.code && coupon.code.length < 4) needsReviewCount++; // Ambiguous code
    return needsReviewCount;
}

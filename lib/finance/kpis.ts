import { Coupon } from '../types';
import { getDaysUntilExpiry } from '../utils';

export interface DashboardKPIs {
    totalTrappedValue: number;
    totalLostValue: number;
    expiringSoon: {
        in7Days: { count: number; value: number };
        in14Days: { count: number; value: number };
        in30Days: { count: number; value: number };
    };
}

/**
 * Extracts the absolute cash value from a coupon or gift card.
 * Percentage discounts are treated as 0 value since they are relative, not trapped cash.
 */
export function getCouponCashValue(c: Coupon): number {
    if (c.type === 'gift_card') {
        return c.remainingValue ?? c.initialValue ?? 0;
    }
    if (c.discountType === 'amount') {
        return c.discountValue || 0;
    }
    return 0;
}

/**
 * Calculates financial KPIs purely from a given list of coupons.
 * Deterministic and timezone-safe via getDaysUntilExpiry.
 */
export function calculateFinancialKPIs(coupons: Coupon[]): DashboardKPIs {
    let totalTrappedValue = 0;
    let totalLostValue = 0;

    const expiringSoon = {
        in7Days: { count: 0, value: 0 },
        in14Days: { count: 0, value: 0 },
        in30Days: { count: 0, value: 0 },
    };

    for (const c of coupons) {
        const value = getCouponCashValue(c);

        if (c.status === 'active') {
            totalTrappedValue += value;

            if (c.expiryDate) {
                const daysLeft = getDaysUntilExpiry(c.expiryDate);
                // Exclude items that are already expired (daysLeft < 0) from "expiring soon".
                // Active items that are expired technically contribute to Lost Value if your UI syncs them,
                // but the prompt specifies "Lost Value = sum(amount) of Expired items".
                // If an item is technically 'active' but past expiry, the wallet logic treats it as expired.
                if (daysLeft !== null && daysLeft >= 0) {
                    if (daysLeft <= 7) {
                        expiringSoon.in7Days.count++;
                        expiringSoon.in7Days.value += value;
                    }
                    if (daysLeft <= 14) {
                        expiringSoon.in14Days.count++;
                        expiringSoon.in14Days.value += value;
                    }
                    if (daysLeft <= 30) {
                        expiringSoon.in30Days.count++;
                        expiringSoon.in30Days.value += value;
                    }
                }
            }
        } else if (c.status === 'expired') {
            totalLostValue += value;
        }
        // 'used' items do not contribute to Trapped or Lost value.
    }

    return {
        totalTrappedValue,
        totalLostValue,
        expiringSoon
    };
}

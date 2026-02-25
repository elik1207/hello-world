import { Coupon } from '../types';
import { calculateFinancialKPIs, getCouponCashValue } from './kpis';

describe('Financial KPIs', () => {
    const baseCoupon: Partial<Coupon> = {
        id: '1',
        title: 'Test',
        currency: 'USD',
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };

    it('should correctly calculate the cash value based on type', () => {
        expect(getCouponCashValue({ ...baseCoupon, type: 'gift_card', initialValue: 100 } as Coupon)).toBe(100);
        expect(getCouponCashValue({ ...baseCoupon, type: 'gift_card', initialValue: 100, remainingValue: 40 } as Coupon)).toBe(40);
        expect(getCouponCashValue({ ...baseCoupon, type: 'coupon', discountType: 'amount', discountValue: 25 } as Coupon)).toBe(25);
        // Percentage coupons have no fixed trapped cash value
        expect(getCouponCashValue({ ...baseCoupon, type: 'coupon', discountType: 'percent', discountValue: 20 } as Coupon)).toBe(0);
    });

    it('should calculate targeted Trapped and Lost Values', () => {
        const coupons: Coupon[] = [
            { ...baseCoupon, id: 'a', status: 'active', type: 'gift_card', initialValue: 50, remainingValue: 30 } as Coupon,
            { ...baseCoupon, id: 'b', status: 'active', type: 'coupon', discountType: 'amount', discountValue: 15 } as Coupon,
            { ...baseCoupon, id: 'c', status: 'expired', type: 'gift_card', initialValue: 20, remainingValue: 20 } as Coupon,
            { ...baseCoupon, id: 'd', status: 'used', type: 'coupon', discountType: 'amount', discountValue: 100 } as Coupon,
        ];

        const kpis = calculateFinancialKPIs(coupons);

        // Trapped: 30 (gift card active) + 15 (coupon active) = 45
        expect(kpis.totalTrappedValue).toBe(45);

        // Lost: 20 (expired gift card) (ignore Used)
        expect(kpis.totalLostValue).toBe(20);
    });

    it('should bucket expiring soon correctly (timezone safe mock)', () => {
        // We simulate dates. getDaysUntilExpiry is tested separately, 
        // but we can construct dates relative to today.
        const today = new Date();
        const in5Days = new Date(today);
        in5Days.setDate(today.getDate() + 5);

        const in10Days = new Date(today);
        in10Days.setDate(today.getDate() + 10);

        const in20Days = new Date(today);
        in20Days.setDate(today.getDate() + 20);

        const coupons: Coupon[] = [
            // Standard amount coupon (counts: 1, value: 10)
            { ...baseCoupon, id: '1', status: 'active', type: 'coupon', discountType: 'amount', discountValue: 10, expiryDate: in5Days.toISOString().split('T')[0] } as Coupon,
            // Percent coupon (counts: 1, value: 0)
            { ...baseCoupon, id: '2', status: 'active', type: 'coupon', discountType: 'percent', discountValue: 20, expiryDate: in10Days.toISOString().split('T')[0] } as Coupon,
            // Gift card falling back to remaining value (counts: 1, value: 50)
            { ...baseCoupon, id: '3', status: 'active', type: 'gift_card', initialValue: 100, remainingValue: 50, expiryDate: in20Days.toISOString().split('T')[0] } as Coupon,
            // Invalid/missing amount coupon but valid expiry (counts: 1, value: 0)
            { ...baseCoupon, id: '4', status: 'active', type: 'voucher', expiryDate: in5Days.toISOString().split('T')[0] } as Coupon,
        ];

        const kpis = calculateFinancialKPIs(coupons);

        // 5 days: id 1 (10) + id 4 (0)
        expect(kpis.expiringSoon.in7Days.count).toBe(2);
        expect(kpis.expiringSoon.in7Days.value).toBe(10);

        // 10 days: 7days items + id 2 (0 percent)
        expect(kpis.expiringSoon.in14Days.count).toBe(3);
        expect(kpis.expiringSoon.in14Days.value).toBe(10); // Still 10!

        // 20 days: 14days items + id 3 (50 remaining)
        expect(kpis.expiringSoon.in30Days.count).toBe(4);
        expect(kpis.expiringSoon.in30Days.value).toBe(60); // 10 + 50
    });
});

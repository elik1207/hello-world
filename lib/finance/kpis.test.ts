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
            { ...baseCoupon, id: '1', status: 'active', type: 'coupon', discountType: 'amount', discountValue: 10, expiryDate: in5Days.toISOString().split('T')[0] } as Coupon,
            { ...baseCoupon, id: '2', status: 'active', type: 'coupon', discountType: 'amount', discountValue: 20, expiryDate: in10Days.toISOString().split('T')[0] } as Coupon,
            { ...baseCoupon, id: '3', status: 'active', type: 'coupon', discountType: 'amount', discountValue: 50, expiryDate: in20Days.toISOString().split('T')[0] } as Coupon,
        ];

        const kpis = calculateFinancialKPIs(coupons);

        // 5 days is in 7, 14, and 30 buckets.
        expect(kpis.expiringSoon.in7Days.count).toBe(1);
        expect(kpis.expiringSoon.in7Days.value).toBe(10);

        // 10 days is in 14 and 30 buckets, plus the 5 days one.
        expect(kpis.expiringSoon.in14Days.count).toBe(2);
        expect(kpis.expiringSoon.in14Days.value).toBe(30);

        // 20 days is only in the 30 bucket, plus all previous.
        expect(kpis.expiringSoon.in30Days.count).toBe(3);
        expect(kpis.expiringSoon.in30Days.value).toBe(80);
    });
});

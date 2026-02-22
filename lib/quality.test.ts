// @ts-nocheck
import { computeMissingFieldCount, computeNeedsReviewFieldCount } from './quality';

describe('lib/quality - Field Extraction Checks', () => {

    it('computes 0 missing fields for a fully populated coupon', () => {
        const coupon = {
            store: 'Zara',
            title: '20% Off',
            discountValue: 20,
            code: 'ZARA20'
        };
        expect(computeMissingFieldCount(coupon)).toBe(0);
    });

    it('flags missing store/title as 1 missing field', () => {
        const coupon = {
            // missing store and title
            discountValue: 20,
            code: 'ZARA20'
        };
        expect(computeMissingFieldCount(coupon)).toBe(1);
    });

    it('flags missing values as 1 missing field', () => {
        const coupon = {
            store: 'Zara',
            // missing discountValue and initialValue
            code: 'ZARA20'
        };
        expect(computeMissingFieldCount(coupon)).toBe(1);
    });

    it('flags missing code as 1 missing field', () => {
        const coupon = {
            store: 'Zara',
            title: '20% Off',
            discountValue: 20
            // missing code
        };
        expect(computeMissingFieldCount(coupon)).toBe(1);
    });

    it('computes multiple missing fields simultaneously', () => {
        const coupon = {
            // missing everything except one field type
            store: 'Zara'
        };
        // Title/store (OK), Value (Missing), Code (Missing) -> 2
        expect(computeMissingFieldCount(coupon)).toBe(2);
    });

    it('needsReview flags ambiguous short codes', () => {
        const coupon = {
            code: '123'
        };
        expect(computeNeedsReviewFieldCount(coupon)).toBe(1);
    });

    it('needsReview ignores valid long codes', () => {
        const coupon = {
            code: 'SAVE-1234'
        };
        expect(computeNeedsReviewFieldCount(coupon)).toBe(0);
    });

});

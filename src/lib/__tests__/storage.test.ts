import { getCoupons, saveCoupons, clearCoupons, importCoupons } from '../storage';
import { Coupon } from '../types';

describe('storage', () => {
    const mockLocalStorage = (() => {
        let store: Record<string, string> = {};
        return {
            getItem: jest.fn((key: string) => store[key] || null),
            setItem: jest.fn((key: string, value: string) => {
                store[key] = value.toString();
            }),
            removeItem: jest.fn((key: string) => {
                delete store[key];
            }),
            clear: jest.fn(() => {
                store = {};
            }),
        };
    })();

    Object.defineProperty(global, 'localStorage', {
        value: mockLocalStorage,
    });

    beforeEach(() => {
        mockLocalStorage.clear();
        jest.clearAllMocks();
    });

    const mockCoupon: Coupon = {
        id: '1',
        type: 'coupon',
        title: 'Test Coupon',
        code: 'TEST10',
        description: '10% off',
        discountType: 'percent',
        currency: 'ILS',
        expiryDate: '2023-12-31',
        status: 'active',
        createdAt: 1234567890,
        updatedAt: 1234567890,
    };

    describe('getCoupons', () => {
        it('should return empty array if storage is empty', () => {
            expect(getCoupons()).toEqual([]);
        });

        it('should return coupons if storage has data', () => {
            mockLocalStorage.setItem('coupon_wallet_v1', JSON.stringify([mockCoupon]));
            expect(getCoupons()).toEqual([mockCoupon]);
        });

        it('should return empty array if storage data is corrupted', () => {
            mockLocalStorage.setItem('coupon_wallet_v1', 'not a json array');
            // Console error is expected here, we can mock console.error to keep output clean
            const spy = jest.spyOn(console, 'error').mockImplementation(() => { });
            expect(getCoupons()).toEqual([]);
            spy.mockRestore();
        });
    });

    describe('saveCoupons', () => {
        it('should save coupons to localStorage', () => {
            saveCoupons([mockCoupon]);
            expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
                'coupon_wallet_v1',
                JSON.stringify({ version: 1, items: [mockCoupon] })
            );
        });
    });

    describe('clearCoupons', () => {
        it('should remove item from localStorage', () => {
            clearCoupons();
            expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('coupon_wallet_v1');
        });
    });

    describe('importCoupons', () => {
        it('should return true and save coupons for valid JSON array', () => {
            const json = JSON.stringify([mockCoupon]);
            const result = importCoupons(json);
            expect(result).toBe(true);
            expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
                'coupon_wallet_v1',
                JSON.stringify({ version: 1, items: [mockCoupon] })
            );
        });

        it('should return false for invalid JSON', () => {
            const result = importCoupons('invalid json');
            expect(result).toBe(false);
        });

        it('should return false if JSON is not an array', () => {
            const result = importCoupons('{"id": 1}');
            expect(result).toBe(false);
        });
    });
});

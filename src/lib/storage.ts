import type { Coupon } from './types';

const STORAGE_KEY = 'coupon_wallet_v1';

export function getCoupons(): Coupon[] {
    try {
        const json = localStorage.getItem(STORAGE_KEY);
        if (!json) return [];
        const parsed = JSON.parse(json);
        if (!Array.isArray(parsed)) {
            console.error('Storage corrupted: Expected array');
            return [];
        }
        return parsed;
    } catch (error) {
        console.error('Failed to parse coupons from storage', error);
        return [];
    }
}

export function saveCoupons(coupons: Coupon[]): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(coupons));
    } catch (error) {
        console.error('Failed to save coupons to storage', error);
        alert('Failed to save data. Local storage might be full.');
    }
}

export function clearCoupons(): void {
    localStorage.removeItem(STORAGE_KEY);
}

export function importCoupons(jsonStr: string): boolean {
    try {
        const parsed = JSON.parse(jsonStr);
        if (Array.isArray(parsed)) {
            saveCoupons(parsed);
            return true;
        }
        return false;
    } catch (e) {
        return false;
    }
}

import type { Coupon, WalletData } from './types';

const STORAGE_KEY = 'coupon_wallet_v1';

export function getCoupons(): Coupon[] {
    try {
        const json = localStorage.getItem(STORAGE_KEY);
        if (!json) return [];
        const parsed = JSON.parse(json);

        // Migrate legacy raw array storage
        if (Array.isArray(parsed)) {
            return parsed;
        }

        // Version 1 schema
        if (parsed && typeof parsed === 'object' && parsed.version === 1) {
            return Array.isArray(parsed.items) ? parsed.items : [];
        }

        console.error('Storage corrupted: Unknown format or validation failure');
        return [];
    } catch (error) {
        console.error('Failed to parse coupons from storage', error);
        return [];
    }
}

export function saveCoupons(coupons: Coupon[]): void {
    try {
        const data: WalletData = {
            version: 1,
            items: coupons
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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
        let rawItems: any[] = [];

        // Support importing both legacy raw arrays and new versioned exports
        if (Array.isArray(parsed)) {
            rawItems = parsed;
        } else if (parsed && typeof parsed === 'object' && parsed.version === 1) {
            rawItems = Array.isArray(parsed.items) ? parsed.items : [];
        } else {
            return false;
        }

        // Basic validation for each item
        const validItems: Coupon[] = [];
        for (const item of rawItems) {
            if (
                item && typeof item === 'object' &&
                typeof item.id === 'string' &&
                typeof item.title === 'string' &&
                (item.status === 'active' || item.status === 'used' || item.status === 'expired')
            ) {
                // Ensure type exists for backward compatibility 
                const validItem: Coupon = {
                    ...item,
                    type: item.type || 'coupon',
                    // Set default required fields if missing from old exports
                    discountType: item.discountType || 'percent',
                    currency: item.currency || 'ILS',
                    createdAt: item.createdAt || Date.now(),
                    updatedAt: item.updatedAt || Date.now(),
                };
                validItems.push(validItem);
            } else {
                console.warn('Skipping invalid item during import:', item);
            }
        }

        if (validItems.length > 0) {
            saveCoupons(validItems);
            return true;
        }

        return false;
    } catch (e) {
        console.error('Import failed', e);
        return false;
    }
}

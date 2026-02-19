import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Coupon } from './types';

const STORAGE_KEY = 'coupon_wallet_v1';

export async function getCoupons(): Promise<Coupon[]> {
    try {
        const json = await AsyncStorage.getItem(STORAGE_KEY);
        if (!json) return [];
        const parsed = JSON.parse(json);
        if (!Array.isArray(parsed)) return [];
        return parsed;
    } catch (error) {
        console.error('Failed to parse coupons from storage', error);
        return [];
    }
}

export async function saveCoupons(coupons: Coupon[]): Promise<void> {
    try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(coupons));
    } catch (error) {
        console.error('Failed to save coupons to storage', error);
    }
}

export async function clearCoupons(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEY);
}

export async function importCoupons(jsonStr: string): Promise<boolean> {
    try {
        const parsed = JSON.parse(jsonStr);
        if (Array.isArray(parsed)) {
            await saveCoupons(parsed);
            return true;
        }
        return false;
    } catch {
        return false;
    }
}

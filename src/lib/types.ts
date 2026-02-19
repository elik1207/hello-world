export type DiscountType = 'amount' | 'percent';
export type CouponStatus = 'active' | 'used' | 'expired';

export interface Coupon {
    id: string;
    title: string;
    description?: string;
    discountType: DiscountType;
    discountValue: number;
    currency: string;
    expiryDate?: string; // ISO YYYY-MM-DD
    store?: string;
    category?: string;
    code?: string;
    status: CouponStatus; // Derived or user-set
    createdAt: number;
    updatedAt: number;
}

export type SortOption = 'expiry-asc' | 'expiry-desc' | 'newest' | 'oldest';

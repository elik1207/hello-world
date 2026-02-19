export type DiscountType = 'amount' | 'percent';
export type CouponStatus = 'active' | 'used' | 'expired';
export type SortOption = 'expiry_asc' | 'expiry_desc' | 'created_desc';

export interface Coupon {
    id: string;
    title: string;
    description: string;
    discountType: DiscountType;
    discountValue: number;
    currency: string;
    expiryDate: string; // 'YYYY-MM-DD' or ''
    store: string;
    category: string;
    code: string;
    status: CouponStatus;
    createdAt: number;
    updatedAt: number;
}

export type DiscountType = 'amount' | 'percent';
export type CouponStatus = 'active' | 'used' | 'expired';
export type ItemType = 'coupon' | 'gift_card' | 'voucher';

export interface Coupon {
    id: string;
    type: ItemType;            // Added type
    title: string;
    description?: string;
    discountType: DiscountType; // for coupons
    discountValue?: number;     // for coupons/vouchers
    initialValue?: number;      // for gift cards
    remainingValue?: number;    // for gift cards
    currency: string;
    expiryDate?: string; // ISO YYYY-MM-DD
    store?: string;
    category?: string;
    code?: string;
    status: CouponStatus; // Derived or user-set
    sender?: string;      // Added optional sender
    event?: string;       // Added optional event (e.g., birthday)
    imageUrl?: string;    // Added optional image URL
    barcodeData?: string; // Added optional barcode/QR data
    createdAt: number;
    updatedAt: number;
}

export type SortOption = 'expiry-asc' | 'expiry-desc' | 'newest' | 'oldest';

export interface WalletData {
    version: number;
    items: Coupon[];
}

export type Category = 'food' | 'fashion' | 'entertainment' | 'tech' | 'other';

export interface Coupon {
    id: string;
    provider: string;
    code: string;
    initialValue: number;
    currentBalance: number;
    expirationDate: string; // ISO date string
    category: Category;
    notes?: string;
    isUsed?: boolean;
}

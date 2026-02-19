import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = 'ILS'): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(amount);
}

export function formatDate(dateStr: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString();
}

export function getDaysUntilExpiry(expiryDateStr?: string): number | null {
    if (!expiryDateStr) return null;
    const expiry = new Date(expiryDateStr);
    const now = new Date();
    // Reset time part to compare dates only
    expiry.setHours(23, 59, 59, 999);
    now.setHours(0, 0, 0, 0);

    const diffTime = expiry.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function isExpired(expiryDateStr?: string): boolean {
    if (!expiryDateStr) return false;
    const days = getDaysUntilExpiry(expiryDateStr);
    return days !== null && days < 0;
}

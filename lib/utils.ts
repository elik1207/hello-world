export function isExpired(expiryDate: string): boolean {
    if (!expiryDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(expiryDate) < today;
}

export function getDaysUntilExpiry(expiryDate: string): number | null {
    if (!expiryDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    const diff = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
}

export function formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
}

export function formatCurrency(value: number, currency: string): string {
    const symbols: Record<string, string> = {
        ILS: '₪',
        USD: '$',
        EUR: '€',
        GBP: '£',
    };
    const symbol = symbols[currency] || currency;
    return `${symbol}${value}`;
}

/** Simple class join utility (replaces clsx/twMerge) */
export function cn(...classes: (string | undefined | false | null)[]): string {
    return classes.filter(Boolean).join(' ');
}

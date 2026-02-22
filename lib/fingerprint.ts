import * as Crypto from 'expo-crypto';

export function normalizeVendor(vendor?: string): string {
    if (!vendor) return '';
    return vendor.trim().toUpperCase().replace(/[^A-Z0-9א-ת]/g, '');
}

export function normalizeCode(code?: string): string {
    if (!code) return '';
    return code.trim().toUpperCase().replace(/[\s\-]/g, '');
}

export async function generateFingerprint(
    vendor: string | undefined,
    amount: number | undefined,
    code: string | undefined,
    expiryDate: string | undefined
): Promise<string> {
    const normVendor = normalizeVendor(vendor);
    const amtStr = amount !== undefined ? amount.toString() : '';
    const normCode = normalizeCode(code);
    const expStr = expiryDate ? expiryDate.split('T')[0] : ''; // Just the date part

    const rawString = `${normVendor}|${amtStr}|${normCode}|${expStr}`;
    const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawString);

    return hash;
}

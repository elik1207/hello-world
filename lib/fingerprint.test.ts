// @ts-nocheck
import { normalizeVendor, normalizeCode, generateFingerprint } from './fingerprint';

jest.mock('expo-crypto', () => ({
    CryptoDigestAlgorithm: { SHA256: 'SHA256' },
    digestStringAsync: jest.fn((alg, str) => Promise.resolve(`hash_of_${str}`))
}));

describe('lib/fingerprint - Deduplication Normalization', () => {
    it('normalizes vendors correctly (removes spaces/special chars, uppercases, trims)', () => {
        expect(normalizeVendor('  Terminal X ')).toBe('TERMINALX');
        expect(normalizeVendor('H&M! ')).toBe('HM');
        expect(normalizeVendor('קסטרו  ')).toBe('קסטרו');
        expect(normalizeVendor(' ')).toBe('');
    });

    it('normalizes codes correctly (removes dashes/spaces, uppercases)', () => {
        expect(normalizeCode(' AB-123 456 ')).toBe('AB123456');
        expect(normalizeCode('HM-2025')).toBe('HM2025');
        expect(normalizeCode(undefined)).toBe('');
    });

    it('generates consistent fingerprints for equivalent items', async () => {
        const fp1 = await generateFingerprint('KSP', 50, 'KSP-ABC', '2025-12-31T00:00:00.000Z');
        const fp2 = await generateFingerprint(' K S P!', 50, 'KSP ABC', '2025-12-31');

        expect(fp1).toBe(fp2);
        expect(fp1).toBe('hash_of_KSP|50|KSPABC|2025-12-31');
    });

    it('handles undefined values safely', async () => {
        const fp = await generateFingerprint(undefined, undefined, undefined, undefined);
        expect(fp).toBe('hash_of_|||');
    });
});

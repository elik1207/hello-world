// @ts-nocheck
import { stableDigest } from './hash';

// Mock expo-crypto
jest.mock('expo-crypto', () => ({
    digestStringAsync: jest.fn(async (_algo: string, input: string) => {
        // Simple deterministic mock: hex of char codes
        let hash = '';
        for (let i = 0; i < Math.min(input.length, 32); i++) {
            hash += input.charCodeAt(i).toString(16).padStart(2, '0');
        }
        return hash.padEnd(64, '0');
    }),
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}));

describe('lib/hash - stableDigest', () => {
    it('produces a deterministic digest for the same input', async () => {
        const a = await stableDigest('hello world');
        const b = await stableDigest('hello world');
        expect(a).toBe(b);
    });

    it('produces different digests for different inputs', async () => {
        const a = await stableDigest('hello');
        const b = await stableDigest('world');
        expect(a).not.toBe(b);
    });

    it('returns a hex string (no raw text content)', async () => {
        const input = 'שובר 100₪ קוד ABC123';
        const digest = await stableDigest(input);

        // Digest should be a hex string
        expect(digest).toMatch(/^[a-f0-9]+$/);

        // Digest must NOT contain any recognizable content from the input
        expect(digest).not.toContain('שובר');
        expect(digest).not.toContain('100');
        expect(digest).not.toContain('ABC123');
        expect(digest).not.toContain('₪');
    });

    it('returns non-empty string', async () => {
        const digest = await stableDigest('test');
        expect(digest.length).toBeGreaterThan(0);
    });
});

describe('clipboard dedup privacy (integration-level assertions)', () => {
    it('stored digest value does not contain any original text substring', async () => {
        const originalText = 'שובר מתנה 250 ש״ח לרשת פוקס תוקף 31/12/2026 קוד XYZW9876ABCD';
        const digest = await stableDigest(originalText);

        // The stored value (digest) must not leak any part of the original text
        const textParts = originalText.split(/\s+/);
        for (const part of textParts) {
            expect(digest).not.toContain(part);
        }
    });

    it('digest is fixed-length regardless of input size', async () => {
        const short = await stableDigest('hi');
        const long = await stableDigest('x'.repeat(10000));
        // Both should produce a string (our mock pads to 64)
        expect(short.length).toBe(long.length);
    });
});

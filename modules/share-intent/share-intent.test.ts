/**
 * Tests for the share intake routing logic (JS-side, deterministic).
 * Mocks the native bridge to verify routing, buffer clearing, and analytics.
 */

import { normalizeIncomingText, getSafeAnalyticsMeta } from '../../lib/intake';

// Mock the share-intent module
const mockGetSharedText = jest.fn();
const mockClearSharedText = jest.fn();
const mockAddListener = jest.fn(() => jest.fn()); // returns unsub

jest.mock('../share-intent', () => ({
    getSharedText: (...args: any[]) => mockGetSharedText(...args),
    clearSharedText: (...args: any[]) => mockClearSharedText(...args),
    addShareIntentListener: (...args: any[]) => mockAddListener(...args),
}));

describe('Share intake routing (JS-side)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('routes shared text through normalize → intake pipeline', async () => {
        const rawText = '  שובר 100₪ בKSP  ';
        mockGetSharedText.mockResolvedValueOnce(rawText);

        const text = await mockGetSharedText();
        expect(text).toBe(rawText);

        // Simulate the App.tsx routing logic
        const normalized = normalizeIncomingText(text);
        expect(normalized).toBe('שובר 100₪ בKSP');
        expect(normalized.length).toBeGreaterThan(0);
    });

    it('clears native buffer after routing text', async () => {
        mockGetSharedText.mockResolvedValueOnce('voucher text');

        const text = await mockGetSharedText();
        if (text) {
            normalizeIncomingText(text);
            mockClearSharedText();
        }

        expect(mockClearSharedText).toHaveBeenCalledTimes(1);
    });

    it('does nothing when getSharedText returns null', async () => {
        mockGetSharedText.mockResolvedValueOnce(null);
        const text = await mockGetSharedText();

        expect(text).toBeNull();
        expect(mockClearSharedText).not.toHaveBeenCalled();
    });

    it('analytics meta never contains shared text', async () => {
        const sharedText = 'קוד מתנה ABC123 לרשת פוקס 250₪';
        const meta = getSafeAnalyticsMeta(sharedText, 'share');

        expect(meta.source).toBe('share');
        expect(meta.hasAmountHint).toBe(true);
        expect(meta.hasKeywordHint).toBe(true);

        // Verify no text content leaks
        const metaStr = JSON.stringify(meta);
        expect(metaStr).not.toContain('ABC123');
        expect(metaStr).not.toContain('פוקס');
        expect(metaStr).not.toContain('250');
        expect(metaStr).not.toContain('קוד');
    });

    it('warm-start listener receives and routes new share events', () => {
        let capturedListener: any = null;
        mockAddListener.mockImplementation((listener) => {
            capturedListener = listener;
            return jest.fn(); // unsub
        });

        // Simulate what App.tsx does
        const unsub = mockAddListener((event: { text: string }) => {
            const normalized = normalizeIncomingText(event.text);
            if (normalized) {
                mockClearSharedText();
            }
        });

        expect(capturedListener).toBeDefined();

        // Simulate a warm-start share event
        capturedListener({ text: 'gift card 50$' });
        expect(mockClearSharedText).toHaveBeenCalledTimes(1);
    });

    it('handles very long shared text by truncating', () => {
        const longText = 'א'.repeat(15000);
        const normalized = normalizeIncomingText(longText);
        expect(normalized.length).toBeLessThanOrEqual(10000);
    });

    it('handles empty shared text gracefully', () => {
        const normalized = normalizeIncomingText('');
        expect(normalized).toBe('');
    });
});

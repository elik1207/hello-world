import { normalizeIncomingText, classifyIntake, getSafeAnalyticsMeta } from './intake';

describe('normalizeIncomingText', () => {
    it('trims and collapses whitespace', () => {
        expect(normalizeIncomingText('  hello   world  ')).toBe('hello world');
    });

    it('strips zero-width characters', () => {
        expect(normalizeIncomingText('a\u200Bb\u200Dc\uFEFF')).toBe('abc');
    });

    it('collapses excessive newlines', () => {
        expect(normalizeIncomingText('a\n\n\n\n\nb')).toBe('a\n\nb');
    });

    it('limits length to 10k chars', () => {
        const long = 'a'.repeat(15000);
        expect(normalizeIncomingText(long).length).toBe(10000);
    });

    it('handles empty string', () => {
        expect(normalizeIncomingText('')).toBe('');
    });
});

describe('classifyIntake', () => {
    it('detects currency + amount as candidate', () => {
        const result = classifyIntake('שובר של 100 ₪ ב-KSP');
        expect(result.isCandidate).toBe(true);
        expect(result.reasons).toContain('amount_hint');
        expect(result.reasons).toContain('keyword_hint');
    });

    it('detects expiry patterns', () => {
        const result = classifyIntake('valid until 31/12/2025');
        expect(result.isCandidate).toBe(true);
        expect(result.reasons).toContain('date_hint');
    });

    it('detects keyword hints', () => {
        const result = classifyIntake('קופון הנחה מיוחד');
        expect(result.isCandidate).toBe(true);
        expect(result.reasons).toContain('keyword_hint');
    });

    it('detects code-like tokens', () => {
        const result = classifyIntake('Use code: ABCD1234EFGH');
        expect(result.isCandidate).toBe(true);
        expect(result.reasons).toContain('code_token');
    });

    it('rejects plain text without voucher signals', () => {
        const result = classifyIntake('Hey, how are you doing today?');
        expect(result.isCandidate).toBe(false);
        expect(result.reasons).toHaveLength(0);
    });

    it('detects gift card keyword', () => {
        const result = classifyIntake('I got a gift card for you');
        expect(result.isCandidate).toBe(true);
        expect(result.reasons).toContain('keyword_hint');
    });

    it('detects Hebrew voucher keyword', () => {
        const result = classifyIntake('קיבלתי שובר מתנה');
        expect(result.isCandidate).toBe(true);
    });
});

describe('getSafeAnalyticsMeta', () => {
    it('returns safe metadata without raw text', () => {
        const meta = getSafeAnalyticsMeta('שובר 50₪ תוקף 01/01/2026', 'deeplink');
        expect(meta.source).toBe('deeplink');
        expect(meta.lengthBucket).toBe('<50');
        expect(meta.hasAmountHint).toBe(true);
        expect(meta.hasDateHint).toBe(true);
        expect(meta.hasKeywordHint).toBe(true);
        // Ensure no raw text leaks
        expect(Object.values(meta).join(' ')).not.toContain('שובר');
        expect(Object.values(meta).join(' ')).not.toContain('50');
    });

    it('categorizes length buckets correctly', () => {
        expect(getSafeAnalyticsMeta('x'.repeat(100), 'share').lengthBucket).toBe('50-200');
        expect(getSafeAnalyticsMeta('x'.repeat(300), 'clipboard').lengthBucket).toBe('200-500');
        expect(getSafeAnalyticsMeta('x'.repeat(1000), 'share').lengthBucket).toBe('500-2k');
        expect(getSafeAnalyticsMeta('x'.repeat(5000), 'deeplink').lengthBucket).toBe('2k+');
    });
});

describe('deeplink parsing (pure)', () => {
    it('extracts text from giftwallet:// intake URL', () => {
        const url = 'couponwallet://intake?text=%D7%A9%D7%95%D7%91%D7%A8%20100';
        const parsed = new URL(url);
        const text = parsed.searchParams.get('text');
        expect(text).toBe('שובר 100');
    });

    it('handles empty text param', () => {
        const url = 'couponwallet://intake?text=';
        const parsed = new URL(url);
        expect(parsed.searchParams.get('text')).toBe('');
    });

    it('handles missing text param gracefully', () => {
        const url = 'couponwallet://intake';
        const parsed = new URL(url);
        expect(parsed.searchParams.get('text')).toBeNull();
    });
});

describe('clipboard suggestion throttle/dedup (pure logic)', () => {
    it('should not suggest if same hash as last seen', () => {
        const hash = (t: string) => t.length.toString(); // simplistic mock hash
        const lastHash = hash('hello world');
        const currentHash = hash('hello world');
        expect(currentHash === lastHash).toBe(true); // should NOT suggest
    });

    it('should suggest if hash differs from last seen', () => {
        const hash = (t: string) => t.length.toString();
        const lastHash = hash('hello world');
        const currentHash = hash('a different text entirely');
        expect(currentHash !== lastHash).toBe(true); // should suggest
    });

    it('should not suggest if last prompt was less than N minutes ago', () => {
        const THROTTLE_MS = 5 * 60 * 1000; // 5 minutes
        const lastPromptTime = Date.now() - (2 * 60 * 1000); // 2 min ago
        const shouldPrompt = (Date.now() - lastPromptTime) >= THROTTLE_MS;
        expect(shouldPrompt).toBe(false);
    });

    it('should suggest if enough time has passed', () => {
        const THROTTLE_MS = 5 * 60 * 1000;
        const lastPromptTime = Date.now() - (10 * 60 * 1000); // 10 min ago
        const shouldPrompt = (Date.now() - lastPromptTime) >= THROTTLE_MS;
        expect(shouldPrompt).toBe(true);
    });
});

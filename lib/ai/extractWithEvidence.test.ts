import { extractWithEvidence } from './extractWithEvidence';

describe('extractWithEvidence', () => {
    // --- Evidence range correctness ---
    describe('evidence ranges', () => {
        it('amount evidence matches actual text position', () => {
            const text = 'קופון ₪200 לפוקס';
            const result = extractWithEvidence(text, 'whatsapp');

            expect(result.fields.amount.value).toEqual({ value: 200, currency: 'ILS' });
            const ev = result.fields.amount.evidence?.[0];
            expect(ev).toBeDefined();
            expect(text.slice(ev!.start, ev!.end)).toBe('₪200');
        });

        it('store evidence matches actual text position', () => {
            const text = 'שובר לפוקס הום 100 שח';
            const result = extractWithEvidence(text, 'whatsapp');

            const ev = result.fields.store.evidence?.[0];
            expect(ev).toBeDefined();
            expect(result.fields.store.value).toBe('Fox');
            expect(text.slice(ev!.start, ev!.end)).toMatch(/פוקס הום/);
        });

        it('code evidence matches actual text position', () => {
            const text = 'קוד: FOX-2026-XQ5 תודה';
            const result = extractWithEvidence(text, 'sms');

            const ev = result.fields.code.evidence?.[0];
            expect(ev).toBeDefined();
            expect(result.fields.code.value).toBe('FOX-2026-XQ5');
            expect(text.slice(ev!.start, ev!.end)).toBe('FOX-2026-XQ5');
        });

        it('expiry date evidence matches actual text position', () => {
            const text = 'בתוקף עד 31/12/2026 קוד ABC-123';
            const result = extractWithEvidence(text, 'whatsapp');

            const ev = result.fields.expiryDate.evidence?.[0];
            expect(ev).toBeDefined();
            expect(text.slice(ev!.start, ev!.end)).toBe('31/12/2026');
            expect(result.fields.expiryDate.value).toBe('2026-12-31');
        });
    });

    // --- Confidence levels ---
    describe('confidence', () => {
        it('amount with currency symbol → high', () => {
            const result = extractWithEvidence('₪200', 'whatsapp');
            expect(result.fields.amount.confidence).toBe('high');
        });

        it('amount without currency → medium', () => {
            const result = extractWithEvidence('here is 200 for you', 'whatsapp');
            expect(result.fields.amount.confidence).toBe('medium');
        });

        it('date with Hebrew context → high', () => {
            const result = extractWithEvidence('בתוקף עד 31/12/2026', 'whatsapp');
            expect(result.fields.expiryDate.confidence).toBe('high');
        });

        it('date without context → medium', () => {
            const result = extractWithEvidence('something 31/12/2026', 'whatsapp');
            expect(result.fields.expiryDate.confidence).toBe('medium');
        });

        it('code with indicator keyword → high', () => {
            const result = extractWithEvidence('קוד: ABC-1234', 'whatsapp');
            expect(result.fields.code.confidence).toBe('high');
        });

        it('code from isolated string → medium', () => {
            const result = extractWithEvidence('999A-456B-888X', 'whatsapp');
            expect(result.fields.code.confidence).toBe('medium');
        });
    });

    // --- Issues ---
    describe('issues', () => {
        it('flags multiple amounts', () => {
            const text = '₪200 or ₪300 maybe';
            const result = extractWithEvidence(text, 'whatsapp');
            expect(result.summary.issues).toContain('multiple_amounts_found');
        });

        it('flags multiple dates', () => {
            const text = '01/01/2025 and 31/12/2026';
            const result = extractWithEvidence(text, 'whatsapp');
            expect(result.summary.issues).toContain('multiple_dates_found');
        });
    });

    // --- Summary ---
    describe('summary', () => {
        it('counts missing fields', () => {
            const result = extractWithEvidence('just some text', 'whatsapp');
            expect(result.summary.missingFieldCount).toBeGreaterThanOrEqual(3);
        });

        it('full voucher has 0 missing', () => {
            const text = 'פוקס ₪200 קוד: FOX-999 בתוקף עד 31/12/2026';
            const result = extractWithEvidence(text, 'whatsapp');
            expect(result.summary.missingFieldCount).toBe(0);
        });
    });

    // --- Backward compat: same outputs as extractGiftFromText ---
    describe('backward compatibility', () => {
        it('Fox voucher matches expected fields', () => {
            const text = 'היי! הנה קופון ₪200 לפוקס הום שקניתי לך. בתוקף עד 31/12/2026. קוד: FOX-2026-XQ5';
            const result = extractWithEvidence(text, 'whatsapp');

            expect(result.fields.store.value).toBe('Fox');
            expect(result.fields.amount.value?.value).toBe(200);
            expect(result.fields.amount.value?.currency).toBe('ILS');
            expect(result.fields.code.value).toBe('FOX-2026-XQ5');
            expect(result.fields.expiryDate.value).toBe('2026-12-31');
            expect(result.fields.title.value).toBe('Fox Voucher');
            expect(result.routingMeta.used).toBe('offline');
        });

        it('BuyMe long code detected', () => {
            const text = `ביימי ₪400 תוקף עד 31.12.2025 קוד 5432-1234-4321`;
            const result = extractWithEvidence(text, 'whatsapp');

            expect(result.fields.store.value).toBe('BuyMe');
            expect(result.fields.amount.value?.value).toBe(400);
            expect(result.fields.code.value).toBe('5432-1234-4321');
        });
    });
});

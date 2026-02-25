import {
    validateEvidence,
    validateExpiryDate,
    validateAmount,
    validateExtractionResult,
} from './normalizeValidate';
import type { ExtractionResult, Evidence } from './extractionTypes';

describe('normalizeValidate', () => {
    // --- validateEvidence ---
    describe('validateEvidence', () => {
        const text = 'hello world'; // length 11

        it('valid evidence returns no issues', () => {
            const ev: Evidence = { start: 0, end: 5, text: 'hello', source: 'offline' };
            expect(validateEvidence(ev, text)).toEqual([]);
        });

        it('negative start', () => {
            const ev: Evidence = { start: -1, end: 5, source: 'offline' };
            expect(validateEvidence(ev, text)).toContain('evidence_negative_start');
        });

        it('end exceeds text length', () => {
            const ev: Evidence = { start: 0, end: 100, source: 'offline' };
            expect(validateEvidence(ev, text)).toContain('evidence_exceeds_text_length');
        });

        it('empty range (start >= end)', () => {
            const ev: Evidence = { start: 5, end: 5, source: 'offline' };
            expect(validateEvidence(ev, text)).toContain('evidence_empty_range');
        });

        it('text mismatch', () => {
            const ev: Evidence = { start: 0, end: 5, text: 'WRONG', source: 'offline' };
            expect(validateEvidence(ev, text)).toContain('evidence_text_mismatch');
        });

        it('text matches actual slice', () => {
            const ev: Evidence = { start: 6, end: 11, text: 'world', source: 'offline' };
            expect(validateEvidence(ev, text)).toEqual([]);
        });
    });

    // --- validateExpiryDate ---
    describe('validateExpiryDate', () => {
        it('valid date returns no issues', () => {
            expect(validateExpiryDate('2026-12-31')).toEqual([]);
        });

        it('null returns no issues', () => {
            expect(validateExpiryDate(null)).toEqual([]);
        });

        it('invalid format', () => {
            expect(validateExpiryDate('31/12/2026')).toContain('expiry_date_invalid_format');
        });

        it('ISO string with time', () => {
            expect(validateExpiryDate('2026-12-31T00:00:00Z')).toContain('expiry_date_invalid_format');
        });

        it('impossible date (Feb 30)', () => {
            expect(validateExpiryDate('2026-02-30')).toContain('expiry_date_invalid_date');
        });

        it('date far in the past', () => {
            expect(validateExpiryDate('2020-01-01')).toContain('expiry_date_in_past');
        });

        it('future date is fine', () => {
            expect(validateExpiryDate('2030-06-15')).toEqual([]);
        });
    });

    // --- validateAmount ---
    describe('validateAmount', () => {
        it('valid amount returns no issues', () => {
            expect(validateAmount({ value: 200, currency: 'ILS' })).toEqual([]);
        });

        it('null returns no issues', () => {
            expect(validateAmount(null)).toEqual([]);
        });

        it('negative amount', () => {
            expect(validateAmount({ value: -50, currency: 'ILS' })).toContain('amount_not_positive');
        });

        it('zero amount', () => {
            expect(validateAmount({ value: 0, currency: 'ILS' })).toContain('amount_not_positive');
        });

        it('unreasonably large', () => {
            expect(validateAmount({ value: 999999, currency: 'ILS' })).toContain('amount_unreasonably_large');
        });

        it('NaN amount', () => {
            expect(validateAmount({ value: NaN })).toContain('amount_not_finite');
        });

        it('unknown currency', () => {
            expect(validateAmount({ value: 100, currency: 'BTC' })).toContain('amount_unknown_currency');
        });

        it('known currencies pass', () => {
            for (const c of ['ILS', 'USD', 'EUR', 'GBP']) {
                expect(validateAmount({ value: 100, currency: c })).toEqual([]);
            }
        });
    });

    // --- validateExtractionResult (full pipeline) ---
    describe('validateExtractionResult', () => {
        const text = 'פוקס ₪200 קוד: FOX-999 בתוקף עד 31/12/2026';

        const makeValidResult = (): ExtractionResult => ({
            fields: {
                title: { value: 'Fox Voucher', confidence: 'high', evidence: [{ start: 0, end: 4, text: 'פוקס', source: 'offline' }], issues: [] },
                store: { value: 'Fox', confidence: 'high', evidence: [{ start: 0, end: 4, text: 'פוקס', source: 'offline' }], issues: [] },
                amount: { value: { value: 200, currency: 'ILS' }, confidence: 'high', evidence: [{ start: 5, end: 9, text: '₪200', source: 'offline' }], issues: [] },
                code: { value: 'FOX-999', confidence: 'high', evidence: [{ start: 15, end: 22, text: 'FOX-999', source: 'offline' }], issues: [] },
                expiryDate: { value: '2026-12-31', confidence: 'high', evidence: [{ start: 33, end: 43, text: '31/12/2026', source: 'offline' }], issues: [] },
            },
            summary: { missingFieldCount: 0, needsReviewFieldCount: 0, issues: [] },
            routingMeta: { used: 'offline' },
        });

        it('valid result passes through unchanged', () => {
            const result = validateExtractionResult(makeValidResult(), text);
            expect(result.summary.needsReviewFieldCount).toBe(0);
            expect(result.summary.missingFieldCount).toBe(0);
        });

        it('bad evidence range downgrades confidence', () => {
            const result = makeValidResult();
            result.fields.code.evidence = [{ start: 0, end: 999, text: 'wrong', source: 'offline' }];
            const validated = validateExtractionResult(result, text);

            expect(validated.fields.code.confidence).toBe('low');
            expect(validated.fields.code.issues).toContain('evidence_exceeds_text_length');
        });

        it('invalid date format downgrades confidence', () => {
            const result = makeValidResult();
            result.fields.expiryDate.value = '31/12/2026';
            const validated = validateExtractionResult(result, text);

            expect(validated.fields.expiryDate.confidence).toBe('low');
            expect(validated.fields.expiryDate.issues).toContain('expiry_date_invalid_format');
        });

        it('negative amount downgrades confidence', () => {
            const result = makeValidResult();
            result.fields.amount.value = { value: -100, currency: 'ILS' };
            const validated = validateExtractionResult(result, text);

            expect(validated.fields.amount.confidence).toBe('low');
            expect(validated.fields.amount.issues).toContain('amount_not_positive');
        });

        it('recomputes summary counts after validation', () => {
            const result = makeValidResult();
            result.fields.code.evidence = [{ start: -1, end: 5, source: 'offline' }]; // bad evidence
            result.fields.expiryDate.value = '2026-02-30'; // invalid date
            const validated = validateExtractionResult(result, text);

            expect(validated.summary.needsReviewFieldCount).toBeGreaterThanOrEqual(2);
        });
    });
});

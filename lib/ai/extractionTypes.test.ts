import type { ExtractionResult, AmountValue } from './extractionTypes';
import { toGiftOrVoucherDraft, confidenceToScore, emptyField } from './extractionTypes';

describe('extractionTypes', () => {
    describe('confidenceToScore', () => {
        it('maps high → 1.0', () => expect(confidenceToScore('high')).toBe(1.0));
        it('maps medium → 0.6', () => expect(confidenceToScore('medium')).toBe(0.6));
        it('maps low → 0.3', () => expect(confidenceToScore('low')).toBe(0.3));
    });

    describe('emptyField', () => {
        it('returns null value with low confidence', () => {
            const f = emptyField<string>();
            expect(f.value).toBeNull();
            expect(f.confidence).toBe('low');
            expect(f.evidence).toEqual([]);
            expect(f.issues).toEqual([]);
        });
    });

    describe('toGiftOrVoucherDraft', () => {
        const makeResult = (overrides?: Partial<ExtractionResult>): ExtractionResult => ({
            fields: {
                title: { value: 'Fox Voucher', confidence: 'high', evidence: [], issues: [] },
                store: { value: 'Fox', confidence: 'high', evidence: [], issues: [] },
                amount: { value: { value: 200, currency: 'ILS' }, confidence: 'high', evidence: [], issues: [] },
                code: { value: 'FOX-123', confidence: 'high', evidence: [], issues: [] },
                expiryDate: { value: '2026-12-31', confidence: 'high', evidence: [], issues: [] },
            },
            summary: { missingFieldCount: 0, needsReviewFieldCount: 0, issues: [] },
            routingMeta: { used: 'offline' },
            ...overrides,
        });

        it('converts a full result to GiftOrVoucherDraft', () => {
            const result = makeResult();
            const draft = toGiftOrVoucherDraft(result, 'source text', 'whatsapp');

            expect(draft.title).toBe('Fox Voucher');
            expect(draft.merchant).toBe('Fox');
            expect(draft.amount).toBe(200);
            expect(draft.currency).toBe('ILS');
            expect(draft.code).toBe('FOX-123');
            expect(draft.expirationDate).toBe('2026-12-31');
            expect(draft.sourceType).toBe('whatsapp');
            expect(draft.sourceText).toBe('source text');
            expect(draft.missingRequiredFields).toEqual([]);
            expect(draft.questions).toEqual([]);
        });

        it('marks missing fields and generates title question', () => {
            const result = makeResult({
                fields: {
                    ...makeResult().fields,
                    title: { value: null, confidence: 'low', evidence: [], issues: [] },
                    amount: { value: null, confidence: 'low', evidence: [], issues: [] },
                },
            });
            const draft = toGiftOrVoucherDraft(result, '', 'sms');

            expect(draft.missingRequiredFields).toContain('title');
            expect(draft.missingRequiredFields).toContain('amount');
            expect(draft.questions).toHaveLength(1);
            expect(draft.questions[0].key).toBe('title');
        });

        it('marks inferred fields when confidence is not high', () => {
            const result = makeResult({
                fields: {
                    ...makeResult().fields,
                    amount: { value: { value: 100, currency: 'ILS' }, confidence: 'medium', evidence: [], issues: ['inferred'] },
                },
            });
            const draft = toGiftOrVoucherDraft(result, '', 'other');

            expect(draft.inferredFields).toContain('amount');
            expect(draft.assumptions).toContain('inferred');
        });

        it('computes overall confidence as average', () => {
            const result = makeResult({
                fields: {
                    title: { value: 'X', confidence: 'high', evidence: [], issues: [] },
                    store: { value: 'Y', confidence: 'high', evidence: [], issues: [] },
                    amount: { value: { value: 100, currency: 'ILS' }, confidence: 'low', evidence: [], issues: [] },
                    code: { value: 'Z', confidence: 'medium', evidence: [], issues: [] },
                    expiryDate: { value: '2026-01-01', confidence: 'low', evidence: [], issues: [] },
                },
            });
            const draft = toGiftOrVoucherDraft(result, '', 'other');

            // (1.0 + 1.0 + 0.3 + 0.6 + 0.3) / 5 = 0.64
            expect(draft.confidence).toBe(0.64);
        });
    });
});

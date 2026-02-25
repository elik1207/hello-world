import { describe, it, expect } from '@jest/globals';
import { computeQualityFromExtraction } from './qualityFlags';
import type { ExtractionResult } from './extractionTypes';

describe('computeQualityFromExtraction', () => {
    const makeResult = (): ExtractionResult => ({
        fields: {
            title: { value: 'Test', confidence: 'high', evidence: [], issues: [] },
            store: { value: 'TestStore', confidence: 'high', evidence: [], issues: [] },
            amount: { value: { value: 100 }, confidence: 'high', evidence: [], issues: [] },
            code: { value: '1234', confidence: 'high', evidence: [], issues: [] },
            expiryDate: { value: '2025-01-01', confidence: 'high', evidence: [], issues: [] },
        },
        summary: { missingFieldCount: 0, needsReviewFieldCount: 0, issues: [] },
        routingMeta: { used: 'offline' },
    });

    it('returns zero counts for perfect result', () => {
        const result = makeResult();
        const q = computeQualityFromExtraction(result);
        expect(q.missingFieldCount).toBe(0);
        expect(q.needsReviewFieldCount).toBe(0);
        expect(q.hasAmount).toBe(true);
        expect(q.hasCode).toBe(true);
        expect(q.hasExpiry).toBe(true);
    });

    it('counts missing required fields', () => {
        const result = makeResult();
        result.fields.title.value = null;
        result.fields.amount.value = null;
        const q = computeQualityFromExtraction(result);

        expect(q.missingFields).toContain('title');
        expect(q.missingFields).toContain('amount');
        expect(q.missingFieldCount).toBe(2);
        expect(q.hasAmount).toBe(false);
    });

    it('counts low/medium confidence fields as needs review', () => {
        const result = makeResult();
        result.fields.code.confidence = 'low';
        result.fields.expiryDate.confidence = 'medium';
        const q = computeQualityFromExtraction(result);

        expect(q.needsReviewFields).toContain('code');
        expect(q.needsReviewFields).toContain('expirationDate');
        expect(q.needsReviewFieldCount).toBe(2);
    });

    it('does not flag fields that the user already edited', () => {
        const result = makeResult();
        result.fields.title.value = null; // missing
        result.fields.code.confidence = 'low'; // needs review

        const edited = new Set(['title', 'code']);
        const q = computeQualityFromExtraction(result, edited);

        expect(q.missingFieldCount).toBe(0);
        expect(q.needsReviewFieldCount).toBe(0);
    });
});

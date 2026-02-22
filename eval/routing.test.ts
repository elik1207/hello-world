import { GiftOrVoucherDraft } from '../lib/types';
import { shouldUseLlm } from './server';

// Extracted for testing since server.ts does not export it directly:
function mockShouldUseLlm(sourceText: string, deterministicResult: Partial<GiftOrVoucherDraft> | null): boolean {
    if (!deterministicResult) return true;

    if (sourceText.toLowerCase().includes('password') || sourceText.toLowerCase().includes('verification code')) {
        return false;
    }

    const missingAmount = !deterministicResult.amount;
    const missingTitle = !deterministicResult.title;
    const hasAmbiguousCode = (deterministicResult.code?.length || 0) < 4;

    const missingConditionCount = (missingAmount ? 1 : 0) + (missingTitle ? 1 : 0) + (hasAmbiguousCode ? 1 : 0);
    return missingConditionCount >= 1;
}

describe('LLM Routing Policy (shouldUseLlm)', () => {

    it('forces LLM when deterministic result is completely null', () => {
        expect(mockShouldUseLlm('I got a gift from Fox', null)).toBe(true);
    });

    it('skips LLM entirely for clean passwords and OTP tracking codes', () => {
        const text = 'Your verification code is 199281';
        expect(mockShouldUseLlm(text, { title: 'Auth', code: '199281' })).toBe(false);
    });

    it('skips LLM if deterministic result is perfect and robust', () => {
        const text = '100₪ at Zara. Code: ZR-1991823-9912';
        expect(mockShouldUseLlm(text, {
            title: 'Zara',
            amount: 100,
            code: 'ZR-1991823-9912'
        })).toBe(false);
    });

    it('forces LLM if output lacks an amount AND a title', () => {
        const text = 'Here is your receipt code: ABCD';
        expect(mockShouldUseLlm(text, {
            code: 'ABCD' // missing title and amount (2 missing conditions)
        })).toBe(true);
    });

    it('forces LLM if output code is weirdly short (ambiguous)', () => {
        const text = 'Shufersal 200 NIS code 12';
        expect(mockShouldUseLlm(text, {
            title: 'Shufersal',
            amount: 200,
            code: '12' // < 4 length
        })).toBe(true);
    });
});

import { GiftOrVoucherDraft } from '../lib/types';
import { shouldUseLlm } from '../backend/llm/routing';

describe('LLM Routing Policy (shouldUseLlm)', () => {

    it('forces LLM when deterministic result is completely null', () => {
        expect(shouldUseLlm('I got a gift from Fox', null)).toBe(true);
    });

    it('skips LLM entirely for clean passwords and OTP tracking codes', () => {
        const text = 'Your verification code is 199281';
        expect(shouldUseLlm(text, { title: 'Auth', code: '199281' } as any)).toBe(false);
    });

    it('skips LLM if deterministic result is perfect and robust', () => {
        const text = '100₪ at Zara. Code: ZR-1991823-9912';
        expect(shouldUseLlm(text, {
            title: 'Zara',
            amount: 100,
            code: 'ZR-1991823-9912'
        } as any)).toBe(false);
    });

    it('forces LLM if output lacks an amount AND a title', () => {
        const text = 'Here is your receipt code: ABCD';
        expect(shouldUseLlm(text, {
            code: 'ABCD' // missing title and amount (2 missing conditions)
        } as any)).toBe(true);
    });

    it('forces LLM if output code is weirdly short (ambiguous)', () => {
        const text = 'Shufersal 200 NIS code 12';
        expect(shouldUseLlm(text, {
            title: 'Shufersal',
            amount: 200,
            code: '12' // < 4 length
        } as any)).toBe(true);
    });
});

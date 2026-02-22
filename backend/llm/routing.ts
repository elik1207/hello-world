import type { GiftOrVoucherDraft } from '../../lib/types';

// Routing Heuristic: Decides if we actually need to pay for an LLM call or if the regex nailed it
export function shouldUseLlm(sourceText: string, deterministicResult: GiftOrVoucherDraft | null): boolean {
    if (!deterministicResult) return true; // Regex yielded nothing at all

    // Explicit exclusions - if it has "tracking" things, don't bother LLM
    if (sourceText.toLowerCase().includes('password') || sourceText.toLowerCase().includes('verification code')) {
        return false;
    }

    const missingAmount = !deterministicResult.amount;
    const missingTitle = !deterministicResult.title;
    const hasAmbiguousCode = (deterministicResult.code?.length || 0) < 4;

    const missingConditionCount = (missingAmount ? 1 : 0) + (missingTitle ? 1 : 0) + (hasAmbiguousCode ? 1 : 0);

    // Fall back to the heavy model if we are missing critical fields
    return missingConditionCount >= 1;
}

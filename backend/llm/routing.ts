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

import type { ExtractionResult } from '../../lib/ai/extractionTypes';

/**
 * Phase 10 Routing Heuristic
 * Decides whether to pay for an LLM call based on the offline ExtractionResult confidence.
 */
export function shouldUseLlmV2(sourceText: string, offlineResult: ExtractionResult | null): boolean {
    if (!offlineResult) return true; // Regex yielded nothing

    // Explicit exclusions - if it has "tracking" things, don't bother LLM
    if (sourceText.toLowerCase().includes('password') || sourceText.toLowerCase().includes('verification code')) {
        return false;
    }

    const { summary, fields } = offlineResult;

    // 1. Missing required fields
    if (summary.missingFieldCount > 0) return true;

    // 2. Too many inferred fields
    if (summary.needsReviewFieldCount > 1) return true;

    // 3. Critical fields have explicitly low confidence (e.g. hallucinated/bad validation)
    if (fields.amount.confidence === 'low') return true;
    if (fields.code.confidence === 'low' && fields.code.value) return true;
    if (fields.expiryDate.confidence === 'low' && fields.expiryDate.value) return true;

    // Otherwise, offline extraction is confident enough
    return false;
}

import { GiftOrVoucherDraft } from '../types';

export interface QualityFlags {
    missingFields: string[];
    needsReviewFields: string[];
    missingFieldCount: number;
    needsReviewFieldCount: number;
    hasAmount: boolean;
    hasCode: boolean;
    hasExpiry: boolean;
}

export function computeQualityFlags(draft: GiftOrVoucherDraft, editedFields: Set<string>): QualityFlags {
    const missingFields: string[] = [];
    const needsReviewFields: string[] = [];

    // 1. Missing Fields
    // Only flag strictly required UI mappings as missing. Code is intentionally excluded from visual "Missing" warnings.
    const isMissing = (field: keyof GiftOrVoucherDraft) =>
        !editedFields.has(field) && draft.missingRequiredFields?.includes(field);

    if (isMissing('title')) missingFields.push('title');
    if (isMissing('amount')) missingFields.push('amount');
    if (isMissing('expirationDate')) missingFields.push('expirationDate');

    // 2. Needs Review Fields
    // If confidence is severely low or the field was marked inferred by the parser
    const isInferred = (field: keyof GiftOrVoucherDraft) =>
        !editedFields.has(field) && (draft.inferredFields?.includes(field) || draft.confidence < 0.6);

    if (isInferred('title') || isInferred('merchant')) {
        if (!editedFields.has('title')) needsReviewFields.push('title');
        if (!editedFields.has('merchant')) needsReviewFields.push('merchant');
    }

    if (isInferred('amount') && !editedFields.has('amount')) {
        needsReviewFields.push('amount');
    }

    if (isInferred('expirationDate') && !editedFields.has('expirationDate')) {
        needsReviewFields.push('expirationDate');
    }

    // Deterministic suspicious code check
    if (draft.code && !editedFields.has('code')) {
        const code = draft.code;
        const noDigits = !/\d/.test(code);
        const tooShort = code.length < 6;
        const isGeneric = /^GIFT$/i.test(code) || /^COUPON$/i.test(code);
        const isPhoneLike = /^[\d-]+$/.test(code) && code.length >= 9 && code.length <= 15;

        if (noDigits || tooShort || isGeneric || isPhoneLike || isInferred('code')) {
            if (!needsReviewFields.includes('code')) {
                needsReviewFields.push('code');
            }
        }
    }

    // De-duplicate just in case
    const uniqueMissing = Array.from(new Set(missingFields));
    const uniqueReview = Array.from(new Set(needsReviewFields));

    return {
        missingFields: uniqueMissing,
        needsReviewFields: uniqueReview,
        missingFieldCount: uniqueMissing.length,
        needsReviewFieldCount: uniqueReview.length,
        hasAmount: draft.amount !== undefined,
        hasCode: !!draft.code,
        hasExpiry: !!draft.expirationDate,
    };
}

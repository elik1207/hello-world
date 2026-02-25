/**
 * lib/ai/extractionTypes.ts
 *
 * Unified extraction output types for Phase AI-10 Trust Layer.
 * Every extracted field carries confidence, evidence ranges, and issues.
 * Quality flags (missing/needsReview) derive deterministically from these.
 *
 * Backward compatibility: toGiftOrVoucherDraft() converts to the existing
 * GiftOrVoucherDraft interface used by the rest of the app.
 */
import type { GiftOrVoucherDraft, SourceType } from '../types';

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

export type FieldName = 'title' | 'store' | 'amount' | 'code' | 'expiryDate';

export type Confidence = 'high' | 'medium' | 'low';

/** Where in the original text a value was found. */
export interface Evidence {
    /** Character offset (0-based) in the original input string. */
    start: number;
    /** Character offset (exclusive end). */
    end: number;
    /** The matched snippet — kept in-memory only, never persisted/logged. */
    text?: string;
    /** Which extraction source produced this evidence. */
    source: 'offline' | 'llm';
    /** Name of the rule/regex that matched (offline only). */
    rule?: string;
}

/** Result for a single extracted field. */
export interface FieldResult<T> {
    /** Extracted value, or null if not found. */
    value: T | null;
    /** How confident the extractor is in this value. */
    confidence: Confidence;
    /** Where in the text this value was found. */
    evidence?: Evidence[];
    /** Human-readable issue codes (e.g. "multiple_dates_found"). */
    issues?: string[];
}

export interface AmountValue {
    value: number;
    currency?: string;
}

// ---------------------------------------------------------------------------
// Full extraction result
// ---------------------------------------------------------------------------

export interface ExtractionResult {
    fields: {
        title: FieldResult<string>;
        store: FieldResult<string>;
        amount: FieldResult<AmountValue>;
        code: FieldResult<string>;
        expiryDate: FieldResult<string>; // YYYY-MM-DD
    };
    summary: {
        missingFieldCount: number;
        needsReviewFieldCount: number;
        issues: string[];
    };
    routingMeta: {
        used: 'offline' | 'llm' | 'hybrid';
        model?: string;
        latencyMs?: number;
    };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Confidence → numeric score for comparisons/routing. */
export function confidenceToScore(c: Confidence): number {
    switch (c) {
        case 'high': return 1.0;
        case 'medium': return 0.6;
        case 'low': return 0.3;
    }
}

/** Create an empty FieldResult (field not found). */
export function emptyField<T>(): FieldResult<T> {
    return { value: null, confidence: 'low', evidence: [], issues: [] };
}

// ---------------------------------------------------------------------------
// Backward-compat converter
// ---------------------------------------------------------------------------

/**
 * Convert an ExtractionResult to the existing GiftOrVoucherDraft interface.
 * The rest of the app (UI, DB, quality flags) continues using GiftOrVoucherDraft.
 */
export function toGiftOrVoucherDraft(
    result: ExtractionResult,
    sourceText: string,
    sourceType: SourceType = 'other',
): GiftOrVoucherDraft {
    const { fields, summary } = result;

    const assumptions: string[] = [];
    const inferredFields: (keyof GiftOrVoucherDraft)[] = [];
    const missingRequiredFields: (keyof GiftOrVoucherDraft)[] = [];

    // Amount
    let amount: number | undefined;
    let currency: string | undefined;
    if (fields.amount.value) {
        amount = fields.amount.value.value;
        currency = fields.amount.value.currency ?? 'ILS';
        if (fields.amount.confidence !== 'high') {
            inferredFields.push('amount');
            if (fields.amount.issues?.length) {
                assumptions.push(...fields.amount.issues);
            }
        }
    } else {
        missingRequiredFields.push('amount');
    }

    // Title / Merchant
    const title = fields.title.value ?? undefined;
    const merchant = fields.store.value ?? undefined;
    if (!title) {
        missingRequiredFields.push('title');
    }
    if (fields.title.confidence !== 'high') {
        inferredFields.push('title');
    }
    if (fields.store.confidence !== 'high' && merchant) {
        inferredFields.push('merchant');
    }

    // Code
    const code = fields.code.value ?? undefined;
    if (!code) {
        missingRequiredFields.push('code');
    }
    if (fields.code.confidence !== 'high' && code) {
        inferredFields.push('code');
        if (fields.code.issues?.length) {
            assumptions.push(...fields.code.issues);
        }
    }

    // Expiry
    const expirationDate = fields.expiryDate.value ?? undefined;
    if (!expirationDate) {
        missingRequiredFields.push('expirationDate');
    }
    if (fields.expiryDate.confidence !== 'high' && expirationDate) {
        inferredFields.push('expirationDate');
        if (fields.expiryDate.issues?.length) {
            assumptions.push(...fields.expiryDate.issues);
        }
    }

    // Add summary issues as assumptions
    for (const issue of summary.issues) {
        if (!assumptions.includes(issue)) {
            assumptions.push(issue);
        }
    }

    // Compute overall confidence (average of all field scores)
    const fieldScores = [
        confidenceToScore(fields.title.confidence),
        confidenceToScore(fields.store.confidence),
        confidenceToScore(fields.amount.confidence),
        confidenceToScore(fields.code.confidence),
        confidenceToScore(fields.expiryDate.confidence),
    ];
    const avgConfidence = fieldScores.reduce((a, b) => a + b, 0) / fieldScores.length;

    // Questions: ask for title if missing (matching existing behavior)
    const questions = missingRequiredFields.includes('title')
        ? [{ key: 'title' as keyof GiftOrVoucherDraft, questionText: 'איך נקרא לשובר או למתנה הזו?', inputType: 'text' as const }]
        : [];

    return {
        title,
        merchant,
        amount,
        currency,
        code,
        expirationDate,
        sourceType,
        sourceText,
        confidence: Math.round(avgConfidence * 100) / 100,
        assumptions,
        inferredFields,
        missingRequiredFields,
        questions,
    };
}

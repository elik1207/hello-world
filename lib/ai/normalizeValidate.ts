/**
 * lib/ai/normalizeValidate.ts
 *
 * Post-extraction validation and normalization layer.
 * Runs on BOTH offline and LLM results to ensure consistency.
 *
 * - Validates evidence ranges against original text
 * - Normalizes expiry dates to YYYY-MM-DD
 * - Validates amounts are reasonable
 * - Downgrades confidence and appends issues on failure (never crashes)
 */
import type { ExtractionResult, FieldResult, Evidence } from './extractionTypes';

// ---------------------------------------------------------------------------
// Individual validators
// ---------------------------------------------------------------------------

/** Validate that an evidence range exists within the original text bounds. */
export function validateEvidence(evidence: Evidence, originalText: string): string[] {
    const issues: string[] = [];

    if (evidence.start < 0) {
        issues.push('evidence_negative_start');
    }
    if (evidence.end > originalText.length) {
        issues.push('evidence_exceeds_text_length');
    }
    if (evidence.start >= evidence.end) {
        issues.push('evidence_empty_range');
    }

    // If text snippet is provided, verify it matches the actual text at that range
    if (evidence.text && evidence.start >= 0 && evidence.end <= originalText.length && evidence.start < evidence.end) {
        const actual = originalText.slice(evidence.start, evidence.end);
        if (actual !== evidence.text) {
            issues.push('evidence_text_mismatch');
        }
    }

    return issues;
}

/** Validate expiry date is YYYY-MM-DD and not in the deep past. */
export function validateExpiryDate(dateStr: string | null): string[] {
    if (!dateStr) return [];
    const issues: string[] = [];

    // Must match YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        issues.push('expiry_date_invalid_format');
        return issues;
    }

    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);

    // Validate the date is real (no overflow like Feb 30)
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
        issues.push('expiry_date_invalid_date');
    }

    // Warn if date is more than 1 year in the past
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    if (date < oneYearAgo) {
        issues.push('expiry_date_in_past');
    }

    return issues;
}

/** Validate amount is a positive reasonable number. */
export function validateAmount(amount: { value: number; currency?: string } | null): string[] {
    if (!amount) return [];
    const issues: string[] = [];

    if (!isFinite(amount.value) || isNaN(amount.value)) {
        issues.push('amount_not_finite');
    } else if (amount.value <= 0) {
        issues.push('amount_not_positive');
    } else if (amount.value > 100000) {
        issues.push('amount_unreasonably_large');
    }

    if (amount.currency && !['ILS', 'USD', 'EUR', 'GBP'].includes(amount.currency)) {
        issues.push('amount_unknown_currency');
    }

    return issues;
}

// ---------------------------------------------------------------------------
// Full result validation
// ---------------------------------------------------------------------------

/**
 * Validate and normalize a complete ExtractionResult.
 * Mutates nothing — returns a new ExtractionResult with issues appended
 * and confidence downgraded where validation fails.
 */
export function validateExtractionResult(
    result: ExtractionResult,
    originalText: string,
): ExtractionResult {
    const validated = JSON.parse(JSON.stringify(result));
    const summaryIssues = [...validated.summary.issues];

    // Validate all evidence ranges
    for (const fieldName of Object.keys(validated.fields) as (keyof typeof validated.fields)[]) {
        const field = validated.fields[fieldName] as FieldResult<any>;
        if (field.evidence) {
            for (const e of field.evidence) {
                const evIssues = validateEvidence(e, originalText);
                if (evIssues.length > 0) {
                    field.issues = [...(field.issues || []), ...evIssues];
                    field.confidence = 'low';
                    summaryIssues.push(`${String(fieldName)}: ${evIssues.join(', ')}`);
                }
            }
        }
    }

    // Validate expiry date value
    if (validated.fields.expiryDate.value) {
        const dateIssues = validateExpiryDate(validated.fields.expiryDate.value);
        if (dateIssues.length > 0) {
            validated.fields.expiryDate.issues = [
                ...(validated.fields.expiryDate.issues || []),
                ...dateIssues,
            ];
            if (dateIssues.includes('expiry_date_invalid_format') || dateIssues.includes('expiry_date_invalid_date')) {
                validated.fields.expiryDate.confidence = 'low';
            }
            summaryIssues.push(`expiryDate: ${dateIssues.join(', ')}`);
        }
    }

    // Validate amount value
    if (validated.fields.amount.value) {
        const amtIssues = validateAmount(validated.fields.amount.value);
        if (amtIssues.length > 0) {
            validated.fields.amount.issues = [
                ...(validated.fields.amount.issues || []),
                ...amtIssues,
            ];
            validated.fields.amount.confidence = 'low';
            summaryIssues.push(`amount: ${amtIssues.join(', ')}`);
        }
    }

    // Recompute summary counts
    const requiredFields: (keyof typeof validated.fields)[] = ['title', 'amount', 'code', 'expiryDate'];
    let missingFieldCount = 0;
    let needsReviewFieldCount = 0;

    for (const name of requiredFields) {
        const field = validated.fields[name] as FieldResult<any>;
        if (field.value === null) {
            missingFieldCount++;
        } else if (field.confidence !== 'high' || (field.issues && field.issues.length > 0)) {
            needsReviewFieldCount++;
        }
    }
    if (validated.fields.store.value !== null && validated.fields.store.confidence !== 'high') {
        needsReviewFieldCount++;
    }

    validated.summary = {
        missingFieldCount,
        needsReviewFieldCount,
        issues: summaryIssues,
    };

    return validated;
}

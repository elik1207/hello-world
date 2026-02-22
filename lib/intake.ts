/**
 * lib/intake.ts — Pure helpers for OS intake (Share/DeepLink/Clipboard).
 * No side-effects. No PII leakage.
 */

const MAX_LENGTH = 10_000;

// Strip zero-width chars, collapse whitespace, trim, limit length
export function normalizeIncomingText(text: string): string {
    return text
        .replace(/[\u200B-\u200D\uFEFF\u200E\u200F]/g, '') // zero-width chars
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+/g, ' ')          // collapse horizontal whitespace
        .replace(/\n{3,}/g, '\n\n')       // collapse excessive newlines
        .trim()
        .slice(0, MAX_LENGTH);
}

// --- Heuristics for candidate detection ---

const CURRENCY_RE = /₪|ש[״"']ח|NIS|ILS|\$|€|USD|EUR/i;
const AMOUNT_RE = /\d{1,6}([.,]\d{1,2})?/;
const EXPIRY_RE = /תוקף|valid\s*until|expires?|exp[:\s]|בתוקף\s*עד|\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/i;
const KEYWORD_RE = /שובר|קופון|gift\s*card|voucher|coupon|קוד\s*(הנחה|מתנה)|gift\s*code|promo\s*code/i;
const CODE_TOKEN_RE = /\b[A-Za-z0-9]{8,16}\b/;

export interface IntakeClassification {
    isCandidate: boolean;
    reasons: string[];
}

export function classifyIntake(text: string): IntakeClassification {
    const reasons: string[] = [];

    if (CURRENCY_RE.test(text) && AMOUNT_RE.test(text)) {
        reasons.push('amount_hint');
    }
    if (EXPIRY_RE.test(text)) {
        reasons.push('date_hint');
    }
    if (KEYWORD_RE.test(text)) {
        reasons.push('keyword_hint');
    }
    if (CODE_TOKEN_RE.test(text)) {
        reasons.push('code_token');
    }

    return {
        isCandidate: reasons.length >= 1,
        reasons,
    };
}

// --- Safe analytics metadata (NO PII, NO raw text) ---

function lengthBucket(len: number): string {
    if (len < 50) return '<50';
    if (len < 200) return '50-200';
    if (len < 500) return '200-500';
    if (len < 2000) return '500-2k';
    return '2k+';
}

export interface IntakeSafeMeta {
    source: string;
    lengthBucket: string;
    hasAmountHint: boolean;
    hasDateHint: boolean;
    hasKeywordHint: boolean;
    [key: string]: string | number | boolean | undefined;
}

export function getSafeAnalyticsMeta(text: string, source: string): IntakeSafeMeta {
    const classification = classifyIntake(text);
    return {
        source,
        lengthBucket: lengthBucket(text.length),
        hasAmountHint: classification.reasons.includes('amount_hint'),
        hasDateHint: classification.reasons.includes('date_hint'),
        hasKeywordHint: classification.reasons.includes('keyword_hint'),
    };
}

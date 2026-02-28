/**
 * lib/ai/extractWithEvidence.ts
 *
 * Evidence-enriched offline extraction. Uses the same regex/heuristics as
 * extractGiftFromText but captures evidence ranges, per-field confidence,
 * and per-field issues.
 *
 * The original extractGiftFromText is NOT modified — this is a new function
 * that runs alongside it.
 */
import type { SourceType } from '../types';
import type {
    ExtractionResult,
    FieldResult,
    Evidence,
    Confidence,
    AmountValue,
} from './extractionTypes';
import { emptyField } from './extractionTypes';

// ---------------------------------------------------------------------------
// Merchant dictionary (same as extractGiftFromText.ts)
// ---------------------------------------------------------------------------
const MERCHANTS = [
    { name: 'Fox', regex: /(fox|פוקס|foxhome|פוקס הום)/i },
    { name: 'Shufersal', regex: /(shufersal|שופרסל|שופר סל)/i },
    { name: 'Super-Pharm', regex: /(super-pharm|סופר-פארם|סופרפארם|superpharm)/i },
    { name: 'Renuar', regex: /(renuar|רנואר)/i },
    { name: 'Castro', regex: /(castro|קסטרו)/i },
    { name: 'Zara', regex: /(zara|זארא|זארה)/i },
    { name: 'H&M', regex: /(h&m|h.m|h m|אייץ' אנד אם)/i },
    { name: 'Terminal X', regex: /(terminal x|טרמינל איקס|טרמינל x)/i },
    { name: 'Wolt', regex: /(wolt|וולט)/i },
    { name: 'BuyMe', regex: /(buy me|buyme|ביימי|ביי מי)/i },
    { name: 'Nofeshit', regex: /(nofeshit|נופשונית|נופשית)/i },
    { name: 'Steimatzky', regex: /(steimatzky|סטימצקי)/i },
    { name: 'Tzomet Sfarim', regex: /(tzomet sfarim|צומת ספרים)/i },
    { name: 'KSP', regex: /(ksp|קיי אס פי)/i },
];

// ---------------------------------------------------------------------------
// Date parser (same logic as extractGiftFromText.ts)
// ---------------------------------------------------------------------------
function parseDateString(dateStr: string): { date: Date; formatUsed: string } | null {
    const clean = dateStr.replace(/[.\-]/g, '/');
    const parts = clean.split('/');
    if (parts.length !== 3) return null;

    let day: number, month: number, year: number;
    let formatUsed = '';
    const delimiter = dateStr.includes('-') ? '-' : dateStr.includes('.') ? '.' : '/';

    if (parts[0].length === 4) {
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10) - 1;
        day = parseInt(parts[2], 10);
        formatUsed = `YYYY${delimiter}MM${delimiter}DD`;
    } else {
        day = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10) - 1;
        year = parseInt(parts[2], 10);
        if (year < 100) {
            year += 2000;
            formatUsed = `DD${delimiter}MM${delimiter}YY`;
        } else {
            formatUsed = `DD${delimiter}MM${delimiter}YYYY`;
        }
    }

    const d = new Date(year, month, day);
    if (d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) {
        return { date: d, formatUsed };
    }
    return null;
}

/** Format a Date as YYYY-MM-DD. */
function toYYYYMMDD(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
}

/** Build an Evidence object. */
function ev(start: number, end: number, text: string, rule: string): Evidence {
    return { start, end, text, source: 'offline', rule };
}

// ---------------------------------------------------------------------------
// Main extraction function
// ---------------------------------------------------------------------------

export function extractWithEvidence(
    text: string,
    sourceType: SourceType = 'other',
): ExtractionResult {
    const allIssues: string[] = [];

    // --- Amount ---
    const amountField = extractAmount(text, allIssues);

    // --- Store / Title ---
    const storeField = extractStore(text);
    const titleField = deriveTitleFromStore(storeField);

    // --- Code ---
    const codeField = extractCode(text, allIssues);

    // --- Expiry Date ---
    const expiryField = extractExpiryDate(text, allIssues);

    // --- Summary ---
    const requiredFields: { name: string; field: FieldResult<any> }[] = [
        { name: 'title', field: titleField },
        { name: 'amount', field: amountField },
        { name: 'code', field: codeField },
        { name: 'expiryDate', field: expiryField },
    ];

    let missingFieldCount = 0;
    let needsReviewFieldCount = 0;

    for (const { field } of requiredFields) {
        if (field.value === null) {
            missingFieldCount++;
        } else if (field.confidence !== 'high' || (field.issues && field.issues.length > 0)) {
            needsReviewFieldCount++;
        }
    }
    // Store is optional, but if present and low confidence, flag it
    if (storeField.value !== null && storeField.confidence !== 'high') {
        needsReviewFieldCount++;
    }

    return {
        fields: {
            title: titleField,
            store: storeField,
            amount: amountField,
            code: codeField,
            expiryDate: expiryField,
        },
        summary: {
            missingFieldCount,
            needsReviewFieldCount,
            issues: allIssues,
        },
        routingMeta: { used: 'offline' },
    };
}

// ---------------------------------------------------------------------------
// Field extractors
// ---------------------------------------------------------------------------

function extractAmount(text: string, issues: string[]): FieldResult<AmountValue> {
    // Priority 1: Currency symbol + number or number + currency symbol
    const amountRegex = /(?:₪|\$|€|ש"ח|שח|ILS|USD|EUR)\s*(\d+(?:,\d{3})*(?:\.\d+)?)|(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:₪|\$|€|ש"ח|שח|ILS|USD|EUR)/ig;
    const amountMatches = [...text.matchAll(amountRegex)];

    if (amountMatches.length > 0) {
        if (amountMatches.length > 1) {
            issues.push('multiple_amounts_found');
        }

        const match = amountMatches[0];
        const amountStr = match[1] || match[2];
        const amount = parseFloat(amountStr.replace(/,/g, ''));

        if (!isNaN(amount)) {
            const fullMatch = match[0].toUpperCase();
            let currency = 'ILS';
            let currIssue: string | undefined;

            if (fullMatch.includes('$') || fullMatch.includes('USD')) {
                currency = 'USD';
            } else if (fullMatch.includes('€') || fullMatch.includes('EUR')) {
                currency = 'EUR';
            } else {
                currIssue = 'Detected local currency indicator, set to ILS.';
            }

            const evidence: Evidence[] = [
                ev(match.index!, match.index! + match[0].length, match[0], 'amount_with_currency'),
            ];
            const fieldIssues: string[] = [];
            if (currIssue) fieldIssues.push(currIssue);

            return {
                value: { value: amount, currency },
                confidence: 'high',
                evidence,
                issues: fieldIssues,
            };
        }
    }

    // Priority 2: Standalone round numbers (heuristic)
    const floatRegex = /\b(50|100|150|200|250|300|400|500|1000)\b/g;
    const potentialAmounts = [...text.matchAll(floatRegex)];

    if (potentialAmounts.length > 0) {
        const match = potentialAmounts[0];
        const amount = parseInt(match[1], 10);

        issues.push('amount_inferred_no_currency');

        return {
            value: { value: amount, currency: 'ILS' },
            confidence: 'medium',
            evidence: [ev(match.index!, match.index! + match[0].length, match[0], 'amount_standalone_number')],
            issues: [`Found number ${amount} without currency, assumed ILS amount.`],
        };
    }

    return emptyField<AmountValue>();
}

function extractStore(text: string): FieldResult<string> {
    for (const merchant of MERCHANTS) {
        const match = text.match(merchant.regex);
        if (match && match.index !== undefined) {
            return {
                value: merchant.name,
                confidence: 'high',
                evidence: [ev(match.index, match.index + match[0].length, match[0], `merchant_${merchant.name.toLowerCase()}`)],
                issues: [],
            };
        }
    }
    return emptyField<string>();
}

function deriveTitleFromStore(storeField: FieldResult<string>): FieldResult<string> {
    if (storeField.value) {
        return {
            value: `${storeField.value} Voucher`,
            confidence: storeField.confidence,
            evidence: storeField.evidence,
            issues: [],
        };
    }
    return emptyField<string>();
}

function extractCode(text: string, issues: string[]): FieldResult<string> {
    // Priority 0: Multiline pattern — Hebrew keyword phrase followed by code on next line
    // Handles messages like:
    //   "את קוד שובר BuyMe\n9376-1193-5341-4936"
    const multilineCodeRegex = /(?:קוד שובר|מספר שובר|קוד קופון|קוד הטבה|קוד)[\s\S]*?\n\s*(\d{4}[\-\s]\d{4}[\-\s]\d{4}[\-\s]\d{4})/i;
    const multilineMatch = text.match(multilineCodeRegex);

    if (multilineMatch && multilineMatch[1] && multilineMatch.index !== undefined) {
        const code = multilineMatch[1].replace(/\s/g, '-').trim();
        const codeStart = multilineMatch.index + multilineMatch[0].length - multilineMatch[1].length;
        const codeEnd = codeStart + multilineMatch[1].length;

        return {
            value: code,
            confidence: 'high',
            evidence: [ev(codeStart, codeEnd, multilineMatch[1], 'code_multiline_hebrew')],
            issues: [],
        };
    }

    // Priority 1: Code with keyword indicator on the SAME line
    const codeIndicatorRegex = /(?:code|קוד|קופון|מספר שובר|שובר|voucher)[\s:]*([A-Za-z0-9-]{4,25})/i;
    const codeMatch = text.match(codeIndicatorRegex);

    if (codeMatch && codeMatch[1] && codeMatch.index !== undefined) {
        const potentialCode = codeMatch[1].trim();
        const codeStart = codeMatch.index + codeMatch[0].length - potentialCode.length;
        const codeEnd = codeStart + potentialCode.length;

        if (/\d/.test(potentialCode) && potentialCode.length >= 4) {
            return {
                value: potentialCode,
                confidence: 'high',
                evidence: [ev(codeStart, codeEnd, potentialCode, 'code_with_indicator')],
                issues: [],
            };
        } else if (potentialCode.length >= 4) {
            issues.push('code_no_digits');
            return {
                value: potentialCode,
                confidence: 'low',
                evidence: [ev(codeStart, codeEnd, potentialCode, 'code_with_indicator_suspicious')],
                issues: ['Code looks suspicious (no digits), marked for review.'],
            };
        }
    }

    // Priority 2: Isolated dash-separated code patterns (e.g., 9376-1193-5341-4936)
    const dashCodeRegex = /\b(\d{4}[\-]\d{4}[\-]\d{4}[\-]\d{4})\b/g;
    const dashMatches = [...text.matchAll(dashCodeRegex)];

    if (dashMatches.length > 0) {
        const match = dashMatches[0];
        return {
            value: match[1],
            confidence: 'high',
            evidence: [ev(match.index!, match.index! + match[0].length, match[0], 'code_dash_pattern')],
            issues: [],
        };
    }

    // Priority 3: Other isolated code-like strings
    const isolatedCodeRegex = /[A-Z0-9]{2,}(?:-[A-Z0-9]{2,}){1,}/g;
    const isolatedMatches = [...text.matchAll(isolatedCodeRegex)];

    if (isolatedMatches.length > 0) {
        const validCodes = isolatedMatches.filter(m => {
            const isDate = /\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/.test(m[0]);
            const isPhoneOrPureMath = /^[\d-]+$/.test(m[0]) && m[0].length < 15;
            return m[0].length >= 6 && !isDate && !isPhoneOrPureMath;
        });

        if (validCodes.length > 0) {
            const match = validCodes[0];
            const isSuspicious = !/\d/.test(match[0]) || match[0].length < 6;
            const confidence: Confidence = isSuspicious ? 'low' : 'medium';

            return {
                value: match[0],
                confidence,
                evidence: [ev(match.index!, match.index! + match[0].length, match[0], 'code_isolated_string')],
                issues: [`Found isolated string '${match[0]}', assuming it's the code.`],
            };
        }
    }

    return emptyField<string>();
}

function extractExpiryDate(text: string, issues: string[]): FieldResult<string> {
    const dateRegex = /\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})\b|\b(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})\b/g;
    const dateMatches = [...text.matchAll(dateRegex)];

    // Priority 1: Contextual Hebrew date keywords
    const hebrewDateContextRegex = /(?:בתוקף עד|תוקף:|עד תאריך|עד ה-)\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i;
    const ctxMatch = text.match(hebrewDateContextRegex);

    if (ctxMatch && ctxMatch[1] && ctxMatch.index !== undefined) {
        const parsed = parseDateString(ctxMatch[1]);
        if (parsed) {
            const dateStart = ctxMatch.index + ctxMatch[0].length - ctxMatch[1].length;
            return {
                value: toYYYYMMDD(parsed.date),
                confidence: 'high',
                evidence: [ev(dateStart, dateStart + ctxMatch[1].length, ctxMatch[1], 'date_hebrew_context')],
                issues: [`Assumed date format ${parsed.formatUsed} for ${ctxMatch[1]}`],
            };
        }
    }

    // Priority 2: Raw date patterns
    if (dateMatches.length > 0) {
        if (dateMatches.length > 1) {
            issues.push('multiple_dates_found');
        }

        let latestDate: Date | null = null;
        let latestFormat = '';
        let latestMatch: RegExpMatchArray | null = null;

        for (const m of dateMatches) {
            const parsed = parseDateString(m[0]);
            if (parsed && (!latestDate || parsed.date > latestDate)) {
                latestDate = parsed.date;
                latestFormat = parsed.formatUsed;
                latestMatch = m;
            }
        }

        if (latestDate && latestMatch) {
            return {
                value: toYYYYMMDD(latestDate),
                confidence: 'medium',
                evidence: [ev(latestMatch.index!, latestMatch.index! + latestMatch[0].length, latestMatch[0], 'date_raw_pattern')],
                issues: [`Assumed date format ${latestFormat} for ${latestMatch[0]}`],
            };
        }
    }

    return emptyField<string>();
}

import { GiftOrVoucherDraft, SourceType, ClarificationQuestion } from '../types';

/**
 * Common Israeli merchants patterns
 */
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

/**
 * Extracts a structured draft from raw text using offline regex/heuristics.
 */
export function extractGiftFromText(text: string, sourceType: SourceType = 'other'): GiftOrVoucherDraft {
    const draft: Partial<GiftOrVoucherDraft> = {
        sourceType,
        sourceText: text,
        assumptions: [],
        missingRequiredFields: [],
        questions: [],
    };

    let confidencePoints = 0;
    const maxConfidencePoints = 4; // Title/Merchant, Amount, Code, Date

    // 1. Detect Amount & Currency
    // HEURISTIC: Look for ILS (₪, ש"ח, שח) or standard currency signs ($ €) next to numbers
    const amountRegex = /(?:₪|\$|€|ש"ח|שח|ILS|USD|EUR)\s*(\d+(?:,\d{3})*(?:\.\d+)?)|(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:₪|\$|€|ש"ח|שח|ILS|USD|EUR)/ig;
    const amountMatches = [...text.matchAll(amountRegex)];

    if (amountMatches.length > 0) {
        // Take the first match
        const match = amountMatches[0];
        const amountStr = match[1] || match[2];
        const amount = parseFloat(amountStr.replace(/,/g, ''));
        if (!isNaN(amount)) {
            draft.amount = amount;
            confidencePoints++;

            // Determine currency
            const fullMatch = match[0].toUpperCase();
            if (fullMatch.includes('$') || fullMatch.includes('USD')) {
                draft.currency = 'USD';
            } else if (fullMatch.includes('€') || fullMatch.includes('EUR')) {
                draft.currency = 'EUR';
            } else {
                draft.currency = 'ILS';
                draft.assumptions!.push("Detected local currency indicator, set to ILS.");
            }
        }
    } else {
        // HEURISTIC: Look for just a standalone number that might imply round tens/hundreds of shekels common in vouchers
        const floatRegex = /\b(50|100|150|200|250|300|400|500|1000)\b/g;
        const potentialAmounts = text.match(floatRegex);
        if (potentialAmounts) {
            draft.amount = parseInt(potentialAmounts[0], 10);
            draft.currency = 'ILS';
            draft.assumptions!.push(`Found number ${draft.amount} without currency, assumed ILS amount.`);
            confidencePoints += 0.5;
        }
    }

    // 2. Detect Merchant / Title
    // HEURISTIC: Iterate through a predefined list of the most popular Israeli merchants
    for (const merchant of MERCHANTS) {
        if (merchant.regex.test(text)) {
            draft.merchant = merchant.name;
            draft.title = `${merchant.name} Voucher`;
            confidencePoints++;
            break; // Stop at first found
        }
    }

    // 3. Detect Code
    // HEURISTIC: Look for strong contextual keywords like "Code:", "קוד:", "קופון:" followed immediately by alphanumeric strings
    const codeIndicatorRegex = /(?:code|קוד|קופון|מספר שובר|שובר|voucher)[\s:]*([A-Z0-9-]{4,20})/i;
    const codeMatch = text.match(codeIndicatorRegex);
    if (codeMatch && codeMatch[1]) {
        draft.code = codeMatch[1].trim();
        confidencePoints++;
    } else {
        // ASSUMPTION: Fallback: look for isolated all-caps alphanumeric strings (e.g., A7B-99-XZ) which represent codes 90% of the time
        const isolatedCodeRegex = /\b([A-Z0-9]{4,}(?:-[A-Z0-9]{4,})*)\b/g;
        const isolatedMatches = text.match(isolatedCodeRegex);
        if (isolatedMatches) {
            // Filter out things that look like dates or amounts or standard words
            const validCodes = isolatedMatches.filter(m => !/^\d+$/.test(m) && m.length > 4);
            if (validCodes.length > 0) {
                draft.code = validCodes[0];
                draft.assumptions!.push(`Found isolated string '${validCodes[0]}', assuming it's the code.`);
                confidencePoints += 0.5;
            }
        }
    }

    // 4. Detect Expiration Date
    // dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy, yyyy-mm-dd
    const dateRegex = /\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})\b|\b(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})\b/g;
    const dateMatches = [...text.matchAll(dateRegex)];

    // Also look for textual Israeli hints: "תוקף עד", "בתוקף עד"
    const hebrewDateContextRegex = /(?:בתוקף עד|תוקף:|עד תאריך|עד ה-)\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i;
    const textContextDate = text.match(hebrewDateContextRegex);

    if (textContextDate && textContextDate[1]) {
        const parsedContextDate = parseDateString(textContextDate[1]);
        if (parsedContextDate) {
            draft.expirationDate = parsedContextDate.date.toISOString();
            confidencePoints++;
            draft.assumptions!.push(`Assumed date format ${parsedContextDate.formatUsed} for ${textContextDate[1]}`);
        }
    } else if (dateMatches.length > 0) {
        // Take the latest date found to be safe, or just the first one if ambiguous
        let latestDate: Date | null = null;
        let latestFormat = '';
        let originalString = '';

        for (const m of dateMatches) {
            const parsed = parseDateString(m[0]);
            if (parsed && (!latestDate || parsed.date > latestDate)) {
                latestDate = parsed.date;
                latestFormat = parsed.formatUsed;
                originalString = m[0];
            }
        }

        if (latestDate) {
            draft.expirationDate = latestDate.toISOString();
            // ASSUMPTION: Explicitly record ambiguous date interpretation 
            draft.assumptions!.push(`Assumed date format ${latestFormat} for ${originalString}`);
            confidencePoints += 0.5; // Contextless dates have slightly lower confidence
        }
    }

    // Wrap Up Title and Missing Fields
    // HEURISTIC: If title (the only strictly required field) is missing, generate exactly ONE question to prompt the user
    if (!draft.title) {
        // If merchant exists, we used it for title. If not:
        draft.missingRequiredFields!.push('title');
        draft.questions!.push({
            key: 'title',
            questionText: "איך נקרא לשובר או למתנה הזו?",
            inputType: 'text'
        });
    }

    // Calculate confidence
    draft.confidence = Math.min(confidencePoints / maxConfidencePoints, 1.0);

    return draft as GiftOrVoucherDraft;
}

/**
 * Helper to parse various date formats into a Date object safely and return the format used.
 */
function parseDateString(dateStr: string): { date: Date, formatUsed: string } | null {
    // Replace dots and dashes with slashes for uniform processing
    let clean = dateStr.replace(/[\.\-]/g, '/');
    const parts = clean.split('/');

    if (parts.length !== 3) return null;

    let day, month, year;
    let formatUsed = '';
    const delimiter = dateStr.includes('-') ? '-' : dateStr.includes('.') ? '.' : '/';

    // Check if YYYY/MM/DD
    if (parts[0].length === 4) {
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10) - 1; // JS months are 0-based
        day = parseInt(parts[2], 10);
        formatUsed = `YYYY${delimiter}MM${delimiter}DD`;
    } else {
        // Assume DD/MM/YYYY or DD/MM/YY
        day = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10) - 1;
        year = parseInt(parts[2], 10);
        if (year < 100) {
            year += 2000; // Assume 2000s for 2-digit years
            formatUsed = `DD${delimiter}MM${delimiter}YY`;
        } else {
            formatUsed = `DD${delimiter}MM${delimiter}YYYY`;
        }
    }

    const d = new Date(year, month, day);
    // Validate parsing didn't overflow (e.g. Feb 30 -> Mar 2)
    if (d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) {
        return { date: d, formatUsed };
    }
    return null;
}

// ----------------------------------------------------------------------
// EXAMPLES TEST DATA (Demonstration Cases for Offline Regex Parsing)
// ----------------------------------------------------------------------
/*
const testCases = [
    {
        desc: "WhatsApp-like message with amount + code + expiry",
        text: "היי! הנה קופון ₪200 לרנואר שקניתי לך. בתוקף עד 31/12/2026. קוד: RNR-2026-XQ5",
        // Expected: amount=200, currency=ILS, merchant=Renuar, code=RNR-2026-XQ5, date=2026-12-31, No Questions.
    },
    {
        desc: "SMS-like message with only code (missing title triggers 1 question)",
        text: "Your voucher: XZ9-99P-3A.",
        // Expected: code=XZ9-99P-3A, missingRequiredFields=['title'], questions.length=1
    },
    {
        desc: "Message with ambiguous date (do not ask unless required; add assumption)",
        text: "Gift 200. enjoy! 05-04-2025.",
        // Expected: amount=200, currency=ILS (assumed), date=2025-04-05, missingRequiredFields=['title'], questions.length=1
    }
];

// To run:
// testCases.forEach(tc => {
//     console.log(`\n--- Test: ${tc.desc} ---`);
//     const draft = extractGiftFromText(tc.text, 'whatsapp');
//     console.log(JSON.stringify(draft, null, 2));
// });
*/

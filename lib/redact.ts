/**
 * Redaction Layer for PII and Sensitive Data
 * Ensures raw text from SMS/WhatsApp does not leak phone numbers or full voucher codes to the LLM.
 */

/**
 * Masks Israeli phone numbers.
 * Example: "054-1234567" -> "***-****567"
 * Example: "0501234567" -> "***-****567"
 */
export function redactPhoneNumbers(text: string): string {
    // Matches 05X-XXXXXXX, 05X XXXXXXX, 05XXXXXXX
    const phoneRegex = /\b(05\d)[\s\-]?(\d{3})[\s\-]?(\d{4})\b/g;
    return text.replace(phoneRegex, '***-****$3');
}

/**
 * Masks likely voucher codes, leaving only the last 3-4 characters visible for identification.
 * This is an aggressive heuristic to prevent leaking codes to 3rd party LLMs.
 * Example: "XJ9-99B-8Q" -> "***-***-*8Q"
 * Example: "KSP-12345" -> "***-**345"
 */
export function redactVoucherCodes(text: string): string {
    // Matches sequences of alphanumeric characters with dashes
    // E.g. A1B2-C3D4, XZ-1234-9A
    const codeRegex = /\b([A-Z0-9]{2,}(?:-[A-Z0-9]{2,})+)\b/ig;

    return text.replace(codeRegex, (match) => {
        // If it looks like a date, skip it
        const isDate = /\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/.test(match);
        if (isDate) return match;

        // Keep the last 3 characters if it's long enough, otherwise just redact all
        if (match.length > 5) {
            const prefix = match.slice(0, match.length - 3);
            const suffix = match.slice(match.length - 3);
            // Replace alphanumeric chars in prefix with '*', keep dashes
            const maskedPrefix = prefix.replace(/[A-Z0-9]/ig, '*');
            return maskedPrefix + suffix;
        }

        return match.replace(/[A-Z0-9]/ig, '*');
    });
}

/**
 * Convenience method to apply all PII masks.
 */
export function redactPII(text: string): string {
    if (!text) return text;
    let safeText = redactPhoneNumbers(text);
    safeText = redactVoucherCodes(safeText);
    return safeText;
}

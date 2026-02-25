import OpenAI from 'openai';
import { z } from 'zod';
import type { SourceType } from '../../lib/types';
import type { ExtractionResult } from '../../lib/ai/extractionTypes';
import { extractWithEvidence } from '../../lib/ai/extractWithEvidence';
import { validateExtractionResult } from '../../lib/ai/normalizeValidate';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || '',
});

// Phase AI-10 Structure: Schema enforces that LLM returns per-field objects with value+evidence
const FieldResultSchema = <T extends z.ZodTypeAny>(valueType: T) => z.object({
    value: valueType.nullable(),
    evidenceSnippet: z.string().optional().describe('The exact text snippet from the raw message that proves this value. Must be a precise substring.'),
});

const AmountValueSchema = z.object({
    value: z.number(),
    currency: z.string().optional()
});

export const ExpectedResponseSchema = z.object({
    isVoucher: z.boolean().describe('True if the text is a gift card, coupon, or voucher. False otherwise.'),
    fields: z.object({
        title: FieldResultSchema(z.string()),
        store: FieldResultSchema(z.string()),
        amount: FieldResultSchema(AmountValueSchema),
        code: FieldResultSchema(z.string()),
        expiryDate: FieldResultSchema(z.string().describe('Must be YYYY-MM-DD')),
    }).optional()
});

export async function extractWithLlm(text: string, sourceType: SourceType): Promise<ExtractionResult | null> {
    const model = process.env.AI_MODEL || 'gpt-4o-mini';
    const timeoutMs = parseInt(process.env.AI_TIMEOUT_MS || '8000', 10);

    const systemPrompt = `
You are an extraction engine for an Israeli Coupon/Gift Card Wallet app.
Extract all structured data strictly matching the requested JSON schema.

CRITICAL RULES:
1. ONLY return a raw JSON object. Do not include markdown codeblocks (no \`\`\`json).
2. Set "isVoucher" to false if the message is NOT a gift card, coupon, store credit, or voucher (e.g. personal chat, news, flight tickets, tracking numbers).
3. For every field extracted, you MUST provide an "evidenceSnippet". This must be an EXACT literal substring from the Raw Text proving the value. Do not paraphrase.
4. Currencies should be ISO codes (e.g. ₪ = "ILS", $ = "USD", € = "EUR"). Default to ILS if none found.
5. Expiration dates MUST be formatted exactly as YYYY-MM-DD.
6. Make logical inferences if necessary (e.g. guessing the Store name from the context or determining the Title), but the evidenceSnippet should reflect the text that led to your inference.
`;


    const userPrompt = `
Source Type: ${sourceType}
Raw Text: ${text}
`;

    const maxAttempts = 2; // 1 initial attempt + 1 retry

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        // Abort controller for safe timeout handling per attempt
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await openai.chat.completions.create({
                model: model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                response_format: { type: 'json_object' },
                temperature: 0.1, // Near-deterministic outputs
            }, {
                signal: controller.signal
            });

            clearTimeout(timeout);

            const content = response.choices[0]?.message?.content;
            if (!content) {
                throw new Error('LLM returned empty response.');
            }

            // Zod validation strictly enforces the Phase 1 Output schema. Allow it to throw.
            const parsedJson = JSON.parse(content);

            // Explicit Non-voucher check
            if (parsedJson === null || parsedJson.isVoucher === false) {
                return null;
            }

            const validated = ExpectedResponseSchema.parse(parsedJson);
            if (!validated.fields) return null;

            // Helper to map LLM snippet to exact start/end positions in source text
            const mapEvidence = (snippet?: string): any[] => {
                if (!snippet) return [];
                const start = text.indexOf(snippet);
                if (start === -1) return []; // Snippet hallucinated
                return [{ start, end: start + snippet.length, text: snippet, source: 'llm' }];
            };

            const mapField = (f: any) => ({
                value: f.value ?? null,
                confidence: f.value ? 'high' as const : 'low' as const, // LLM outputs start as high confidence if present
                evidence: mapEvidence(f.evidenceSnippet),
                issues: []
            });

            const rawResult: ExtractionResult = {
                fields: {
                    title: mapField(validated.fields.title),
                    store: mapField(validated.fields.store),
                    amount: mapField(validated.fields.amount),
                    code: mapField(validated.fields.code),
                    expiryDate: mapField(validated.fields.expiryDate)
                },
                summary: { missingFieldCount: 0, needsReviewFieldCount: 0, issues: [] },
                routingMeta: { used: 'llm' }
            };

            // Run strict validation layer — this will downgrade hallucinated evidence or bad dates/amounts to low confidence
            return validateExtractionResult(rawResult, text);

        } catch (e: any) {
            clearTimeout(timeout);
            console.warn(`[LLM Attempt ${attempt}] Failed: ${e.message}`);

            if (attempt === maxAttempts) {
                console.warn(`LLM Extraction fully failed, falling back to offline regex. Error: ${e.message}`);
                // Fallback to purely offline engine
                const offline = extractWithEvidence(text, sourceType);
                const validated = validateExtractionResult(offline, text);
                validated.routingMeta.used = 'hybrid'; // indicate we tried LLM but fell back
                return validated;
            }
        }
    }

    return null;
}


import OpenAI from 'openai';
import { z } from 'zod';
import type { GiftOrVoucherDraft, ClarificationQuestion, SourceType } from '../../lib/types';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.AI_API_KEY || '',
});

// Reuse identical logical shape to ensure the frontend doesn't break
export const ExpectedResponseSchema = z.object({
    title: z.string().optional(),
    merchant: z.string().optional(),
    amount: z.string().or(z.number()).optional()
        .transform(val => typeof val === 'string' ? parseFloat(val) : val),
    currency: z.string().optional(),
    code: z.string().optional(),
    expirationDate: z.string().optional(),
    sourceType: z.enum(['whatsapp', 'sms', 'manual', 'other']).default('other'),
    sourceText: z.string(),
    notes: z.string().optional(),
    confidence: z.number().min(0).max(1),
    assumptions: z.array(z.string()),
    missingRequiredFields: z.array(z.enum([
        'title', 'merchant', 'amount', 'currency', 'code', 'expirationDate',
        'sourceType', 'sourceText', 'notes', 'confidence', 'assumptions',
        'missingRequiredFields', 'questions'
    ])),
    questions: z.array(z.object({
        key: z.enum([
            'title', 'merchant', 'amount', 'currency', 'code', 'expirationDate',
            'sourceType', 'sourceText', 'notes', 'confidence', 'assumptions',
            'missingRequiredFields', 'questions'
        ]),
        questionText: z.string(),
        inputType: z.enum(['text', 'number', 'date'])
    }))
});

export async function extractWithLlm(text: string, sourceType: SourceType): Promise<GiftOrVoucherDraft> {
    const model = process.env.AI_MODEL || 'gpt-4o-mini';
    const timeoutMs = parseInt(process.env.AI_TIMEOUT_MS || '8000', 10);
    const maxQuestions = parseInt(process.env.AI_MAX_QUESTIONS || '1', 10);

    const systemPrompt = `
You are a deterministic parsing engine for an Israeli Coupon/Gift Card Wallet app.
Extract all structured data from the user's raw message strictly as a JSON object matching the requested schema.

RULES:
1. ONLY return a raw JSON object. Do not include markdown codeblocks (no \`\`\`json).
2. Currencies should be ISO codes (e.g. ₪ = "ILS", $ = "USD", € = "EUR"). Default to ILS if none found.
3. Expiration dates MUST be formatted as ISO 8601 strings (e.g. 2026-12-31T22:00:00.000Z).
4. If any key fields (title, amount, code, expirationDate) cannot be determined, append their keys to the "missingRequiredFields" array.
5. IF AND ONLY IF "title" is missing, generate exactly ${maxQuestions} question(s) in Hebrew asking the user to provide the title.
   Example: "איך נקרא לשובר או למתנה הזו?"
   Never ask questions for optional fields (like amount, code, or date).
6. State any deductions logically in the "assumptions" array in English.
7. Return a "confidence" float between 0.0 and 1.0 reflecting your extraction certainty.
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

            // Zod validation strictly enforces the Phase 1 Output schema
            const parsedJson = JSON.parse(content);
            const validated = ExpectedResponseSchema.parse(parsedJson);

            // Map to exact required interface
            return {
                title: validated.title,
                merchant: validated.merchant,
                amount: validated.amount,
                currency: validated.currency,
                code: validated.code,
                expirationDate: validated.expirationDate,
                sourceType: sourceType,
                sourceText: text, // Echo back exactly
                notes: validated.notes,
                confidence: validated.confidence,
                assumptions: validated.assumptions,
                missingRequiredFields: validated.missingRequiredFields || [],
                questions: validated.questions || [],
            };

        } catch (e: any) {
            clearTimeout(timeout);
            console.warn(`[LLM Attempt ${attempt}] Failed: ${e.message}`);

            if (attempt === maxAttempts) {
                // Throw out of loop on final failure so the backend catches and falls back to regex
                throw new Error(`LLM Extraction Failed after ${maxAttempts} attempts: ${e.message}`);
            }
        }
    }

    throw new Error('LLM Extraction Failed: Unexpected execution path.');
}

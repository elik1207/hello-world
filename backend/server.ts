import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
// Import deterministic algorithm
import { extractGiftFromText } from '../lib/ai/extractGiftFromText';
// Import optional LLM algorithm
import { extractWithLlm, ExpectedResponseSchema } from './llm/extractWithLlm';
import type { SourceType } from '../lib/types';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middleware
app.use(cors());
app.use(express.json());

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: { error: 'Too many extraction requests, please try again later.' }
});
app.use('/ai/', apiLimiter);

// Zod schema for request validation
const extractRequestSchema = z.object({
    sourceText: z.string().min(1, 'Source text is required'),
    sourceType: z.enum(['whatsapp', 'sms', 'manual', 'other']).default('other'),
});

app.post('/ai/extract', async (req, res) => {
    // 1. Privacy logging (do not log explicit source texts)
    const requestId = Math.random().toString(36).substring(7);
    if (process.env.AI_LOG_LEVEL === 'info') {
        console.log(`[REQ ${requestId}] Extracting text (length: ${req.body.sourceText?.length}) via ${process.env.AI_PROVIDER || 'deterministic'}`);
    }

    try {
        // Validate request body
        const parsedBody = extractRequestSchema.parse(req.body);
        const { sourceText, sourceType } = parsedBody;

        let draft;

        // 2. Hybrid Provider Execution
        if (process.env.AI_PROVIDER === 'llm') {
            try {
                // Attempt OpenAI extraction strictly
                draft = await extractWithLlm(sourceText, sourceType as SourceType);
            } catch (llmError: any) {
                console.warn(`[REQ ${requestId}] LLM failed (${llmError.message}). Falling back to deterministic regex.`);
                // Fallback deterministic execution
                draft = extractGiftFromText(sourceText, sourceType as SourceType);
                draft.assumptions!.push("LLM output invalid or timed out; fell back to deterministic parsing.");
            }
        } else {
            // Standard Deterministic Shared Parser
            draft = extractGiftFromText(sourceText, sourceType as SourceType);
        }

        // 3. Strict Unified Validation (Applies to deterministic parser as well)
        let validatedDraft;
        try {
            validatedDraft = ExpectedResponseSchema.parse(draft);
        } catch (validationError) {
            console.error(`[REQ ${requestId}] Output Validation Error:`, validationError);
            return res.status(500).json({ error: 'Internal server error: Output validation failed. The parser returned an invalid schema.' });
        }

        // Return the structured Draft identical to the offline flow
        res.json(validatedDraft);
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: 'Invalid request', details: error.flatten() });
        } else {
            console.error('Extraction Error:', error);
            res.status(500).json({ error: 'Internal server error during extraction' });
        }
    }
});

if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(`[Backend] AI Parsing Service running on http://localhost:${PORT}`);
        console.log(`[Backend] Try POST /ai/extract with { "sourceText": "..." }`);
    });
}

export default app;

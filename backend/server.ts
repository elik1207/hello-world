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

// Schema for validating incoming extraction requests
const extractRequestSchema = z.object({
    sourceText: z.string().min(1, 'Source text cannot be empty'),
    sourceType: z.string().optional()
});

app.post('/ai/extract', async (req, res) => {
    const requestId = req.header('X-Request-ID') || Math.random().toString(36).substring(7);
    const clientIp = req.ip || req.socket.remoteAddress;

    // Backend Analytics Logging Helper
    const trackBackendEvent = (eventName: string, payload: Record<string, any> = {}) => {
        console.log(`[ANALYTICS] ${eventName}`, JSON.stringify({
            requestId,
            timestamp: new Date().toISOString(),
            ...payload
        }));
    };

    trackBackendEvent('extract_request', {
        sourceLength: req.body.sourceText?.length,
        provider: process.env.AI_PROVIDER || 'deterministic'
    });

    if (process.env.AI_LOG_LEVEL === 'info') {
        console.log(`[REQ ${requestId}] Extracting via ${process.env.AI_PROVIDER || 'deterministic'}`);
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
                trackBackendEvent('llm_used', { success: true });
            } catch (llmError: any) {
                console.warn(`[REQ ${requestId}] LLM failed (${llmError.message}). Falling back to deterministic regex.`);

                trackBackendEvent('extract_fallback', {
                    reason: llmError.message?.toLowerCase().includes('timeout') ? 'timeout' : 'provider_error'
                });

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
            trackBackendEvent('extract_fail', { reason: 'invalid_json' });
            return res.status(500).json({ error: 'Internal server error: Output validation failed. The parser returned an invalid schema.' });
        }

        trackBackendEvent('extract_success');

        // Return the structured Draft identical to the offline flow
        res.json(validatedDraft);
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: 'Invalid request', details: error.flatten() });
        } else {
            console.error(`[REQ ${requestId}] Unhandled Server Error:`, error);
            trackBackendEvent('extract_fail', { reason: 'server_crash', message: (error as Error).message || 'unknown_error' });
            res.status(500).json({ error: 'Internal server error' });
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

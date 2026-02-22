import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
// Import deterministic algorithm
import { extractGiftFromText } from '../lib/ai/extractGiftFromText';
// Import optional LLM algorithm
import { extractWithLlm, ExpectedResponseSchema } from './llm/extractWithLlm';
import { shouldUseLlm } from './llm/routing';
import type { SourceType, GiftOrVoucherDraft } from '../lib/types';
import { PostHog } from 'posthog-node';
import crypto from 'crypto';

dotenv.config();

const analyticsProvider = process.env.ANALYTICS_PROVIDER || 'console';
const analyticsEnabled = process.env.ANALYTICS_ENABLED !== 'false';
const analyticsDebug = process.env.ANALYTICS_DEBUG === 'true';
const sampleRate = parseFloat(process.env.ANALYTICS_SAMPLE_RATE || '1.0');

let posthog: PostHog | null = null;
if (analyticsEnabled && analyticsProvider === 'posthog') {
    posthog = new PostHog(process.env.POSTHOG_API_KEY || 'phc_dummy', {
        host: process.env.POSTHOG_HOST || 'https://us.i.posthog.com',
    });
}

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middleware
app.use(cors());
app.use(express.json());

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many extraction requests, please try again later.' }
});
app.use('/ai/', apiLimiter);

// Concurrency limiter for expensive LLM calls
let activeLlmRequests = 0;
const MAX_CONCURRENT_LLM_REQUESTS = 5;

// Memory Cache with 24h TTL + Rolling Error Window Guardrails
const LLM_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const responseCache = new Map<string, { value: GiftOrVoucherDraft; expiresAt: number }>();

let errorWindow: ('success' | 'fallback' | 'invalid_json')[] = [];
const ERROR_WINDOW_SIZE = 100;
const ERROR_TRIP_THRESHOLD = 0.50; // 50% failure rate auto-disables LLM
let llmAutoDisabled = false;

function recordLlmResult(status: 'success' | 'fallback' | 'invalid_json') {
    errorWindow.push(status);
    if (errorWindow.length > ERROR_WINDOW_SIZE) {
        errorWindow.shift();
    }

    if (errorWindow.length >= 10 && !llmAutoDisabled) {
        const fails = errorWindow.filter(s => s !== 'success').length;
        if (fails / errorWindow.length >= ERROR_TRIP_THRESHOLD) {
            llmAutoDisabled = true;
            console.error("[CRITICAL] LLM Failure rate exceeded threshold. Auto-disabling LLM routing.");
        }
    }
}

// Schema for validating incoming extraction requests
const extractRequestSchema = z.object({
    sourceText: z.string().min(1, 'Source text cannot be empty'),
    sourceType: z.string().optional()
});


app.post('/ai/extract', async (req, res) => {
    const requestId = req.header('X-Request-ID') || Math.random().toString(36).substring(7);
    const sessionId = req.header('X-Session-ID') || 'unknown';
    const clientIp = req.ip || req.socket.remoteAddress;

    // Backend Analytics Allowlist
    const BACKEND_ALLOWLIST: Set<string> = new Set([
        'sourceLength',
        'provider',
        'llm_used',
        'reason',
        'success'
    ]);

    // Backend Analytics Logging Helper
    const trackBackendEvent = (eventName: string, payload: Record<string, any> = {}) => {
        if (!analyticsEnabled || Math.random() > sampleRate) return;

        const safePayload: Record<string, any> = {
            requestId,
            sessionId,
            appVersion: process.env.npm_package_version || '2.0.0',
            platform: 'backend'
        };

        // Filter through allowlist to drop PII/stack traces
        for (const [key, value] of Object.entries(payload)) {
            if (BACKEND_ALLOWLIST.has(key)) {
                safePayload[key] = value;
            }
        }

        if (posthog) {
            posthog.capture({
                distinctId: sessionId || 'backend_sys',
                event: eventName,
                properties: safePayload
            });
            if (analyticsDebug) {
                console.log(`[ANALYTICS] ${eventName}`, JSON.stringify(safePayload));
            }
        } else {
            if (analyticsDebug || !posthog) {
                console.log(`[ANALYTICS] ${eventName}`, JSON.stringify(safePayload));
            }
        }
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

        // 1. Initial Fast Deterministic Check
        const detDraft = extractGiftFromText(sourceText, sourceType as SourceType);

        let draft: GiftOrVoucherDraft | null = detDraft;

        // 2. Hybrid Provider Execution / Routing
        if (process.env.AI_PROVIDER === 'llm' && shouldUseLlm(sourceText, detDraft)) {
            const safeSourceType = sourceType || 'other';
            const cacheKey = crypto.createHash('sha256').update(sourceText + '|' + safeSourceType).digest('hex');

            if (responseCache.has(cacheKey)) {
                const cached = responseCache.get(cacheKey)!;
                if (cached.expiresAt > Date.now()) {
                    draft = cached.value;
                    trackBackendEvent('llm_cache_hit', { success: true });
                } else {
                    responseCache.delete(cacheKey); // Evict stale cache entry
                }
            }

            // Execute if cache loop hasn't securely extracted the map:
            if (draft === detDraft) {
                if (llmAutoDisabled) {
                    trackBackendEvent('extract_fallback', { reason: 'auto_disabled' });
                } else if (activeLlmRequests >= MAX_CONCURRENT_LLM_REQUESTS) {
                    console.warn(`[REQ ${requestId}] Concurrency limit hit. Falling back to deterministic directly.`);
                    trackBackendEvent('extract_fallback', { reason: 'concurrency_limit' });
                } else {
                    activeLlmRequests++;
                    try {
                        // Attempt OpenAI extraction strictly
                        const llmResult = await extractWithLlm(sourceText, sourceType as SourceType);

                        if (llmResult === null) {
                            // Model explicitly said this is irrelevant text. 
                            draft = null;
                        } else {
                            draft = llmResult;
                            // Cache successful expensive result
                            if (responseCache.size >= 1000) {
                                const firstKey = responseCache.keys().next().value;
                                responseCache.delete(firstKey);
                            }
                            responseCache.set(cacheKey, { value: llmResult, expiresAt: Date.now() + LLM_CACHE_TTL_MS });
                        }

                        trackBackendEvent('llm_used', { success: true });
                    } catch (llmError: any) {
                        console.warn(`[REQ ${requestId}] LLM failed (${llmError.message}). Falling back to deterministic regex.`);

                        trackBackendEvent('extract_fallback', {
                            reason: llmError.message?.toLowerCase().includes('timeout') ? 'timeout' : 'provider_error'
                        });

                        // Fallback deterministic execution ensuring we return *something* if regex had a clue
                        draft = detDraft;
                        if (draft) {
                            draft.assumptions = draft.assumptions || [];
                            draft.assumptions.push("LLM output invalid or timed out; fell back to deterministic parsing.");
                        }
                    } finally {
                        activeLlmRequests--;
                    }
                }
            }
        } // Missed brace

        // If the decision (via LLM returning strict null) is that this is irrelevant spam/chat:
        if (draft === null) {
            return res.json(null); // Explicit non-voucher
        }

        // 3. Strict Unified Validation
        let validatedDraft;
        try {
            validatedDraft = ExpectedResponseSchema.parse(draft);
        } catch (validationError) {
            console.error(`[REQ ${requestId}] Output Validation Error:`, validationError);
            recordLlmResult('invalid_json');
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
            trackBackendEvent('extract_fail', { reason: 'server_crash' }); // Do NOT send the raw error message string
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

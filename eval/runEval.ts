import fs from 'fs';
import path from 'path';
import { extractWithEvidence } from '../lib/ai/extractWithEvidence';
import { validateExtractionResult } from '../lib/ai/normalizeValidate';
import { extractWithLlm } from '../backend/llm/extractWithLlm';
import { toGiftOrVoucherDraft } from '../lib/ai/extractionTypes';

const EVAL_DATA = path.join(__dirname, 'messages.jsonl');
const OUTPUT_JSON = path.join(__dirname, 'results.json');
const OUTPUT_MD = path.join(__dirname, 'results.md');
const BASELINE_JSON = path.join(__dirname, 'baseline.json');
const isBaselineMode = process.argv.includes('--baseline');
const isStrictMode = process.argv.includes('--strict');

async function runEval() {
    const lines = fs.readFileSync(EVAL_DATA, 'utf-8').split('\n').filter(Boolean);
    const data = lines.map(line => JSON.parse(line));

    let runLlm = (!isBaselineMode) && (!!process.env.OPENAI_API_KEY);

    let detMatches = 0;
    let detFalsePositives = 0;
    let detMissingFieldsTotal = 0;
    let detNeedsReviewTotal = 0;

    let llmMatches = 0;
    let llmFalsePositives = 0;
    let llmFallbacks = 0;
    let llmMissingFieldsTotal = 0;
    let llmNeedsReviewTotal = 0;
    let llmTotalLatency = 0;
    let llmCalls = 0;

    const totalVouchers = data.filter(d => d.expected !== null).length;
    const totalIrrelevant = data.length - totalVouchers;

    console.log(`Starting Eval. Vouchers: ${totalVouchers}, Irrelevant: ${totalIrrelevant}, LLM Enabled: ${runLlm}`);

    for (const sample of data) {
        // 1. Run Deterministic (Offline Trust Layer)
        const detExtractionRaw = extractWithEvidence(sample.text, 'whatsapp');
        const detExtractionValidated = validateExtractionResult(detExtractionRaw, sample.text);

        // Option B: Validate regressions on the legacy Draft format guaranteed by toGiftOrVoucherDraft
        const detValid = toGiftOrVoucherDraft(detExtractionValidated, sample.text, 'whatsapp');

        // Score Deterministic
        if (sample.expected === null) {
            // Expected null. If the parser generated a confident looking valid voucher anyway, it's a false positive.
            if (detValid && (detValid.missingRequiredFields?.length || 0) < 2) {
                detFalsePositives++;
            }
        } else {
            if (detValid && detValid.missingRequiredFields?.length !== 4) { // 4 means completely empty
                detMissingFieldsTotal += detValid.missingRequiredFields?.length || 0;
                detNeedsReviewTotal += detValid.inferredFields?.length || 0;

                const titleMatches = detValid.title === sample.expected.title || (detValid.title && detValid.title.includes(sample.expected.title)) || !detValid.title;
                if (titleMatches && detValid.code?.trim() === sample.expected.code?.trim()) {
                    detMatches++;
                }
            }
        }

        // 2. Run LLM (slow, sequential for accurate local evaluation)
        if (runLlm) {
            try {
                const startTime = Date.now();
                // Phase 10: extractWithLlm returns ExtractionResult
                const llmExtraction = await extractWithLlm(sample.text, 'whatsapp');
                const elapsedMs = Date.now() - startTime;

                if (llmExtraction) {
                    llmCalls++;
                }
                llmTotalLatency += elapsedMs;

                // For eval comparison against the old baseline JSONs, map it to GiftOrVoucherDraft
                const llmValid = llmExtraction ? toGiftOrVoucherDraft(llmExtraction, sample.text, 'whatsapp') : null;

                if (sample.expected === null) {
                    if (llmValid !== null) {
                        llmFalsePositives++;
                    }
                } else {
                    if (llmValid) {
                        llmMissingFieldsTotal += llmValid.missingRequiredFields?.length || 0;
                        llmNeedsReviewTotal += llmValid.inferredFields?.length || 0;

                        if (llmValid.title === sample.expected.title && llmValid.code === sample.expected.code) {
                            llmMatches++;
                        }
                    }
                }
            } catch (e) {
                llmFallbacks++;
            }
        }
    }

    const metrics = {
        totalSamples: data.length,
        vouchers: totalVouchers,
        irrelevant: totalIrrelevant,
        deterministic: {
            exactMatchRate: (detMatches / totalVouchers).toFixed(2),
            falsePositiveRate: (detFalsePositives / totalIrrelevant).toFixed(2),
            avgMissingFieldCount: (detMissingFieldsTotal / totalVouchers).toFixed(2),
            avgNeedsReviewFieldCount: (detNeedsReviewTotal / totalVouchers).toFixed(2),
        },
        llm: runLlm ? {
            exactMatchRate: (llmMatches / totalVouchers).toFixed(2),
            falsePositiveRate: (llmFalsePositives / totalIrrelevant).toFixed(2),
            avgMissingFieldCount: (llmMissingFieldsTotal / totalVouchers).toFixed(2),
            avgNeedsReviewFieldCount: (llmNeedsReviewTotal / totalVouchers).toFixed(2),
            fallbackRate: (llmFallbacks / data.length).toFixed(2),
            escalationRate: (llmCalls / data.length).toFixed(2),
            avgLatencyMs: llmCalls > 0 ? Object.is(Math.round(llmTotalLatency / llmCalls), -0) ? 0 : Math.round(llmTotalLatency / llmCalls) : 0
        } : null
    };

    if (isBaselineMode) {
        const baselineData = {
            deterministic: {
                exactMatchRate: parseFloat(metrics.deterministic.exactMatchRate),
                falsePositiveRate: parseFloat(metrics.deterministic.falsePositiveRate),
                avgMissingFieldCount: parseFloat(metrics.deterministic.avgMissingFieldCount),
                avgNeedsReviewFieldCount: parseFloat(metrics.deterministic.avgNeedsReviewFieldCount)
            }
        };
        fs.writeFileSync(BASELINE_JSON, JSON.stringify(baselineData, null, 2));
        console.log(`Baseline complete. See /eval/baseline.json`);
        return;
    }

    fs.writeFileSync(OUTPUT_JSON, JSON.stringify(metrics, null, 2));

    const md = `
# Offline Eval Results

- **Total Samples:** ${metrics.totalSamples}
- **Voucher Samples:** ${metrics.vouchers}
- **Irrelevant Samples:** ${metrics.irrelevant}

## Deterministic Parser
- **Core Entity Match Rate:** ${(metrics.deterministic.exactMatchRate as unknown as number) * 100}%
- **False Positive Rate:** ${(metrics.deterministic.falsePositiveRate as unknown as number) * 100}%
- **Avg Missing Fields:** ${metrics.deterministic.avgMissingFieldCount}
- **Avg Needs Review Fields:** ${metrics.deterministic.avgNeedsReviewFieldCount}

## LLM Parser (GPT)
${runLlm ? `
- **Core Entity Match Rate:** ${(metrics.llm!.exactMatchRate as unknown as number) * 100}%
- **False Positive Rate:** ${(metrics.llm!.falsePositiveRate as unknown as number) * 100}%
- **Avg Missing Fields:** ${metrics.llm!.avgMissingFieldCount}
- **Avg Needs Review Fields:** ${metrics.llm!.avgNeedsReviewFieldCount}
- **LLM Escalation Rate (Router bypasses offline):** ${(metrics.llm!.escalationRate as unknown as number) * 100}%
- **Fallback Rate:** ${(metrics.llm!.fallbackRate as unknown as number) * 100}%
- **Avg Latency:** ${metrics.llm!.avgLatencyMs}ms
` : '*LLM evaluation skipped (No API key present during `npm run eval`).*'}

*Note: Core Match assumes exactly identifying Title and Code. Amount validation is fuzzier offline.*
`;

    fs.writeFileSync(OUTPUT_MD, md);
    console.log(`Eval complete. See /eval/results.md`);

    if (isStrictMode) {
        console.log('\n--- Strict Mode Checks ---');
        let failed = false;

        const detFP = parseFloat(metrics.deterministic.falsePositiveRate);
        const detMatch = parseFloat(metrics.deterministic.exactMatchRate);

        if (detFP > 0) {
            console.error(`❌ Regression Error: Deterministic False Positive Rate is ${detFP} (Expected 0)`);
            failed = true;
        } else {
            console.log(`✅ Deterministic False Positive Rate is 0`);
        }

        if (detMatch < 0.75) {
            console.error(`❌ Regression Error: Deterministic Match Rate is ${detMatch} (Expected >= 0.75)`);
            failed = true;
        } else {
            console.log(`✅ Deterministic Match Rate is ${detMatch} (Expected >= 0.75)`);
        }

        if (runLlm) {
            const llmMatch = parseFloat((metrics as any).llm.exactMatchRate);
            if (llmMatch < 0.90) {
                console.error(`❌ Regression Error: LLM Match Rate is ${llmMatch} (Expected >= 0.90)`);
                failed = true;
            } else {
                console.log(`✅ LLM Match Rate is >= 0.90`);
            }
        }

        if (failed) {
            console.error('❌ Eval pipeline failed strict gates.');
            process.exit(1);
        } else {
            console.log('✅ Eval pipeline passed strict gates.');
        }
    }
}

runEval().catch(console.error);

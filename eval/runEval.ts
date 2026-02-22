import fs from 'fs';
import path from 'path';
import { extractGiftFromText } from '../lib/ai/extractGiftFromText';
import { ExpectedResponseSchema, extractWithLlm } from '../backend/llm/extractWithLlm';
import { z } from 'zod';

const EVAL_DATA = path.join(__dirname, 'messages.jsonl');
const OUTPUT_JSON = path.join(__dirname, 'results.json');
const OUTPUT_MD = path.join(__dirname, 'results.md');

// Use native zod to strictly validate
function validateOutput(draft: any) {
    if (draft === null) return null;
    try {
        return ExpectedResponseSchema.parse(draft);
    } catch {
        return null;
    }
}

async function runEval() {
    const lines = fs.readFileSync(EVAL_DATA, 'utf-8').split('\n').filter(Boolean);
    const data = lines.map(line => JSON.parse(line));

    let runLlm = !!process.env.OPENAI_API_KEY || !!process.env.AI_API_KEY;

    let detMatches = 0;
    let detFalsePositives = 0;

    let llmMatches = 0;
    let llmFalsePositives = 0;
    let llmFallbacks = 0;

    const totalVouchers = data.filter(d => d.expected !== null).length;
    const totalIrrelevant = data.length - totalVouchers;

    console.log(`Starting Eval. Vouchers: ${totalVouchers}, Irrelevant: ${totalIrrelevant}, LLM Enabled: ${runLlm}`);

    for (const sample of data) {
        // 1. Run Deterministic
        const detRaw = extractGiftFromText(sample.text, 'whatsapp');
        const detValid = validateOutput(detRaw);

        // Score Deterministic
        if (sample.expected === null) {
            // Expected null. If the parser generated a confident looking valid voucher anyway, it's a false positive.
            if (detValid && (detValid.missingRequiredFields?.length || 0) < 2) {
                detFalsePositives++;
            }
        } else {
            // Check if determinisic caught the most critical constraints
            if (detValid && detValid.title === sample.expected.title && detValid.code === sample.expected.code) {
                detMatches++;
            }
        }

        // 2. Run LLM (slow, sequential for accurate local evaluation)
        if (runLlm) {
            try {
                const llmRaw = await extractWithLlm(sample.text, 'whatsapp');
                const llmValid = validateOutput(llmRaw);

                if (sample.expected === null) {
                    if (llmValid !== null) {
                        llmFalsePositives++;
                    }
                } else {
                    if (llmValid && llmValid.title === sample.expected.title && llmValid.code === sample.expected.code) {
                        llmMatches++;
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
            falsePositiveCount: detFalsePositives
        },
        llm: runLlm ? {
            exactMatchRate: (llmMatches / totalVouchers).toFixed(2),
            falsePositiveCount: llmFalsePositives,
            fallbackCount: llmFallbacks
        } : null
    };

    fs.writeFileSync(OUTPUT_JSON, JSON.stringify(metrics, null, 2));

    const md = `
# Offline Eval Results

- **Total Samples:** ${metrics.totalSamples}
- **Voucher Samples:** ${metrics.vouchers}
- **Irrelevant Samples:** ${metrics.irrelevant}

## Deterministic Parser
- **Core Entity Match Rate:** ${(metrics.deterministic.exactMatchRate as unknown as number) * 100}%
- **False Positives:** ${metrics.deterministic.falsePositiveCount}

## LLM Parser (GPT)
${runLlm ? `
- **Core Entity Match Rate:** ${(metrics.llm!.exactMatchRate as unknown as number) * 100}%
- **False Positives:** ${metrics.llm!.falsePositiveCount}
- **Timeouts/Failures:** ${metrics.llm!.fallbackCount}
` : '*LLM evaluation skipped (No API key present during `npm run eval`).*'}

*Note: Core Match assumes exactly identifying Title and Code. Amount validation is fuzzier offline.*
`;

    fs.writeFileSync(OUTPUT_MD, md);
    console.log(`Eval complete. See /eval/results.md`);
}

runEval().catch(console.error);

import fs from 'fs';
import path from 'path';
import { extractWithEvidence } from '../lib/ai/extractWithEvidence';
import { validateExtractionResult } from '../lib/ai/normalizeValidate';
import { extractWithLlm } from '../backend/llm/extractWithLlm';
import { toGiftOrVoucherDraft } from '../lib/ai/extractionTypes';

const EVAL_DATA = path.join(__dirname, 'messages.jsonl');
const BASELINE_JSON = path.join(__dirname, 'baseline.json');

describe('Extraction Quality Regression Constraints', () => {
    let baseline: any;
    let data: any[] = [];
    let totalVouchers = 0;
    let totalIrrelevant = 0;

    beforeAll(() => {
        if (!fs.existsSync(BASELINE_JSON)) {
            throw new Error("baseline.json not found. Run 'npm run eval:baseline' first.");
        }
        baseline = JSON.parse(fs.readFileSync(BASELINE_JSON, 'utf-8'));

        const lines = fs.readFileSync(EVAL_DATA, 'utf-8').split('\n').filter(Boolean);
        data = lines.map(line => JSON.parse(line));
        totalVouchers = data.filter(d => d.expected !== null).length;
        totalIrrelevant = data.length - totalVouchers;
    });

    it('Deterministic engine maintains core entity bounds versus baseline', () => {
        let detMatches = 0;
        let detFalsePositives = 0;
        let detMissingFieldsTotal = 0;
        let detNeedsReviewTotal = 0;

        for (const sample of data) {
            const detRaw = extractWithEvidence(sample.text, 'whatsapp');
            const detValidated = validateExtractionResult(detRaw, sample.text);
            const detValid = toGiftOrVoucherDraft(detValidated, sample.text, 'whatsapp');

            if (sample.expected === null) {
                if (detValid && (detValid.missingRequiredFields?.length || 0) < 2) {
                    detFalsePositives++;
                }
            } else {
                if (detValid) {
                    detMissingFieldsTotal += detValid.missingRequiredFields?.length || 0;
                    detNeedsReviewTotal += detValid.inferredFields?.length || 0;

                    if (detValid.title === sample.expected.title && detValid.code === sample.expected.code) {
                        detMatches++;
                    }
                }
            }
        }

        const exactMatchRate = detMatches / totalVouchers;
        const falsePositiveRate = detFalsePositives / totalIrrelevant;
        const avgMissingFieldCount = detMissingFieldsTotal / totalVouchers;
        const avgNeedsReviewFieldCount = detNeedsReviewTotal / totalVouchers;

        const base = baseline.deterministic;
        const tolerance = 0.05;

        // Tolerant checks ensuring regressions are blocked
        expect(exactMatchRate).toBeGreaterThanOrEqual(base.exactMatchRate - tolerance);
        expect(falsePositiveRate).toBeLessThanOrEqual(base.falsePositiveRate + tolerance);
        expect(avgMissingFieldCount).toBeLessThanOrEqual(base.avgMissingFieldCount + tolerance);
        expect(avgNeedsReviewFieldCount).toBeLessThanOrEqual(base.avgNeedsReviewFieldCount + tolerance);
    });

    if (process.env.OPENAI_API_KEY) {
        it('LLM improves extraction quality (missing or inferred fields) vs deterministic', async () => {
            let detMissingFieldsTotal = 0;
            let detNeedsReviewTotal = 0;

            let llmMissingFieldsTotal = 0;
            let llmNeedsReviewTotal = 0;

            for (const sample of data) {
                const detRaw = extractWithEvidence(sample.text, 'whatsapp');
                const detValidated = validateExtractionResult(detRaw, sample.text);
                const detValid = toGiftOrVoucherDraft(detValidated, sample.text, 'whatsapp');

                if (sample.expected !== null && detValid) {
                    detMissingFieldsTotal += detValid.missingRequiredFields?.length || 0;
                    detNeedsReviewTotal += detValid.inferredFields?.length || 0;
                }

                const llmExtraction = await extractWithLlm(sample.text, 'whatsapp');
                const llmValid = llmExtraction ? toGiftOrVoucherDraft(llmExtraction, sample.text, 'whatsapp') : null;

                if (sample.expected !== null && llmValid) {
                    llmMissingFieldsTotal += llmValid.missingRequiredFields?.length || 0;
                    llmNeedsReviewTotal += llmValid.inferredFields?.length || 0;
                }
            }

            const detAvgMissing = detMissingFieldsTotal / totalVouchers;
            const detAvgNeedsReview = detNeedsReviewTotal / totalVouchers;

            const llmAvgMissing = llmMissingFieldsTotal / totalVouchers;
            const llmAvgNeedsReview = llmNeedsReviewTotal / totalVouchers;

            const improvesMissing = llmAvgMissing < detAvgMissing;
            const improvesReview = llmAvgNeedsReview < detAvgNeedsReview;

            // Must improve at least one 
            expect(improvesMissing || improvesReview).toBe(true);
        }, 120000); // 120s timeout since sequentially executing LLM takes time
    }
});

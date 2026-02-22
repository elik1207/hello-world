import request from 'supertest';
import app from './server';
// Mock extractWithLlm to occasionally fail to test the fallback
import * as llmModule from './llm/extractWithLlm';

jest.mock('./llm/extractWithLlm', () => ({
    // Retain original exports but allow overriding extractWithLlm
    ...jest.requireActual('./llm/extractWithLlm'),
    extractWithLlm: jest.fn(),
}));

describe('POST /ai/extract (Integration)', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        // Default environment flags for the test suite
        process.env.AI_PROVIDER = 'deterministic';
    });

    test('1. Validates Zod schema of request (missing sourceText)', async () => {
        const response = await request(app)
            .post('/ai/extract')
            .send({ sourceType: 'sms' });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Invalid request');
        expect(response.body.details.fieldErrors.sourceText).toBeDefined();
    });

    test('2. Deterministic execution resolves correctly', async () => {
        const response = await request(app)
            .post('/ai/extract')
            .send({
                sourceText: 'קסטרו 200 שח קוד CS-999',
                sourceType: 'sms'
            });

        expect(response.status).toBe(200);
        expect(response.body.merchant).toBe('Castro');
        expect(response.body.amount).toBe(200);
        expect(response.body.code).toBe('CS-999');
    });

    test('3. Fallback: LLM failure correctly downgrades to Regex', async () => {
        process.env.AI_PROVIDER = 'llm';

        // Mock the LLM to aggressively throw an exception (simulating timeout or invalid API Key)
        (llmModule.extractWithLlm as jest.Mock).mockRejectedValue(new Error('OpenAI API timeout'));

        const response = await request(app)
            .post('/ai/extract')
            .send({
                sourceText: 'קסטרו 200 שח קוד CS-999',
                sourceType: 'sms'
            });

        expect(response.status).toBe(200);
        // Fallback occurred successfully, results verified deterministic path
        expect(response.body.merchant).toBe('Castro');
        expect(response.body.amount).toBe(200);
        expect(response.body.code).toBe('CS-999');
        // Check assumption exists for LLM failure
        expect(response.body.assumptions.some((a: string) => a.includes('fell back to deterministic'))).toBe(true);
    });

});

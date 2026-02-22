// @ts-nocheck
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { AddViaAIPage } from './AddViaAIPage';
import * as analytics from '../lib/analytics';
import * as extractor from '../lib/ai/extractGiftFromText';

jest.mock('../lib/analytics', () => ({
    trackEvent: jest.fn(),
    sessionId: 'test-session',
}));

jest.mock('../lib/ai/extractGiftFromText', () => ({
    extractGiftFromText: jest.fn(),
}));

describe('AddViaAIPage - UX Refinement Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Force deterministic offline mode
        process.env.EXPO_PUBLIC_AI_MODE = 'offline';
    });

    it('1. missing title triggers clarify_shown(reason=missing_title)', async () => {
        (extractor.extractGiftFromText as jest.Mock).mockReturnValue({
            title: '',
            amount: 100,
            missingRequiredFields: ['title'],
            questions: [{ key: 'title', questionText: 'What is the title?', inputType: 'text' }],
            confidence: 0.8
        });

        const { getByPlaceholderText, getByText } = render(<AddViaAIPage onSave={jest.fn()} onCancel={jest.fn()} />);

        fireEvent.changeText(getByPlaceholderText(/e\.g\./i), 'dummy text');
        fireEvent.press(getByText('Analyze Text'));

        await waitFor(() => {
            expect(analytics.trackEvent).toHaveBeenCalledWith('clarify_shown', expect.objectContaining({
                reason: 'missing_title'
            }));
            expect(getByText('What is the title?')).toBeTruthy();
        });
    });

    it('2. missing amount does NOT trigger clarify and sets Preview indicator "Missing"', async () => {
        (extractor.extractGiftFromText as jest.Mock).mockReturnValue({
            title: 'Test Title',
            missingRequiredFields: ['amount', 'code'],
            confidence: 0.9
        });

        const { getByPlaceholderText, getByText, getAllByText, queryByText } = render(<AddViaAIPage onSave={jest.fn()} onCancel={jest.fn()} />);

        fireEvent.changeText(getByPlaceholderText(/e\.g\./i), 'dummy text');
        fireEvent.press(getByText('Analyze Text'));

        await waitFor(() => {
            expect(getByText('Ready to Save')).toBeTruthy();
        });

        const missingBadges = getAllByText('חסר');
        expect(missingBadges.length).toBe(2);
        expect(queryByText('What is the title?')).toBeNull();
    });

    it('3. suspicious code does NOT trigger clarify and sets "Needs review"', async () => {
        (extractor.extractGiftFromText as jest.Mock).mockReturnValue({
            title: 'Test Title',
            code: 'ABCD',
            assumptions: ['Code looks suspicious (no digits), marked for review.'],
            confidence: 0.9
        });

        const { getByPlaceholderText, getByText, queryByText } = render(<AddViaAIPage onSave={jest.fn()} onCancel={jest.fn()} />);

        fireEvent.changeText(getByPlaceholderText(/e\.g\./i), 'dummy text');
        fireEvent.press(getByText('Analyze Text'));

        await waitFor(() => {
            expect(getByText('לבדיקה')).toBeTruthy();
            expect(queryByText('חסר')).toBeNull();
        });
    });

    it('4. editing a field clears its indicator', async () => {
        (extractor.extractGiftFromText as jest.Mock).mockReturnValue({
            title: 'Test Title',
            missingRequiredFields: ['amount'],
            confidence: 0.9
        });

        const { getByPlaceholderText, getByText, queryByText, queryAllByText } = render(<AddViaAIPage onSave={jest.fn()} onCancel={jest.fn()} />);

        fireEvent.changeText(getByPlaceholderText(/e\.g\./i), 'dummy text');
        fireEvent.press(getByText('Analyze Text'));

        await waitFor(() => {
            expect(queryAllByText('חסר').length).toBe(1);
        });

        const amountInput = getByPlaceholderText('0');
        fireEvent.changeText(amountInput, '150');

        expect(queryByText('חסר')).toBeNull();
        expect(analytics.trackEvent).toHaveBeenCalledWith('field_edited', expect.objectContaining({
            fieldName: 'amount'
        }));
    });

    it('5. save_success payload includes non-PII edit tracking', async () => {
        (extractor.extractGiftFromText as jest.Mock).mockReturnValue({
            title: 'Test Title',
            missingRequiredFields: ['amount', 'code'],
            confidence: 0.9
        });

        const onSaveMock = jest.fn();
        const { getByPlaceholderText, getByText } = render(<AddViaAIPage onSave={onSaveMock} onCancel={jest.fn()} />);

        fireEvent.changeText(getByPlaceholderText(/e\.g\./i), 'dummy text');
        fireEvent.press(getByText('Analyze Text'));

        await waitFor(() => {
            expect(getByText('Ready to Save')).toBeTruthy();
        });

        fireEvent.changeText(getByPlaceholderText('0'), '150');
        fireEvent.press(getByText('Save to Wallet'));

        await waitFor(() => {
            expect(onSaveMock).toHaveBeenCalled();
            expect(analytics.trackEvent).toHaveBeenCalledWith('save_success', expect.objectContaining({
                editedFieldCount: 1,
                missingFieldCountAtSave: 1
            }));
        });
    });
});

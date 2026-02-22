import { logEvent, posthog } from './analyticsProvider';

jest.mock('posthog-react-native', () => {
    return jest.fn().mockImplementation(() => {
        return { capture: jest.fn(), register: jest.fn() };
    });
});

describe('lib/analyticsProvider', () => {
    const originalEnv = process.env;
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...originalEnv };
        process.env.EXPO_PUBLIC_ANALYTICS_ENABLED = 'true';
        process.env.EXPO_PUBLIC_ANALYTICS_SAMPLE_RATE = '1.0';
        consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
        process.env = originalEnv;
        consoleSpy.mockRestore();
    });

    it('filters out non-allowlisted properties (PII Protection)', async () => {
        const { logEvent: reloadedLogEvent } = await import('./analyticsProvider');

        reloadedLogEvent('paste_message', {
            sourceType: 'whatsapp',
            hasAmount: true,
            rawText: 'DO NOT LOG THIS PII STRING 054-1234567',
            vendorName: 'Secret Store',
            time_to_save_ms: 1200
        }, 'test-session');

        expect(consoleSpy).toHaveBeenCalledWith(
            '[ANALYTICS: paste_message]',
            expect.stringContaining('"sourceType":"whatsapp"')
        );
        expect(consoleSpy).toHaveBeenCalledWith(
            '[ANALYTICS: paste_message]',
            expect.stringContaining('"hasAmount":true')
        );
        expect(consoleSpy).toHaveBeenCalledWith(
            '[ANALYTICS: paste_message]',
            expect.stringContaining('"time_to_save_ms":1200')
        );

        // Crucially, assert PII was dropped securely
        expect(consoleSpy).not.toHaveBeenCalledWith(
            expect.anything(),
            expect.stringContaining('DO NOT LOG')
        );
        expect(consoleSpy).not.toHaveBeenCalledWith(
            expect.anything(),
            expect.stringContaining('Secret Store')
        );
    });

    it('skips all logging when ANALYTICS_ENABLED is false (Kill switch)', async () => {
        process.env.EXPO_PUBLIC_ANALYTICS_ENABLED = 'false';
        const { logEvent: reloadedLogEvent } = await import('./analyticsProvider');

        reloadedLogEvent('parse_start', {}, 'test-session');

        expect(consoleSpy).not.toHaveBeenCalled();
    });
});

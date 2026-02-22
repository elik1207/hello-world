import PostHog from 'posthog-react-native';
import { Platform } from 'react-native';
import * as Application from 'expo-application';

const PROVIDER = process.env.EXPO_PUBLIC_ANALYTICS_PROVIDER || 'console';
const ENABLED = process.env.EXPO_PUBLIC_ANALYTICS_ENABLED !== 'false';
const DEBUG = process.env.EXPO_PUBLIC_ANALYTICS_DEBUG === 'true';
const SAMPLE_RATE = parseFloat(process.env.EXPO_PUBLIC_ANALYTICS_SAMPLE_RATE || '1.0');

export let posthog: PostHog | null = null;
let isSampledIn = Math.random() <= SAMPLE_RATE;

export function initAnalytics() {
    if (!ENABLED || !isSampledIn) return;

    if (PROVIDER === 'posthog') {
        posthog = new PostHog(process.env.EXPO_PUBLIC_POSTHOG_API_KEY || 'phc_dummy', {
            host: process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
            enableSessionRecording: false, // Privacy first
            preloadFeatureFlags: false,
        });

        // Register universal super properties
        posthog.register({
            appVersion: Application.nativeApplicationVersion || '2.0.0',
            platform: Platform.OS,
        });
    }
}

// Strict allowlist for event properties - any property not listed here will be dropped
const ALLOWLIST: Set<string> = new Set([
    // Common
    'requestId',
    'sourceType',
    // Parsing / Saving KPIs
    'questionCount',
    'fieldName',
    'time_to_save_ms',
    'missingFieldCount',
    'needsReviewFieldCount',
    'hasAmount',
    'hasTitle',
    'hasDate',
    'hasCode',
    'hasExpiry',
    'missingFieldCountAtSave',
    'needsReviewFieldCountAtSave',
    'editedFieldCount',
    // Infrastructure/Safety
    'error', // safe error labels
    'errorMessage',
    'componentStack',
    'reason'
]);

export function logEvent(eventName: string, properties: Record<string, any> = {}, sessionId: string) {
    if (!ENABLED || !isSampledIn) return;

    // Filter properties through allowlist to ensure absolutely no PII or raw text sneaks in
    const safeProperties: Record<string, any> = { sessionId };
    for (const [key, value] of Object.entries(properties)) {
        if (ALLOWLIST.has(key)) {
            safeProperties[key] = value;
        }
    }

    if (PROVIDER === 'posthog' && posthog) {
        posthog.capture(eventName, safeProperties);
        if (DEBUG) {
            console.log(`[ANALYTICS] ${eventName}`, JSON.stringify(safeProperties));
        }
    } else {
        if (DEBUG || !posthog) {
            console.log(`[ANALYTICS] ${eventName}`, JSON.stringify(safeProperties));
        }
    }
}

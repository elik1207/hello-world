import { initAnalytics, logEvent } from './analyticsProvider';

/**
 * Core Analytics Abstraction
 * Calls the provider adapter dynamically.
 */

// Generate a roughly unique session ID for this app launch
export const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Initialize the selected analytics provider on boot
initAnalytics();

export type AnalyticsEvent =
    | 'paste_message'
    | 'parse_start'
    | 'parse_success'
    | 'parse_fail'
    | 'clarify_shown'
    | 'field_edited'
    | 'save_success';

export interface EventPayload {
    requestId?: string;
    sourceType?: string;
    questionCount?: number;
    fieldName?: string; // Must NEVER be the actual value typed, only the key (e.g., 'amount')
    time_to_save_ms?: number;
    [key: string]: string | number | boolean | undefined;
}

/**
 * Tracks an event with the given payload.
 * Enforces structured schemas and session correlation.
 */
export function trackEvent(eventName: AnalyticsEvent, payload?: EventPayload) {
    logEvent(eventName, payload || {}, sessionId);
}

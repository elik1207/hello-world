/**
 * Core Analytics Abstraction
 * Currently logs to console, but designed to be swapped out for PostHog/Segment/Amplitude later.
 */

// Generate a roughly unique session ID for this app launch
export const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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
    const finalPayload = {
        eventName,
        sessionId,
        timestamp: new Date().toISOString(),
        ...payload
    };

    // Replace this internal 'provider' with PostHog or Amplitude SDK later
    // TODO: Integrate PostHog / Segment / Amplitude for Frontend logging here
    console.log(`[ANALYTICS] ${eventName}`, JSON.stringify(finalPayload));
}

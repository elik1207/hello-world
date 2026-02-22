# Analytics & KPI Dashboard Specification

This repository is instrumented with **PostHog** to track application health, parsing success rates, and user conversion funnels. 

Crucially, **no PII or raw message text** is ever sent to PostHog. All tracking is managed seamlessly by the `lib/analyticsProvider.ts` adapter, which strictly enforces a local allowlist of properties.

## Environment Variables

For production, ensure the following are set in both your Expo build environment and your Node.js backend environment:

- `EXPO_PUBLIC_ANALYTICS_PROVIDER=posthog`
- `EXPO_PUBLIC_ANALYTICS_ENABLED=true`
- `EXPO_PUBLIC_POSTHOG_API_KEY=<your_project_api_key>`
- `EXPO_PUBLIC_ANALYTICS_SAMPLE_RATE=1.0` (100% in dev/early launch, reduce to 0.2-0.5 at scale to save costs)

*(The backend uses standard non-`EXPO_PUBLIC` versions of these variables in `.env`)*

## PostHog Dashboard Setup

Recreate these 5 core KPIs in your PostHog instance:

### 1. Paste → Save Conversion
**Insight Type:** Funnel
- **Step 1:** Event: `paste_message`
- **Step 2:** Event: `save_success`
*Measures how many people that input text successfully leave with a validated ticket in their wallet.*

### 2. Time to Save (Friction)
**Insight Type:** Trends (Average)
- **Event:** `save_success`
- **Property:** `time_to_save_ms`
*A low average time means users trust the extraction and don't need to manually fix typos. Target: < 5,000ms.*

### 3. Needs Review Friction (Confidence)
**Insight Type:** Trends (Percentage / Breakdown)
- **Event:** `parse_success`
- **Metric:** Count of `parse_success` where property `missingFieldCount > 0` or `questionCount > 0`
*Measures how often the heuristic/LLM falls short and visually flags fields for review.*

### 4. Clarification Prompt Frequency
**Insight Type:** Trends (Average)
- **Event:** `clarify_shown`
- **Property:** `questionCount`
*Tracks how aggressively the UI forces users to manually input the merchant/store "Title" before proceeding. Target: < 1.0 avg.*

### 5. Backend Extraction Health
**Insight Type:** Trends (Breakdown by Property)
- **Event:** `extract_request`, `llm_used`, `extract_fallback`, `extract_fail`
*Plot these on a single line chart to visualize the health of your parser pipelines. A high ratio of `extract_fallback` relative to `extract_request` means the OpenAI LLM is consistently timing out or failing validation, forcing the system back to deterministic regex.*

---

## Developer Verification (Debug Mode)

To verify analytics events end-to-end without exposing production keys or polluting PostHog metrics, you can enable **Debug Mode**. This forces the analytics adapters to `console.log` the *exact, sanitized payload* that survives the privacy `ALLOWLIST` filters.

**Frontend (Expo):**
```properties
EXPO_PUBLIC_ANALYTICS_DEBUG=true
```

**Backend (Node.js):**
```properties
ANALYTICS_DEBUG=true
```

When enabled, watch your terminal for `[ANALYTICS HTTP] -> event_name` (if PostHog is active and firing) or `[ANALYTICS LOCAL] event_name` (if falling back to console).

**Privacy Guarantee:** If a property like `rawText` or an AI Error stack trace appears in a localized debug log, the PII filter is broken. The `ALLOWLIST` operates on a strict *drop-by-default* philosophy—only exact string matches to explicit KPI requirements (e.g. `time_to_save_ms` or `missingFieldCount`) survive the event pipeline.

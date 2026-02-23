# Phase 10: OS Intake (Share / Deep Link / Clipboard)

## Supported Sources

### 1. Deep Link (`couponwallet://intake?text=...`)
- **Flag**: `EXPO_PUBLIC_FEATURE_INTAKE_DEEPLINK=true`
- URL scheme: `couponwallet://` (registered in `app.json` → `scheme`)
- Path: `/intake` with query param `text` (URL-encoded)
- Works on cold start and warm start

**Example:**
```
couponwallet://intake?text=%D7%A9%D7%95%D7%91%D7%A8%20100%20%E2%82%AA
```

### 2. Share Intent (OS Share Sheet → App)
- **Flag**: `EXPO_PUBLIC_FEATURE_INTAKE_SHARE=true`

| Platform | Status | Details |
|----------|--------|---------|
| **Android** | ✅ Supported | Native Expo module reads `ACTION_SEND` `EXTRA_TEXT`. App appears in share sheet. Shared text routes to AI extraction. |
| **iOS** | ⚠️ Not supported | Requires native share extension not feasible in managed Expo. Use deeplink or clipboard instead. |

**Android implementation details:**
- **Native module**: `modules/share-intent/` — local Expo module with Kotlin code
  - `ShareIntentModule.kt`: reads `Intent.EXTRA_TEXT`, handles cold start (`OnCreate`) and warm start (`OnNewIntent`)
  - Exposes `getSharedText()`, `clearSharedText()`, and `onShareIntent` event to JS
- **Config plugin**: `plugins/withAndroidShareIntent.js` — adds `ACTION_SEND text/plain` intent-filter
- **JS interface**: `modules/share-intent/index.ts` — typed exports with safe no-ops on non-Android

**Setup (requires Dev Client / prebuild):**
```bash
# 1. Prebuild to apply config plugin + native module
npx expo prebuild --clean

# 2. Build a dev client (Android)
npx expo run:android

# 3. Enable the feature flag
echo 'EXPO_PUBLIC_FEATURE_INTAKE_SHARE=true' >> .env.local
```

**iOS — what would be needed:**
1. Custom dev client or bare workflow
2. Native iOS Share Extension target in Xcode
3. App Group shared container for data transfer
4. Read shared text from container on app launch

### 3. Clipboard Suggestion
- **Flag**: `EXPO_PUBLIC_FEATURE_INTAKE_CLIPBOARD=true`
- **Also requires**: User opt-in in Settings → "Clipboard Suggestions" (default OFF)
- Checks clipboard on app foreground for voucher-like content
- Throttled to once per 5 minutes; deduped by SHA-256 digest
- **No text content is ever persisted** — only `@intake_clipboard_digest` (SHA-256 hex) and `@intake_clipboard_lastPromptAt` (timestamp)

## Privacy Guarantees
- **No raw text in analytics** — only: `source`, `lengthBucket`, `hasAmountHint`, `hasDateHint`, `hasKeywordHint`
- **No voucher codes, vendor names, or PII** in any event payload
- **No shared/clipboard text persisted** to AsyncStorage, logs, or Sentry
- **Clipboard dedup**: SHA-256 digest only (via `expo-crypto`)
- **Share buffer**: cleared immediately after routing to intake pipeline (`clearSharedText()`)

## Feature Flags
All default to `false`. Set in `.env` or `.env.local`:
```
EXPO_PUBLIC_FEATURE_INTAKE_DEEPLINK=true
EXPO_PUBLIC_FEATURE_INTAKE_SHARE=true
EXPO_PUBLIC_FEATURE_INTAKE_CLIPBOARD=true
```
With all flags OFF → zero behavior change.

## Manual QA Checklist

### Deep Link
- [ ] `couponwallet://intake?text=שובר%20100%20₪` opens AI flow prefilled (cold + warm start)
- [ ] Empty/missing text param → no action
- [ ] Analytics `intake_opened` has `source: "deeplink"` + safe meta only

### Share (Android)
- [ ] After `npx expo prebuild` + `npx expo run:android`
- [ ] Share text from WhatsApp → app opens → AI flow with prefilled text
- [ ] Share text from SMS → same behavior
- [ ] Share while app is running (warm start) → AI flow opens with new text
- [ ] After routing, `clearSharedText()` prevents re-processing
- [ ] Analytics `intake_opened` has `source: "share"` + safe meta only
- [ ] No shared text in AsyncStorage, logs, or analytics

### Clipboard
- [ ] Toggle OFF by default in Settings
- [ ] Toggle ON → copy voucher text → open app → Hebrew prompt
- [ ] Non-voucher text → no prompt
- [ ] Same text → no re-prompt (digest dedup)
- [ ] Respects 5-minute throttle
- [ ] "כן" → AI flow prefilled; "לא עכשיו" → dismiss
- [ ] `@intake_clipboard_digest` contains only hex hash (inspect via debug tools)

### Flags OFF → No Changes
- [ ] All 3 flags OFF → no intake, no clipboard reads, no share handling, no listeners

### Regression
- [ ] Manual add / AI paste / edit all work
- [ ] Reminders schedule/cancel correctly
- [ ] Export/Import unchanged
- [ ] Bulk actions + tags + saved views unchanged

## Known Limitations
1. **Android share requires Dev Client**: `npx expo prebuild` + `npx expo run:android` (not Expo Go)
2. **iOS share not supported**: No native share extension in managed Expo
3. **expo-clipboard**: Requires `npx expo install expo-clipboard` (may need Dev Client on iOS)
4. **Web**: All intake features are no-ops on web platform

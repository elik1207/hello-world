# Phase 10: OS Intake (Share / Deep Link / Clipboard)

## Supported Sources

### 1. Deep Link (`couponwallet://intake?text=...`)
- **Flag**: `EXPO_PUBLIC_FEATURE_INTAKE_DEEPLINK=true`
- URL scheme: `couponwallet://` (registered in `app.json` → `scheme`)
- Path: `/intake` with query param `text` (URL-encoded)
- Works on cold start and warm start
- Text is normalized (trimmed, whitespace-collapsed, zero-width chars stripped, 10k char limit)
- Routes directly to AddViaAI screen with text prefilled

**Example:**
```
couponwallet://intake?text=%D7%A9%D7%95%D7%91%D7%A8%20100%20%E2%82%AA
```

### 2. Share Intent (OS Share Sheet → App)
- **Flag**: `EXPO_PUBLIC_FEATURE_INTAKE_SHARE=true`

| Platform | Status | Details |
|----------|--------|---------|
| **Android** | ✅ Supported | Config plugin adds `ACTION_SEND` intent-filter for `text/plain`. App appears in share sheet. Shared text routes to AI extraction. |
| **iOS** | ⚠️ Not supported in managed Expo | iOS share extensions require native code and a custom dev client. Deep link + clipboard cover iOS intake. |

**Android implementation:**
- Config plugin: `plugins/withAndroidShareIntent.js` (registered in `app.json`)
- Requires `npx expo prebuild` to apply intent-filter to `AndroidManifest.xml`
- On receiving shared text: normalize → `handleSharedText` → AddViaAI prefilled

**iOS — what's needed for full share support:**
1. Eject to bare workflow or use a custom dev client
2. Create a native iOS Share Extension target
3. Store shared text in App Group shared container
4. Read from shared container on app launch
5. Alternative: use `expo-share-intent` community package (if compatible)

### 3. Clipboard Suggestion
- **Flag**: `EXPO_PUBLIC_FEATURE_INTAKE_CLIPBOARD=true`
- **Also requires**: User opt-in via Settings → "Clipboard Suggestions" toggle (default OFF)
- On app foreground, reads clipboard and checks for voucher-like content
- Non-blocking Hebrew prompt: "מצאתי טקסט שנראה כמו שובר. לשמור לארנק?"
- Throttled to once per 5 minutes
- **Dedup: SHA-256 digest only** — no text content is ever persisted to AsyncStorage
  - Stored keys: `@intake_clipboard_digest` (hex hash), `@intake_clipboard_lastPromptAt` (timestamp)
  - The digest cannot be reversed to reconstruct the original clipboard text

## Privacy Guarantees
- **No raw text in analytics** — only safe metadata: `source`, `lengthBucket`, `hasAmountHint`, `hasDateHint`, `hasKeywordHint`
- **No voucher codes, vendor names, or PII** in any event payload
- **Clipboard dedup uses SHA-256 digest** — no text or substring persisted
- Analytics allowlist enforced in `lib/analyticsProvider.ts`
- Clipboard text is never stored; only a cryptographic digest for dedup

## Feature Flags
All flags default to `false` (OFF). Set in `.env` or `.env.local`:
```
EXPO_PUBLIC_FEATURE_INTAKE_DEEPLINK=true
EXPO_PUBLIC_FEATURE_INTAKE_SHARE=true
EXPO_PUBLIC_FEATURE_INTAKE_CLIPBOARD=true
```
With all flags OFF, app behavior is unchanged.

## Manual QA Checklist

### Deep Link
- [ ] `couponwallet://intake?text=שובר%20100%20₪` opens AI flow with text prefilled (cold start)
- [ ] Same URL opens correctly on warm start
- [ ] Empty/missing text param does nothing
- [ ] Analytics event `intake_opened` contains only safe keys

### Share (Android)
- [ ] Share text from WhatsApp → app opens → AI flow opens with text prefilled
- [ ] Share text from SMS → same behavior
- [ ] After `npx expo prebuild`, intent-filter appears in `AndroidManifest.xml`
- [ ] Analytics `intake_opened` has `source: "share"` with safe meta only

### Clipboard
- [ ] Toggle OFF by default in Settings
- [ ] With toggle ON: copy voucher text → switch to app → prompt appears
- [ ] Prompt does not appear for non-voucher text
- [ ] Prompt does not re-appear for same text (digest dedup)
- [ ] Prompt respects 5-minute throttle
- [ ] "כן" opens AI flow prefilled
- [ ] "לא עכשיו" dismisses without action
- [ ] Verify `@intake_clipboard_digest` in AsyncStorage contains only a hex hash (no text)
- [ ] Analytics `intake_suggested` contains only safe keys

### Flags OFF → No Changes
- [ ] With all 3 flags OFF, no intake behavior occurs
- [ ] No clipboard reads, no deep link listeners, no share handling

### Regression
- [ ] Manual add (form) still works
- [ ] AI paste (manual) still works  
- [ ] Reminders still schedule/cancel correctly
- [ ] Export/Import unchanged
- [ ] Bulk actions unchanged
- [ ] Tags/Saved Views unchanged

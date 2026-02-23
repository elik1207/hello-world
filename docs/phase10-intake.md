# Phase 10: OS Intake (Share / Deep Link / Clipboard)

## Supported Sources

### 1. Deep Link (`couponwallet://intake?text=...`)
- **Flag**: `EXPO_PUBLIC_FEATURE_INTAKE_DEEPLINK=true`
- URL scheme: `couponwallet://` (registered in `app.json` → `"scheme"`)
- Path: `/intake`, query param: `text` (URL-encoded)
- Works on cold start and warm start

**Example:**
```
couponwallet://intake?text=%D7%A9%D7%95%D7%91%D7%A8%20100%20%E2%82%AA
```

### 2. Share Intent (OS Share Sheet → App)
- **Flag**: `EXPO_PUBLIC_FEATURE_INTAKE_SHARE=true`

| Platform | Status | Details |
|----------|--------|---------|
| **Android** | ✅ Supported | Native Expo module reads `EXTRA_TEXT`. Requires Dev Client (not Expo Go). |
| **iOS** | ⚠️ Not supported | Requires native Share Extension. Use deeplink + clipboard. |

**How it works (Android):**

```
WhatsApp/SMS → "Share" → App opens → ShareIntentModule reads EXTRA_TEXT
→ JS getSharedText() → normalizeIncomingText → AI extraction prefilled
→ clearSharedText() (prevent re-processing)
```

**Architecture:**

| Layer | File | Role |
|-------|------|------|
| Config plugin | `plugins/withAndroidShareIntent.js` | Adds `ACTION_SEND text/plain` intent-filter + `singleTask` launchMode |
| Native module | `modules/share-intent/.../ShareIntentModule.kt` | Reads intent, buffers text, emits events |
| JS interface | `modules/share-intent/index.ts` | `getSharedText()`, `clearSharedText()`, `addShareIntentListener()` |
| App routing | `App.tsx` | Calls bridge on cold/warm start, routes to AI flow |

**Setup (requires Dev Client):**
```bash
# 1. Prebuild to generate native projects
npx expo prebuild --clean

# 2. Build and run on Android
npx expo run:android

# 3. Enable the feature flag
echo 'EXPO_PUBLIC_FEATURE_INTAKE_SHARE=true' >> .env.local
```

**Cold start vs warm start:**
- **Cold start**: App was not running. `OnCreate` + `OnActivityCreated` read the initial intent. JS calls `getSharedText()` on mount.
- **Warm start**: App already running. `singleTask` launchMode causes `onNewIntent` instead of new Activity. Module emits `onShareIntent` event. JS listener picks it up.

**iOS — what's needed for full share support:**
1. Custom dev client or bare workflow
2. iOS Share Extension target in Xcode
3. App Group shared container for passing text
4. Read from container on app launch

### 3. Clipboard Suggestion
- **Flag**: `EXPO_PUBLIC_FEATURE_INTAKE_CLIPBOARD=true`
- **Also requires**: Settings → "Clipboard Suggestions" toggle (default OFF)
- Checks clipboard on app foreground, shows prompt for voucher-like content
- Throttled (5 min), deduped by SHA-256 digest (no text persisted)

## Privacy Guarantees
- **No raw text in analytics** — only: `source`, `lengthBucket`, `hasAmountHint`, `hasDateHint`, `hasKeywordHint`
- **No shared text persisted** — native buffer cleared after routing (`clearSharedText()`)
- **No clipboard text stored** — only SHA-256 digest for dedup
- **Allowlist enforced** in `lib/analyticsProvider.ts`

## Feature Flags
All default `false`. Set in `.env` / `.env.local`:
```
EXPO_PUBLIC_FEATURE_INTAKE_DEEPLINK=true
EXPO_PUBLIC_FEATURE_INTAKE_SHARE=true
EXPO_PUBLIC_FEATURE_INTAKE_CLIPBOARD=true
```
**With all flags OFF → zero behavior change.**

## Manual QA Checklist

### Deep Link
- [ ] `couponwallet://intake?text=...` opens AI flow prefilled (cold + warm)
- [ ] Empty text param → no action
- [ ] Analytics: `intake_opened` with `source: "deeplink"` + safe meta

### Share (Android — requires Dev Client)
- [ ] `npx expo prebuild --clean && npx expo run:android`
- [ ] Share from WhatsApp → app opens → AI flow with prefilled text
- [ ] Share from SMS → same
- [ ] Share while app running (warm start) → AI flow with new text
- [ ] After routing, re-opening app does NOT re-show old share text
- [ ] Analytics: `intake_opened` with `source: "share"` + safe meta
- [ ] No shared text in AsyncStorage, logs, Sentry

### Clipboard
- [ ] Toggle OFF by default in Settings
- [ ] Toggle ON → copy voucher → open app → Hebrew prompt
- [ ] Non-voucher text → no prompt
- [ ] Same text → no re-prompt (SHA-256 dedup)
- [ ] 5-minute throttle respected
- [ ] `@intake_clipboard_digest` contains only hex hash

### Flags OFF
- [ ] All 3 flags OFF → no intake behavior, no listeners, no clipboard reads

### Regression
- [ ] Manual add / AI paste / edit unchanged
- [ ] Reminders, tags, saved views, bulk actions unchanged
- [ ] Export/Import unchanged

## Troubleshooting

**App opens but AI flow doesn't show prefilled text?**
1. Verify `EXPO_PUBLIC_FEATURE_INTAKE_SHARE=true` in `.env.local`
2. Verify running a Dev Client build (not Expo Go)
3. After `npx expo prebuild`, check `android/app/src/main/AndroidManifest.xml`:
   - Main activity has `android:launchMode="singleTask"`
   - Intent-filter with `android.intent.action.SEND` + `text/plain` exists
4. Check Metro console for `[ShareIntent] bridge unavailable` warnings

**Warm-start share doesn't work?**
- Ensure `android:launchMode="singleTask"` is set. Without it, Android creates a new Activity and `onNewIntent` never fires.

**Module not found?**
- Run `npx expo prebuild --clean` to regenerate native projects with the local module linked.

# 🎟️ Coupon Wallet

A personal coupon & discount manager app. Store, organize, and track your coupons — never miss a deal or let one expire.

> **Note:** The `v1.0-web` tag contains the original React + Vite web version. The `master` branch is being migrated to **Expo (React Native)** for cross-platform support on Android, iOS, and Web.

---

## Features

- 🎨 **Premium Dark Theme**: A stunning, high-contrast dark aesthetic that feels modern and native.
- 🎁 **General Wallet**: Store not just Coupons, but also Gift Cards (with remaining balances) and one-time Vouchers.
- ⏳ **Urgency Inbox**: Smartly groups items by expiration (Expiring Soon, This Month, Safe) with visual edge-color indicators.
- 📊 **Financial Insights**: Tracks your "Trapped Value" (active funds) and "Lost Value" (expired funds). *(Planned / Future work)*
- 📷 **Advanced Display**: Visualizes Barcode data and brand Image URLs beautifully on the cards.
- ➕ **Rich Metadata**: Add Store, Category, Sender, and Event information.
- 🗂️ **Archive**: Dedicated tab for keeping track of used and expired items.
- 📤 **Export/Import via JSON**: Backup your state with built-in versioning and schema migrations.
- 💾 **Local First**: 100% private, persistent local storage (no servers).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Expo](https://expo.dev) (React Native) |
| Styling | [NativeWind](https://www.nativewind.dev) (Tailwind CSS) |
| Storage | `expo-sqlite` (Source of Truth) / AsyncStorage (Legacy Import) |
| Icons | lucide-react-native |
| Language | TypeScript |

---

## Data & Storage Architecture

**SQLite (`expo-sqlite`) is the single source of truth** for all coupon and wallet data.
- **Migrations:** Managed securely via `PRAGMA user_version`. Schema upgrades run automatically on cold start.
- **AsyncStorage (Legacy):** Perserved strictly for one-time backward-compatible imports from older App versions. It is no longer the primary persistent store.

---

## Running the App

### Prerequisites
- Node.js 18+
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- [Expo Go](https://expo.dev/go) app on your phone (for mobile testing)

### Start

```bash
npm install
npx expo start
```

Then:
- Press **`w`** to open in web browser
- Scan the **QR code** with Expo Go to open on your phone (Android/iOS)

### Hybrid AI Backend (Optional, Phase 4 & 5)
The application includes a centralized deterministic AI extraction pipeline that can run identically on the client (offline) or natively on a Node.js (Express) server. **The server also supports an optional OpenAI fallback** that respects all deterministic rules and schemas while catching complex edge-cases.

#### 1. Start the Express Backend Server
```bash
cd backend
npm install
# Copy the environment file and configure (e.g. inject OPENAI_API_KEY if testing LLM mode)
cp .env.example .env
npm run dev
```

> **Developer Note (Physical Devices):**
> If you are testing the Expo app on a physical device (via Expo Go) rather than a desktop simulator, `http://localhost:3000` will not resolve. You must replace `localhost` in `EXPO_PUBLIC_AI_BACKEND_URL` with your computer's local Wi-Fi IP address (e.g., `http://192.168.1.15:3000`) or use a tunneling service.

> **Note on Providers (`backend/.env`):**
> - `AI_PROVIDER=deterministic` (Default): Runs local regex exactly like the offline client. Use this to maintain full local operation while simulating a real backend.
> - `AI_PROVIDER=llm`: Routes the request cleanly through OpenAI using native JSON schema constraints. If the prompt fails, times out, or hallucinates, the Express server gracefully swallows the exact request backward into the deterministic parser.

#### 2. Configure the Frontend Switch
In the root directory of the Expo project, alter your `.env` (based on `.env.example`):
```env
# Toggle client vs server execution
EXPO_PUBLIC_AI_MODE=backend
# The URI of your Express endpoint
EXPO_PUBLIC_AI_BACKEND_URL=http://localhost:3000
```
Restart the Expo app. The "Add via AI" tab will now sequentially route texts to the backend! Switch `EXPO_PUBLIC_AI_MODE=offline` to cleanly sever the network dependency and run the identical heuristics natively on the client.

---

## Project Structure

```
components/   # Reusable UI components
  BottomNav.tsx
  CouponCard.tsx
  CouponForm.tsx
  ConfirmDialog.tsx
pages/        # Full-page screens
  WalletPage.tsx
  AddEditPage.tsx
  SettingsPage.tsx
lib/          # Shared logic (types, utils, storage)
  types.ts
  utils.ts
  storage.ts
  importExport.ts # Exports dynamically resolve to platform-specific code
App.tsx       # Root component with state management
```

---

## Version History

| Tag | Description |
|---|---|
| `v2.0.0` | Phase 2 "WOW" Release (Dark Theme, Urgency Inbox, Insights, Gift Cards) |
| `v1.0-web` | Original React + Vite web-only version |

---

## Final Hardening Changelog (`v2.0.1+`)

- **Strict Dependency Alignment**: React and React-DOM successfully downgraded and locked to version `18.2.0` to comply strictly with React Native `0.76.x` peer validation logic, completely eliminating the need for `--legacy-peer-deps`.
- **Repo Hygiene & Expo Strictness**: Leftover DOM-based web (`src/`) directories were deleted, explicit `.gitignore` exclusions were established for `node_modules/` and `.DS_Store`, and `app.json` was safely encapsulated into the standard `{"expo": ...}` canonical object container. 
- **Expo-Router Purged**: To cleanly maintain a single `App.tsx` state-managed runtime without hybrid overlap, Expo Router instances were eradicated everywhere (from `app.json` plugins down to the deletion of the `app/` file-based routing architecture).
- **Type-Safe File Subsystems**: Split import/export functionalities forcefully into abstract `global-css.web.ts` and `importExportImpl.native.ts` extensions, securing zero compilation overlap between cross-platform web DOM APIs and Android/iOS Native execution!

### Definition of Done
- [x] `npm install` absolutely succeeds out-of-the-box perfectly without requiring `--legacy-peer-deps`.
- [x] `npx expo doctor` signals an entirely green build.
- [x] `npx expo start -c` and `npm run web` bundle correctly against the single codebase. 
- [x] `npm run typecheck` issues zero warnings across the new TS/Expo layout.
- [x] Built-in tracking of `npm audit --omit=dev` verifies the application code holds zero dev-exclusive vulnerabilities. Any remaining warnings point directly to transitive Metro/Jest configuration tooling managed externally by Expo.

---

## Setup & Verification ✅

To confirm the repository is strictly aligned and deterministic, run the following sequence:

```bash
# 1. Clean deterministic install (No legacy-peer-deps needed)
rm -rf node_modules package-lock.json
npm install

# 2. Verify Expo ecosystem alignment
npx expo doctor
# Optional fix: npx expo doctor --fix-dependencies

# 3. Verify TypeScript integrity
npm run typecheck

# 4. Start the Web or Native target
npx expo start -c
npm run web
```

## Security & npm audit policy 🛡️

- **We run `npm audit --omit=dev`** to assess production risk.
- **We do NOT use `npm audit fix --force`** because forcefully updating transitive dependencies breaks Expo and React Native compatibility.
- If the audit flags transitive tooling dependencies (e.g., `minimatch` or `glob` via Expo/Metro), we document them and address them exclusively via official Expo SDK upgrades, rather than forceful overrides.

**Example CI Command:**
```bash
npm audit --omit=dev --audit-level=high
```

### Phase 4: Production Hardening
Currently, the app requires minimal external infrastructure to maintain speed and safety:
- **Session Id Propagation:** Every client launch generates a unique `sessionId` which is passed alongside a `requestId` to the backend via the `X-Session-ID` header. This ensures isolated backend logs correlate strictly with frontend flows without relying on raw PII text.
- **Idempotency Key:** To prevent duplicate wallet entries resulting from double-saving or UI lag, every AI extraction flow generates an `idempotencyKey`. It's stored with the local Coupon/Voucher entity; if another save attempt is made with the identical key before the screen resets, it is safely blocked.

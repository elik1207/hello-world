# 🎟️ Coupon Wallet

A personal coupon & discount manager app. Store, organize, and track your coupons — never miss a deal or let one expire.

> **Note:** The `v1.0-web` tag contains the original React + Vite web version. The `master` branch is being migrated to **Expo (React Native)** for cross-platform support on Android, iOS, and Web.

---

## Features

- 🎨 **Premium Dark Theme**: A stunning, high-contrast dark aesthetic that feels modern and native.
- 🎁 **General Wallet**: Store not just Coupons, but also Gift Cards (with remaining balances) and one-time Vouchers.
- ⏳ **Urgency Inbox**: Smartly groups items by expiration (Expiring Soon, This Month, Safe) with visual edge-color indicators.
- 📊 **Financial Insights**: Tracks your "Trapped Value" (active funds) and "Lost Value" (expired funds).
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
| Storage | AsyncStorage |
| Icons | lucide-react-native |
| Language | TypeScript |

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

---

## Project Structure

```
app/          # Expo Router entry points
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
App.tsx       # Root component with state management
```

---

## Version History

| Tag | Description |
|---|---|
| `v2.0.0` | Phase 2 "WOW" Release (Dark Theme, Urgency Inbox, Insights, Gift Cards) |
| `v1.0-web` | Original React + Vite web-only version |

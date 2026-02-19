# 🎟️ Coupon Wallet

A personal coupon & discount manager app. Store, organize, and track your coupons — never miss a deal or let one expire.

> **Note:** The `v1.0-web` tag contains the original React + Vite web version. The `master` branch is being migrated to **Expo (React Native)** for cross-platform support on Android, iOS, and Web.

---

## Features

- ➕ Add coupons with title, discount (amount or %), store, category, expiry date, and promo code
- 🗂️ Tabs: Active / Used / Expired
- 🔍 Search and sort by expiry date
- ✅ Mark coupons as used / restore to active
- 🗑️ Delete individual coupons
- 📤 Export coupons as JSON
- 📥 Import coupons from JSON
- 🧹 Clear all data
- 💾 Persistent local storage (no server needed)

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
| `v1.0-web` | Original React + Vite web-only version |

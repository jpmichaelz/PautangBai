# PautangBai — Release Checklist

Pre-flight checklist for Android APK / Google Play Store release.

---

## 1. App Configuration & Branding

- [x] **App Name**: `PautangBai`
- [x] **Package Name**: `com.pautangbai.app`
- [x] **Version**: `1.0.0`
- [x] **Splash Screen Background**: Forest Green `#173D35`
- [x] **Mascot Asset**: Bai the Frog vectors included and rendered across all states.
- [x] **Orientation**: Fixed to `portrait`.

---

## 2. Core Functional QA

- [x] **Offline Database**: SQLite migration (`v1.ts`) executes without warnings on clean install.
- [x] **Financial Accuracy**:
  - Centavo precision (minor units).
  - Allocation against interest fee first, then principal.
  - Payment capped at total remaining balance.
  - Reverse/void restores loan balance and active status.
- [x] **Idempotent Sync**:
  - Outbox queue persists operations with UUIDs.
  - Push order respects `Borrower -> Loan -> Payment`.
  - Re-pushing existing idempotency keys returns duplicate status without double-recording.
  - Cursor-based pull updates SQLite without clobbering dirty local outbox items.

---

## 3. Security & Storage

- [x] Auth token stored securely via `expo-secure-store`.
- [x] Sensitive user secrets never saved in plain text SQLite tables.
- [x] No personal financial logs sent over unencrypted endpoints.

---

## 4. UI & Accessibility

- [x] Touch targets at least 44pt / 48dp on all interactive elements.
- [x] Contrast ratio conforms to WCAG standards across Dark Forest and Mint tokens.
- [x] Safe area insets respected on top and bottom navigation bars.
- [x] KeyboardAvoidingView applied to all modal forms and login screen.

---

## 5. Build Commands

- **Local Android APK Test Build**:
  ```bash
  cd mobile
  npx expo run:android --variant release
  ```
- **EAS Cloud Production Build (AAB)**:
  ```bash
  eas build -p android --profile production
  ```

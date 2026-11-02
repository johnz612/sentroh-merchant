# Sentroh Merchant

Android app (Expo) for Sentroh stores: new-order alerts, accept / stock issue /
ready / pickup, products (on/off, edit, photos), store hours, pause and
auto-accept, deposit. Backend: `sentroh-platform/apps/marketplace-api`.

## First-time setup (Windows, in D:\Sentroh\sentroh-merchant)
1. `npm install`, then `npx expo install --fix` (aligns package versions with Expo SDK 57).
2. `copy env.example .env` and fill in the three values: the same DEV Supabase URL
   and anon key as the customer app, and the API address
   (`http://10.0.2.2:4000` for the Android emulator, which is your PC as seen from it).

### Run on the Android emulator (no Expo account needed)
3. Start the emulator from Android Studio (Device Manager > play button).
   Use a system image "with Google Play" if you want push alerts later.
4. `npx expo run:android` builds the app on your PC and installs it on the emulator
   (the first build takes several minutes). After that, `npm start` and press `a`.

### Push alerts (later, optional)
New-order alerts on Android need Firebase Cloud Messaging. Without it the app
works; it just cannot receive alerts (orders still refresh every 20 seconds).
- Firebase console > new project > add Android app `com.sentroh.merchant` >
  download `google-services.json` into this folder (it is git-ignored).
- app.json already points to it (`expo.android.googleServicesFile`), so the
  file must exist before building. Then `npx expo run:android` again.
- For Expo's push service: `npx eas-cli login`, `npx eas-cli init`, then
  `npx eas-cli credentials` > Android > Google Service Account > upload the FCM V1
  key (Firebase > Project settings > Service accounts > Generate new private key).
  Never commit these files.

### Real phone (later)
`npx eas-cli build --profile development --platform android`, install the APK,
and use your PC's Wi-Fi address as the API address.

## Every day
- Start the API (`npm run dev:api` in sentroh-platform), the emulator, then here: `npm start` and press `a`.
- Code changes load live. Run `npx expo run:android` again only after adding native packages.

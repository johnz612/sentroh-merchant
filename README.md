# Sentroh Merchant

Android app (Expo) for Sentroh stores: new-order alerts, accept / stock issue /
ready / pickup, products (on/off, edit, photos), store hours, pause and
auto-accept, deposit. Backend: `sentroh-platform/apps/marketplace-api`.

## First-time setup (Windows, in D:\Sentroh\sentroh-merchant)
1. `npm install`, then `npx expo install --fix` (aligns package versions with Expo SDK 57).
2. `copy env.example .env` and fill in the three values (same DEV Supabase URL and
   anon key as the customer app; the API address is your PC's Wi-Fi address,
   e.g. `http://192.168.1.7:4000`, because the phone cannot use localhost).
3. `npx eas-cli login`, then `npx eas-cli init` (creates the EAS project and adds
   its id to app.json).
4. Push alerts on Android need Firebase Cloud Messaging:
   - Firebase console > new project > add Android app `com.sentroh.merchant`.
   - Project settings > Service accounts > Generate new private key (JSON).
   - `npx eas-cli credentials` > Android > development > Google Service Account
     > "Manage your FCM V1 service account key" > upload that JSON.
   Never commit the JSON or google-services.json.
5. Build the development app once: `npx eas-cli build --profile development --platform android`,
   then open the link on your phone and install the APK.

## Every day
- Start the API (`npm run dev:api` in sentroh-platform), then here: `npm start`.
- Open the Sentroh Merchant app on the phone; it connects to your PC (same Wi-Fi).
- Code changes load live. Rebuild (step 5) only after adding native packages.

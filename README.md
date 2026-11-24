# MyBodyTrack — v0.1 mobile-first PWA
**Your Food. Your Body. Your Goals.**

This is a runnable local prototype plus deployment-ready-in-structure source code. It is not a live hosted site yet. The frontend is deliberately dependency-light (HTML, CSS and modular JavaScript), rather than requiring React compilation. Firebase and Gemini are optional until configured. No secret credentials are included.

## 1. Try it now
- Open the separately supplied `MyBodyTrack-Demo.html` in Chrome or Edge, click **Explore local demo**, enter your profile, goal and meal deadlines, then open the dashboard.
- Or extract this ZIP, open a terminal in `web`, run `python -m http.server 8000`, and visit `http://localhost:8000`. On Windows you can also run `START-LOCAL.cmd` from the project root if Python is installed.
- In demo mode, data stays in browser local storage. Google login, live Gemini and phone push notifications are intentionally disabled. Use **Enter nutrition manually** to test calorie/macronutrient tracking.
- Browser storage behavior for local HTML files varies; the HTTP version is recommended for persistent testing. This is not a production health app.

## 2. What is implemented
- Google-only authentication using the Firebase JS SDK (when configured).
- Adult profile setup: name, height, weight, age, sex and activity. BMI screening, BMR/TDEE estimate, target weight, safe initial pace, estimated days and editable calorie/macro goals.
- Dashboard, daily food diary, manual food entry, calorie/protein/carbs/fat totals, hydration entries, weigh-ins, chart and date history.
- Gemini API integration: Hinglish/Hindi/English text, image and audio uploads, voice recording on supported devices, editable estimates and clarification questions. No API key in frontend.
- Custom meal deadlines and count, completed/late/pending/overdue/missed states; missing logs are not assumed to be missed meals. Calorie shortfall feedback and revised goal forecast from measured weight trend.
- Meal, hydration and quote push scheduler (5-minute scan cadence) with quiet hours, repeated meal reminders until confirmed, reminders stop for explicitly missed meals, water reminders stop at daily target, configurable settings.
- Source-attributed starter quote library, favourites, sharing, original source links and separate Hinglish meaning/context. Gemini ranks approved IDs only; it cannot invent or rewrite a quote. Daily selection is cached; trending context comes from India and US Google Trends RSS when accessible. This is not a comprehensive global trends or movie rankings feed.
- Installable PWA manifest, icons, service worker caching and light/dark mode. Firebase persistence is cloud-based; offline app shell and browser cache are available. Google sign-in still requires a network connection when a session is not available.
- Export and delete personal data. Quote content, meal schedules and health data are distinct from login credentials.

## 3. Firebase (your own account)
1. Open https://console.firebase.google.com/ and create a project, e.g. `mybodytrack` (actual project ID must be unique).
2. Authentication → Sign-in method → enable **Google**. Choose your support email. Do not enable email/password.
3. Firestore Database → Create database → choose a region → production mode. Paste the provided `firestore.rules` into the Rules tab and publish. Do not use open/test rules.
4. Project Settings → General → add a Web app. Copy the public Firebase web config into `web/config.js` under `firebase`. Example:
   ```js
   window.MBT_CONFIG = {
     firebase: {apiKey:"YOUR_PUBLIC_WEB_API_KEY",authDomain:"YOUR_PROJECT.firebaseapp.com",projectId:"YOUR_PROJECT",appId:"YOUR_APP_ID",messagingSenderId:"YOUR_SENDER_ID"},
     apiBase: "https://mybodytrack-api.YOUR-SUBDOMAIN.workers.dev",
     allowDemo: false
   };
   ```
5. Authentication → Settings → Authorized domains: add your exact Pages hostname and `localhost` for testing. Google sign-in uses a popup; if a mobile browser blocks popups, open the app in its regular browser or adjust its permission. Verify sign-in and sign-out on real devices.

## 4. Gemini API
1. Open https://aistudio.google.com/apikey and create an API key for your own project. Keep it secret. Never paste it into frontend code, commit it to GitHub, or share it in chat.
2. Confirm the selected model is available in your account and accepts text, images and audio. The Worker defaults to `gemini-3.1-flash-lite`; change `GEMINI_MODEL` in Wrangler if needed. Free tier limits differ by model/account and may change. Start without billing if desired.
3. The backend restricts requests (default 8/user/day, 30 total/day including a shared quote ranking request). Lower these if your actual quota is smaller. Failed requests may still consume a local budget slot. No guarantee of a free tier forever.
4. The free-tier provider may use submitted content to improve services; the app asks for consent before sending food text, photos or audio. Avoid sending identifying or sensitive health information. No personal profile is included in food-analysis requests.

## 5. Cloudflare Worker + D1 + push setup
Requirements: Node.js and npm installed, internet access, free Cloudflare account. Run commands from `worker/`.

```sh
npm install
npx wrangler login
npx wrangler d1 create mybodytrack
```
Copy the returned database ID into `worker/wrangler.toml` (`database_id`). Set `APP_ORIGIN` to the exact URL of the Pages deployment (no trailing slash), `FIREBASE_PROJECT_ID` and `FIREBASE_WEB_API_KEY` to the values from your Firebase project, `VAPID_SUBJECT` to `mailto:your-real-email@example.com`. Set AI budget according to your quota.

```sh
npx wrangler d1 execute mybodytrack --remote --file=schema.sql
npm run keys
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_PRIVATE_KEY
npm run deploy
```
Paste the respective values only in the terminal prompt. Save the VAPID private key securely; regenerating the pair invalidates existing subscriptions. Copy the deployed Worker URL to `web/config.js`. The `web-push` package generates encrypted push request payloads, which are transmitted with Worker `fetch`. Cron checks opted-in subscriptions every five minutes. Test it with a real Android device and an installed iPhone PWA before public release. Delivery depends on permission, connectivity, OS, and free-plan resource limits.

## 6. Cloudflare Pages frontend
1. Create a private GitHub repository, upload this project (exclude secrets and node_modules).
2. Cloudflare dashboard → Workers & Pages → create Pages project → Connect to Git → choose repo.
3. Framework preset: None. Build command: leave blank. Output directory: `web`. Deploy. Pages provides an HTTPS subdomain if the project name is available.
4. Update `APP_ORIGIN`, authorized Firebase domains, and `web/config.js` with the final URLs; redeploy Worker and Pages after changes. `allowDemo:false` removes the demo button from the live app.
5. On Android Chrome, open site → menu → Install app/Add to Home screen. On iOS 16.4+ Safari, Share → Add to Home Screen, launch the installed app. In Profile, save notification preferences, then tap Enable phone notifications.

## 7. Test before sharing with users
- Two Google accounts must not see each other's data. Check Firestore Rules simulator for cross-account reads/writes. Verify login, logout, deletion and cloud recovery on another device.
- Test food photo, voice note and mixed-language text; check actual model response and quota. Do not rely on AI for exact nutritional amounts.
- Test meal completion stops notifications, overdue and missed states, late completion, quiet hours, midnight reset, water goals, and quote deep links. Browser notifications open relevant screen for confirmation (not a direct background mark-done action).
- Verify network loss, offline cached data, expired auth and push permission denial. If dependency installation fails, check network and npm registry access.

## 8. Prototype limitations and production hardening
- Browser frontend flow was exercised in a 390×844 Chromium page with a mocked local-storage adapter. JavaScript syntax checks passed. Live Firebase, Gemini, dependency installation, cloud deployment and push delivery were not tested in the creation environment. npm registry access was unavailable.
- Small starter quote library only. Expand it with rights-cleared, original, independently verified entries; never use AI as the verification source. No full catalogue of series or current movie rankings. Short sourced film excerpts in starter library are for evaluation; obtain rights/review applicable copyright before public/commercial distribution. To add entries edit `web/quotes.js`, then mirror into `worker/src/quotes.js` (replace `window.MBT_QUOTES =` with `export default`). No repetition for scheduled quotes per device until catalog exhausted. The daily dashboard may display a previously seen quote; more verified content is required for long-term variety. Some preferences have no entries yet.
- This starter stores each user's complete state in one Firestore document (1 MiB maximum); suitable for limited personal testing, not long-term high-volume data. Before public use, split historical daily entries into per-day documents, add offline reconciliation and concurrency-safe updates. Current sync is last-write-wins across devices. Browser cache is best-effort; do not assume it is a backup. Export regularly.
- Scheduler processes a limited batch (20 subscriptions per scan); larger user bases need a durable queue, per-user deduplication, retries, metrics, rate limiting and load tests. Notifications can be late or fail. Quote ranking falls back to curated order when trend/AI is unavailable. User can mark overdue items missed or late; there is no assumed missed meal from lack of logging.
- Weight forecast is an estimate based on chosen pace until there are at least seven days between measured weigh-ins, then uses measured trend. It does not assign an exact number of delay days to one meal. Avoid shame, pressure, or gender-based hostility. No guarantees of health or body changes. Adult-only BMI thresholds, general calorie estimates; seek a clinician if weight is unexpectedly decreasing or if medical conditions affect diet. Before releasing to others, add a privacy policy, terms, consent, appropriate rights and health review.
- Provider quotas and pricing change. Official reference links below. A custom domain is optional and normally costs money. Do not enable paid billing without reviewing costs.

## Official references
- Firebase Google auth: https://firebase.google.com/docs/auth/web/google-signin
- Firebase pricing: https://firebase.google.com/pricing
- Gemini API pricing: https://ai.google.dev/gemini-api/docs/pricing
- Cloudflare Workers Node compatibility: https://developers.cloudflare.com/workers/runtime-apis/nodejs/
- Cloudflare Workers limits: https://developers.cloudflare.com/workers/platform/limits/
- Google Trends: https://support.google.com/trends/answer/3076011?hl=en-IN

## Files
- `web/`: complete frontend, configuration, PWA service worker and icons.
- `worker/`: API, D1 schema, Wrangler config, quote scheduler.
- `firestore.rules`: private per-user database access.
- `START-LOCAL.cmd`: Windows local development helper.

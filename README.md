# Nourish&Thrive (Android)

The Nourish&Thrive app as an Android app.

- `web/index.html` is the app itself (login, saving to Supabase, AI coach).
- `web/appHtml.js` is the same page packed for the Android app. Rebuild it after changing `index.html`:
  `node -e "const fs=require('fs');fs.writeFileSync('web/appHtml.js','// Generated from web/index.html. Do not edit by hand.\nexport default '+JSON.stringify(fs.readFileSync('web/index.html','utf8'))+';\n')"`
- `web/admin.html` is the coach panel (at /admin on the test website).
- After changing `web/gate.js`, run `node web/build.js`.
- `App.js` shows the page full screen on the phone.
- Every push to `main` builds a new APK on Expo (see the Actions tab). Download it from expo.dev.

Backend: Supabase project `jzctsfvowmuowfxaiayy` (tables `profiles`, `user_data`; edge function `ai`).

## Test branch AI limits

`test` uses `ai-feature-test` (source in `supabase/functions/ai-feature-test/index.ts`).
The production `ai` and previous `ai-test` functions stay unchanged. Test-only counters
are stored in `ai_feature_usage`; setup SQL is in `tools/supabase/ai-feature-limits.sql`.
The table has RLS and no client grants; only the service role can call its counter RPCs.

Every account gets 5 generations per feature per day: shopping lists, Shop builds
(all My day / Picks / Takeaway / Week modes combined, except lists), recipes,
makeovers, check-in feedback, weekly insights, mindset notes, exercise help, food
estimates, food photo scans, step scans, equipment scans and other AI requests.
Coach has a separate 20-message allowance. All reset at midnight Europe/London.
The counters are atomic and account-wide. This new test allowance starts fresh;
previous aggregate usage stays untouched. Viewing/deleting saved content uses no quota.

Opening a Discover, Saved or AI recipe shows Make shopping list for the selected
servings; the generated list is saved under Food > Lists.

Verify with the scripts in `tools/tests/`, especially `ai-feature-limits.test.js`
and `recipe-shopping.test.js`.
To undo this update, revert its commit on `test` and push: it restores the previous
endpoint and UI. No user data or old counters need restoring. The unused
`ai-feature-test` function and its test counters may be removed separately.

## RevenueCat Test Store connection (`test` only)

Open Your account > DropASize Premium in the Android test build to fetch the current
monthly offering, make a simulated purchase, restore it or refresh status. The
RevenueCat SDK identifies customers with their signed-in Supabase UUID. Web is a
preview and does not accept payments. The public `test_` SDK key is intentional.

This is a purchase integration test, not a production entitlement authority. Client
results are not written to profile.paid or used to authorise server AI access.
Backend subscription verification, production feature gates, invitations and admin
plan management must be implemented before launch. Replace the Test Store SDK key
with Google Play's SDK key and complete store setup before any store release.

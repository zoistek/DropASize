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

`test` sends AI requests to the separate Supabase function `ai-test` (source in
`supabase/functions/ai-test/index.ts`). The existing production `ai` function is unchanged.
Each account, including coaches, gets 5 non-chat AI generations combined and 20 Coach
messages per day, resetting at midnight Europe/London. The existing atomic `ai_take` /
`ai_refund` RPCs enforce this using the `recipe` and `chat` usage buckets. Counters are
account-wide and shared with existing usage of those buckets, not reset by reinstalling.
Viewing or deleting saved builds does not spend or restore an allowance.

Verify: `node tools/tests/ai-limits.test.js` and `node tools/tests/saved-builds.test.js`.
To roll back, revert the AI-limits commit on `test` and push. This restores the previous
endpoint; no database schema, user data or production function needs restoring. The
unused `ai-test` function may then be removed.

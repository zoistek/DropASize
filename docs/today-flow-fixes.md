# Today, check-in, cooking and image saving

These changes are confined to `test`. Pushing this branch updates the test website;
it does not run an Expo cloud build.

- My Why opens the existing statement editor. Sparse onboarding records receive
  the expected default fields, and failed saves keep the editor open.
- Check in saves all entered fields before any insight request. It does not call
  AI or change calorie targets. Weekly insights remain hidden until the member
  explicitly requests them. Check-in-only weeks are included in the report even
  when no food or activity has been logged.
- Today’s What can I eat button navigates to Coach Meals.
- Every expanded Coach Meals recipe has Start cook mode. It reuses the recipe
  library’s existing step viewer, splitting the saved method into instructions.
  Completing cooking logs the displayed portion, just like the recipe library.
- Weekly and before/after cards have an explicit image-save action. On the website
  this downloads the PNG to the browser’s download destination. Browsers cannot
  choose or guarantee the phone’s Gallery folder. In an updated Android APK, the
  native bridge writes the PNG into MediaStore so it appears in Gallery.

Android 10+ uses app-created-image access without reading the photo library.
Android 9 and older request write permission only; the manifest caps it at API 28.
Broad photo, video and audio read permissions remain blocked. Temporary PNGs are
deleted after saving, including when the native save fails. Installed older APKs
do not have the gallery bridge and report that an app update is needed.

## Checks

`node tools/tests/today-flows.test.js` exercises My Why editing, saved check-ins,
explicit insights, check-in-only reports, Coach Meals recipe expansion and cooking
steps, browser downloads and native save acknowledgements with mocked services.
`node tools/tests/gallery-save.test.js` checks native payload validation, older
Android permission handling and cleanup. Related signup, recipe shopping, Android
layout/login and billing regression tests also pass. Expo config introspection
confirms the write-permission cap and removal of broad media-read permissions.

No APK was built. Saving to a real phone gallery still needs testing after the next
explicitly agreed APK update. Browser rendering could not be checked because the
local browser process cannot launch in this environment. ESLint and TypeScript
checks were attempted but their tools are not installed or cached; embedded script
parsing, focused runtime tests and native config checks were used instead.

Revert the flow-fixes commit to undo the changes together; no database schema or
stored user records were changed by deployment.

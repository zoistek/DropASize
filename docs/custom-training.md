# Custom coach training on test

## Coach workflow

Admin > Training plans > Custom training opens the session builder. Give the plan
a name, target session duration, start date, number of weeks and training days.
The same custom session repeats on those selected days. Add exercises from the
existing catalog or saved custom exercises, choose seconds and reps, and insert
rest slots. Each addition, removal or duration change updates used/remaining time.
Over-budget sessions cannot be saved or assigned until corrected. Sessions may be
shorter than their target; the member sees the actual scheduled duration.

Training plans > All exercises opens the shared library with name search,
View / edit and Delete for built-in and custom exercises. New custom exercises
are stored in the existing config/custom-exercises database document and appear
in this library and the custom builder. Built-in edits override catalog entries
by stable ID, preserving their illustration URLs. Deletion hides an entry from
future custom selections; Show deleted exercises allows Restore. Existing default
workouts and saved/assigned plan snapshots are unchanged.

The generated catalog contains 175 existing exercise names and the rest durations
already present in app workouts. `web/buildTrainingCatalog.js` extracts these from
the app's canonical definitions during `node web/build.js`, so the admin library
is not a separate hand-maintained exercise list.

Create custom exercise accepts name, detailed movement instructions, reps, seconds
and optional image guidance. Generate/Redo creates a matching before/after pair.
A completed pair is saved immediately with the exercise and added to the open
session. The coach can review it and save further edits. Form details and returned
image URLs are also backed up as a local draft; a failed cloud save can be retried
without generating again. A failed generation keeps previous images. Saving again
updates the existing session slot rather than adding a duplicate.
Editing a custom exercise updates matching slots in the open builder while keeping
their chosen durations/reps. Previously assigned plans retain their own snapshot.

Search member names or emails, select recipients and click Assign custom plan.
The template is saved first; assignments write the existing managed `coach-plan`
key for each selected member. Failures are reported per recipient, and successful
recipients are removed from the retry selection. Save plan and a fully successful
assignment close the builder; errors keep it open for correction or retry. No existing member was assigned
a plan during implementation. The existing per-member template selector also
understands these custom templates.

## Member workflow

The assigned session uses the existing workout timer, explicit rest screens,
illustrations and workout logging. Custom exercise images are displayed in the
same illustration component. Custom schedules support one to seven days without
changing the default plan scheduler. The Today training link shows the custom
workout's name.

An open/visible app checks coach changes every 30 seconds; a closed app loads them
on its next sign-in/open. The branded OK popup says the coach changed the training
plan. OK acknowledges that assignment in the member's synced data, so it does not
repeat for the same version. A later assignment produces a new popup. The Train
screen refreshes its plan after acknowledgement.

## AI Studio setup

`coach-training-images-test` is deployed with JWT verification enabled. It checks
active coach access again internally and uploads through the coach's existing
Storage permissions. It does not use a service-role key or require new database
tables/policies. Images use the existing public recipe-images bucket under a
coach-exercises prefix; these are synthetic illustrations, not member photos.

The existing GitHub secret named VOICE is a Gemini API key, used by both the voice
and exercise-art workflows. Supabase cannot read GitHub secrets. Add **VOICE** to
Supabase > Edge Functions > Secrets using that same AI Studio key. Alternatively,
GEMINI_API_KEY is accepted. Do not put the key in client code or in GitHub files.
The live endpoint reported `key_ready=true` after the key was configured.

The default image model is gemini-3.1-flash-image, matching the current art workflow;
GEMINI_IMAGE_MODEL can override it. The backend makes one start-pose request, then
uses that image as a reference for the end-pose request. No generation is automatic
and there are no silent retries. Missing/invalid keys, model access, quota/billing,
timeouts, provider failures, blocked/no-image responses and upload failures have
clear messages. Partial uploaded pairs are cleaned up. Generated anatomy and pose
accuracy still require the coach's visual review.

The coach has successfully generated image pairs. The save/close fixes use mocked
checks without further image generation or AI charges. A real member-device
notification still needs a user-controlled end-to-end check.

## Verification and rollback

`node tools/tests/custom-training.test.js` covers timing, overrun validation,
assignment snapshots, rest slots without implicit extra rests, one-to-seven-day
schedules, existing player/log wiring, custom artwork and acknowledged notices.
`node tools/tests/exercise-library.test.js` covers library merging, name search,
persistent edits, deletion/restoration and preserved artwork.
`node tools/tests/custom-training-save.test.js` covers immediate exercise saving,
failed-save retry, duplicate prevention and successful save/assign popup closing.
`node tools/tests/training-images.test.js` covers auth, two-image requests, redo
guidance, provider/error cases, upload cleanup and key leakage using mocks.
Related signup, Today, moderation and Android regression checks pass. JavaScript
parsing and TypeScript stripping pass; ESLint/TypeScript CLI tools are unavailable
in this checkout. Browser layout and physical-device behavior have not been checked.

Everything is on test. No APK was built and main was not merged. Revert this feature
commit to restore the old UI; disable the isolated image endpoint if rolling back.
No schema rollback is needed. Existing/default plans were not changed. Assignments
are snapshots: a coach can reassign the prior template, but reverting code does
not automatically undo intentional plan assignments or delete generated images.

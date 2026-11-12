# Member moderation on test

## Deployed state

The explicitly approved SQL in `tools/supabase/member-moderation.sql` has been
applied. The protected `coach-members-test` Edge Function is deployed with JWT
verification enabled. No real member was banned, deleted or emailed during setup.
The app changes stay on `test`; no APK was built.

The migration validated normal profile and saved-data access for every existing
active account and coach dashboard access before committing. Fourteen accounts and
141 saved-data records remained unchanged. Transaction-only fixture tests confirmed:

- Active members can read and write their own saved data.
- Banned/deleted users cannot access saved data with an existing JWT.
- Ordinary members cannot call the session-revocation function.
- The service role can revoke the fixture's session.

All fixture changes were rolled back. The action/delivery ledger is inaccessible
to ordinary clients and is used only by the protected backend. The new RLS-no-policy
advisor notice on this ledger is intentional: service-role-only access was verified.

## Email configuration still required

Custom notifications use the same IONOS mailbox as Auth emails, but Edge Functions
cannot read Auth's SMTP password. Under Supabase > Edge Functions > Secrets, set:

| Secret | Value |
| --- | --- |
| `SMTP_HOSTNAME` | The mailbox's IONOS SMTP server, such as `smtp.ionos.co.uk` |
| `SMTP_PORT` | `465` |
| `SMTP_USERNAME` | The full mailbox email address |
| `SMTP_PASSWORD` | The mailbox password |
| `SMTP_FROM` | The mailbox's sender email address |

Keep passwords out of GitHub and client code. The admin status call reports whether
these variables are present. Moderation actions are disabled until they are present.
A completed ban/delete is emailed afterward; if SMTP fails, the coach sees that it
failed and can retry from the dialog or Members list, including after deletion.
SMTP acceptance is reported accurately; inbox delivery/spam placement cannot be
guaranteed. Successful records clear their stored recipient email address. Real
SMTP delivery and a full coach-browser action still need a user-controlled test.

## Controls and enforcement

Admin > Members > member > Account > Member access contains Ban, Restore access and
Delete. Coach accounts and self-moderation are blocked server-side. Delete requires
typing DELETE in a branded dialog. The optional reason appears in the email.
Ban revokes refresh sessions and blocks new sign-in. Repeated requests are recorded
once. Failed email retries do not perform the moderation twice.

The approved access rules cover profiles, saved data, coach notes, reports and
Storage. Shared documents receive write restrictions only. Existing ownership and
coach policies remain; no additional member data access was granted. This is a
shared backend, so these protections also apply to installed older APKs. The new
banned-account label requires the updated test web code or a future agreed APK.

The existing AI services were left unchanged. Automatic approval review blocked a
separate AI endpoint deployment, and that extra change was unnecessary: all three
existing AI handlers already call Auth getUser before doing work. Supabase Auth
rejects banned users and sessions deleted by the approved revocation function.
Reference: https://github.com/supabase/auth/blob/master/internal/api/auth.go

## Verification and rollback

`node tools/tests/member-moderation.test.js` checks mocked authentication,
coach/target protection, confirmation, SMTP setup, ban/unban, deletion cleanup and
post-deletion email retry. Related signup, Today, Android and AI allowance regression
checks pass. The unauthenticated live moderation probe returned 401. No real email
was sent. ESLint/TypeScript tooling is not installed or cached in this checkout;
JavaScript parsing and TypeScript stripping supplement the focused tests.

Before database rollback, revert the latest client activation commit so the test
app again tolerates an undeployed account-status RPC, or restore the pre-moderation
client version. Then apply `member-moderation-rollback.sql`. It removes the new
policies/functions but preserves private delivery records and pending emails.
The moderation endpoint disables itself when the account-status RPC is absent.
The AI endpoints do not need rollback because they were never redeployed.

Code rollback does not restore a deleted account. Bans can be reversed with Restore
access. Existing records are not deleted by either schema deployment or rollback.

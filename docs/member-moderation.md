# Member moderation on test

## Current activation blocker

The UI, protected Edge Function and notification delivery/retry code are prepared.
No real member has been banned, deleted or emailed during implementation.
Automatic approval review rejected both the first all-table policy proposal and
the smaller private-member-data policy proposal. **No migration was applied.**
Backend deployment was also rejected by automatic approval review because it changes a live endpoint. No Edge Function was deployed. The prepared Edge Function returns a setup error while `account_status` is unavailable;
moderation cannot run. Existing app access stays as before until that RPC exists.
Existing AI services are not redeployed before the schema is approved and active.

The reviewed SQL is `tools/supabase/member-moderation.sql`. It adds a service-only
action/delivery record, a self-only account-status RPC, service-only session
revocation, and restrictive policies on profiles, saved user data, coach notes,
reports and Storage. Shared documents receive write restrictions only. Existing
ownership and coach policies remain in place; no new member data access is granted.
The policies block banned/deleted users even if an access JWT has not yet expired.
This is a **shared backend**, so database changes apply to the installed app too.
No existing user records are deleted by the migration itself.

Explicit approval is needed before retrying this schema deployment. The risk is
that incorrect access rules could interrupt existing reads/writes. Fourteen
existing accounts were checked during preparation; none was banned.

## Email configuration

Custom notifications use the same IONOS mailbox as Auth emails, but Edge Functions
cannot read Auth's SMTP password. Under Supabase > Edge Functions > Secrets, set:

| Secret | Value |
| --- | --- |
| `SMTP_HOSTNAME` | The mailbox's IONOS SMTP server, such as `smtp.ionos.co.uk` |
| `SMTP_PORT` | `465` |
| `SMTP_USERNAME` | The full mailbox email address |
| `SMTP_PASSWORD` | The mailbox password |
| `SMTP_FROM` | The mailbox's sender email address |

Keep passwords out of GitHub and client code. Moderation actions are disabled
until these settings are present. A completed ban/delete is emailed afterward;
if SMTP fails, the coach sees that it failed and can retry from the dialog or the
Members list, including after the account has been deleted. SMTP acceptance is
reported accurately; inbox delivery and spam placement cannot be guaranteed.
Successful notification records clear their stored recipient email address.

## Enable after approval

1. Apply the reviewed SQL and run transaction-only active/banned/deleted access tests.
2. Deploy `coach-members-test` with JWT verification enabled.
3. Deploy the prepared account-status checks in `ai`, `ai-test` and `ai-feature-test`.
   Do not deploy these AI files before the account-status RPC exists.
4. Confirm SMTP secrets and use a user-controlled disposable account for a real
   ban/unban/email test, followed by deletion only with explicit consent.
5. Re-test normal member/coach login and data sync. No APK build is needed to check
   the test website. The installed app needs a future agreed update for its new
   banned-account label; server restrictions also protect older app versions.

The new controls are under Admin > Members > member > Account > Member access.
Coach accounts and self-moderation are blocked server-side. Delete requires typing
DELETE in the branded confirmation dialog. An optional reason appears in the email.
Ban revokes refresh sessions and blocks new sign-in; Restore access is available.
Repeated requests are recorded once; retries do not perform the moderation twice.

## Verification and rollback

`node tools/tests/member-moderation.test.js` runs mocked auth, coach/target protection,
confirmation, mail setup, ban/unban, deletion cleanup and email retry checks. These
are not tests against real accounts, SMTP or the proposed database policies.
Related frontend and AI checks run separately. ESLint/TypeScript tooling remains
unavailable in this checkout; JavaScript parsing and TypeScript stripping are used.

Before any SQL rollback, restore the prior AI Edge Function versions and revert the
client moderation changes. Then apply `member-moderation-rollback.sql`. It removes
the new policies/functions but preserves the private action ledger and pending
emails. Rolling back code does not restore a deleted account; bans can be undone
using Restore access. No database rollback is currently needed because deployment
was blocked before execution.

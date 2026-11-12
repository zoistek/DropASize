# Email signup after the quiz

The test branch adds email, password and confirm-password fields beside the existing
Google option. Signup sends a Supabase confirmation email. The member enters its
code in the branded verification screen, which verifies it with Supabase before
saving a session and completing the staged quiz. Passwords are not stored in the
quiz draft. Google sign-in is unchanged.

## Required hosted setting

The connected Supabase tools cannot change hosted Auth email templates. In project
`jzctsfvowmuowfxaiayy`, open Authentication > Emails > Templates > Confirm signup
(the dashboard may label this Email Templates). Keep a copy of the current template
for rollback, then replace the body with `supabase/templates/confirmation.html`.
Suggested subject: `Your DropASize verification code`.

Keep Confirm email enabled. Public Auth settings were checked during implementation:
email and Google are enabled, signup is enabled, and email auto-confirmation is off.
Do not change SMTP or recovery email settings. The confirmation template includes
both the code and the existing confirmation link so older installed APKs can still
confirm by link.

## Verification before an Android build

On the test website, finish the quiz and tick the required consent boxes. Use an
email you control, check password mismatch handling, sign up, and enter the emailed
code. Confirm that an incorrect code stays on the verification screen; a valid code
opens the saved plan without repeating the quiz. Log out and log in using the new
email and password. Also check Google onboarding and normal Google login. Sending
real mail and completing Google sign-in require a user-controlled test account.

`node tools/tests/email-signup.test.js` checks the auth flow with mocked responses.
`node tools/tests/google-onboarding.test.js` checks the unchanged Google handoff and
quiz restoration. These checks do not prove real email delivery or device behavior.

Pushes to `test` publish only the test website. No Expo APK build is required or
authorized by this change. To undo the app changes, revert the email signup commit;
the template remains compatible with the previous app via its confirmation link.

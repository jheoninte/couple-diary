# Login and couple invitation UX

User authorizes improving existing flows with judgment, local review, and no TestFlight uploads. Keep Firebase password auth for this iteration. Apple sign-in is a future option; Google plus privacy-equivalent sign-in and account linking add scope. No production account settings or data changes.

1. Login HTML/JS: dedicated reset mode, preserved email between modes, duplicate-signup login recovery without copying password, visibility controls, accessible status, password manager hints and resend cooldown. Preserve generic recovery response against enumeration. Test duplicate signup, errors/re-enabled buttons, reset without password and rate limit.
2. Invitation HTML/JS: mutually exclusive invite/join choices, grouped 16-character code with copy/share fallback, tolerant whitespace/hyphen input, no auto-join or automatic disconnection. Explain existing space and expired/single-use codes. Reuse current server authorization and archival rules. Test normalization, ownership/single-use/expiry already covered by service tests; verify two-user flow in emulators.
3. Run checks/tests and browser QA at iPhone size and desktop; keep Vite emulator preview visible. Do not archive, upload, or deploy.

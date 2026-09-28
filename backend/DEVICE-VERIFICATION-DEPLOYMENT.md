# Device identity verification — source-only, 2026-09-28

## Scope and safety boundary

This is an operator-attested **identity mapping**, not remote face enrollment, biometric proof signed by hardware, admission authorization, membership activation or session consumption. No SDK write/enrollment/delete/biometric-template calls are implemented. No real user or device has been verified by this development run.

All approved personal roles can request a club mapping. Shared club-manager accounts are deliberately excluded from personal enrollment; their dashboard button opens the management/roster page and explains the need for a separate personal account. Do not silently convert a shared account or create one biometric identity for multiple login phone aliases.

Canonical states per person/club are `unregistered`, `pending`, `verified`. Reason fields represent cancellation/re-enrollment without creating a fourth public state. The initial version supports one verified device/member mapping per person/club. Device serial ownership is club-scoped; the same serial/member cannot belong to two verified accounts. A club can have several bridges, but a live 15-minute claim belongs to exactly one bridge. The key is scoped to this identity workflow and cannot consume sessions. Conversely an attendance trial token cannot verify identity.

Site request -> durable D1 pending row -> operator fetches requests -> selects person and confirms physical identity -> obtains 15-minute challenge -> person scans at terminal -> read-only SDK fetch verifies serial and finds a matching fresh event -> explicit operator confirmation -> server validates and atomically marks mapping -> site refresh displays checkmark.

Raw verification/punch codes are not interpreted as proof of face vs fingerprint or entry direction. The operator explicitly attests watching a successful face/fingerprint scan; the club-held bridge credential is trusted for this attestation. Protect it accordingly. Photo upload is unrelated. Device biometric registration itself remains a local action by authorized staff. The Gym Pulse database integration is NOT implemented.

## Deploy deliberately, without overwriting existing config

1. Back up the intended D1 database with the established deployment procedure. Apply only additive `migrations/006-device-verification.sql` (base runtime and club migration 003 must already exist). It is re-runnable. The attendance pilot's migrations 004/005 are separate prerequisites only if deploying that pilot too.
2. Bundle `worker.js` with BOTH imported modules `attendance-pilot.js` and `device-verification.js`. Do not upload the worker as a single isolated file. Preserve bindings and all secrets.
3. Keep `DEVICE_VERIFICATION_ENABLED` unset/false until migration and rollout are verified. Enable it as `true` for controlled testing. Disabled routes return 503; existing user listing returns a disabled field without accessing new tables.
4. Publish the current versions of `device-verification.html`, `device-verification.js`, `access-control.js`, `access-center.js`, `mg-api.js`, and `sw.js`. Include the previously changed `access-center.html` and `support.html` for their script version. New page is private, noindex and excluded from the sitemap. Never cache authenticated API responses.
5. Support opens the new page, chooses the actual club and verifies the device serial before issuing a 30-day bridge credential. It is shown once and stored hashed in D1. Deliver only to the authorized club operator, never to athletes, public ZIPs, Git or screenshots. Revoke old/lost keys. Deactivated support issuer also disables its bridges.
6. Extract the portable ZIP. Run `START-DEVICE-VERIFICATION.cmd` (64-bit Windows, existing working SDK COM required). Pair using the new club verification key, not the trial key. Local credentials, claim jobs and captured event files use Windows CurrentUser DPAPI. No silent remote registration occurs.
7. Fetch requests. Match the person and exact device member ID locally. If necessary, enroll on the terminal first. Start challenge BEFORE a fresh scan; then read and confirm. Do not use a stale attendance entry or merely type a number and mark verified. Shared SDK capture mutex prevents our two apps capturing concurrently; it cannot coordinate Gym Pulse. Use a controlled quiet window and avoid simultaneous legacy connections.
8. Website user and staff refresh their pages. Manager and secretary see only their club; support sees all. Verify pending -> verified plus column/checkmark. Retry should not create another mapping. Test wrong member, expired challenge, invalid key and cross-club access. No session/payment should change.

## Offline and recovery

Requests remain pending on the server until explicitly verified. First pairing, fetching requests, obtaining a claim and final acknowledgment require internet. Device reads use the local network. If connectivity is lost after the read, leave the application open and retry final submission within the 15-minute claim. A server-accepted response lost in transit can be retried idempotently. After expiry/restart begin a fresh challenge and scan again; no automatic offline verification is claimed. Closing the app never marks a person verified.

An administrator/secretary can reset only within their club, or support globally. Reset clears the site's mapping and active challenge and logs the actor; it does not delete device templates or touch Gym Pulse. The user may re-request. Resetting the site's mapping does not yet invalidate independent attendance-pilot credentials; revoke those separately if needed. They remain deliberately separate workflows.

## Validation / remaining acceptance

Unit tests use real SQLite constraints with synthetic users and a mock SDK. New tests cover access/consent, role/shared-account guard, deduplication, serial ownership, key hashing/revocation, claim ownership/expiry, fresh observation and explicit attestation, uniqueness, no payment/entry mutations, reset and scoped rosters. Browser DOM tests cover non-auto-submission, pending rendering, shared account behavior, three states and text escaping. Desktop parser/dependency and fake-device tests pass.

Chrome connection failed during visual QA; no screenshots or completed mobile visual inspection are claimed. Desktop interactive visual QA also remains pending; dependency/parser checks are not a substitute. Real xFace100 acceptance, production migration/deployment, device serial mapping and real bridge issuance have NOT been done. No commit/push has been made.

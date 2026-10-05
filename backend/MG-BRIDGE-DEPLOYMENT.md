# Unified web bridge — 2026-10-05

Production rollout authorized and applied on 2026-10-05. Fresh D1 and Worker backups were saved privately before migration. Worker version `563d6449-a1c0-4865-81ba-e03dfdfcc799` enables MG_BRIDGE_ENABLED. Record counts preserved: 10 users, 1 club, 0 orders, 0 payments; foreign-key check passed. Real hardware/authenticated acceptance remains pending. No actual member mapping, trial grant or SMS was performed during deployment.

## Implemented scope

- One per-Windows-user agent, one installation credential, no Gym Pulse reads or writes.
- Staff console: `club-attendance.html`. Entry through support/manager/secretary account center's attendance/download tab and dashboard link. Athletes see own mapping and trial balance only.
- Support authorizes a 16-hex-digit pairing code derived from a locally generated 256-bit secret; pairing deadline 10 minutes. Full secret never appears in UI, Git or downloads. Agent stores it using Windows CurrentUser DPAPI. Server stores its hash after claim. Support can revoke or re-pair (with a new code); inactive issuer fails authentication. One station per serial.
- Device serial and private IPv4 are configured once by support. Every capture verifies serial; operator never types it in the agent.
- Read-only SDK polling, default 15-second cycle, 90-second child timeout, 100,000-row read ceiling. No claimed real-time callback support. No device feedback/door command, clock writes, template reads or remote enrollment.
- Only observations after station authorization are persisted. Full SDK buffer may nevertheless be read into memory.
- New member mapping requires a scan in the last 10 minutes, a known approved personal phone account, and staff attestation. Device ID is a string (leading zeros preserved). No matching by name or assuming ID 439.
- Events and sync receipts are durable/encrypted locally. Deduplication on server uses device/member/time/raw codes. It is not a hardware-issued event UUID. Client-supplied decisions/balances are never authoritative.
- Offline labels are advisory from a server snapshot valid at most 24h. Unknown, inactive, no-plan, expired, exhausted estimate, same-day and pending-review statuses are distinguished. Site does not receive data during outage. No final offline authorization or billing is claimed.
- Pilot: free 30 days / 30 sessions, support only, athlete only. No purchase/order/payment created. Web staff explicitly confirms each admission; at most one charge per Tehran day, total cap enforced by DB trigger. Staff scans are recorded without charge. Automatic charging and paid plan fulfillment are NOT implemented by this release.
- Updates: fixed HTTPS origin, no redirects, RSA-3072/SHA256 signature, exact file allowlist, SHA256 per file, parsing validation, staged immutable versions. Checked on launcher start (not mid-attendance). Failed download/signature/hash falls back to last verified local version. Runtime bugs in a valid signed release are NOT automatically diagnosed/rolled back. Bootstrap updater/SDK upgrades may still require manual support.

## Local validation

Run `npm --prefix backend test` and PowerShell tests under `attendance-bridge/web-agent/test` after `release-tools/build-web-bridge.ps1`.
Tests use fake SDK and SQLite, no physical device, production SMS, real attendance or real sessions. Existing package install and agent have `-ValidateOnly`; actual installer not executed on this development machine.
Chrome visual QA was blocked by disconnected extension; do not claim mobile/desktop visual acceptance.

## Publication (separate authorization)

1. Take fresh Worker and D1 backups. The 2026-09-28 backup is historical, not the current rollback point.
2. Apply additive migration 007; validate foreign keys. Do not rerun base schema or delete legacy mappings.
3. Deploy all four Worker modules including `mg-bridge.js`. Preserve bindings/secrets. Enable `MG_BRIDGE_ENABLED=true` only after migration; the helper deliberately does not enable this new flag by default.
4. Publish frontend console/css/js, changed access-center/control/mg-api/SW, and complete `current/downloads` allowlist generated for this release. Upload source module/migration/test changes to Git only on user request.
5. Keep `release-tools/.cache/mg-bridge-update-private.pem` PRIVATE and backed up securely. It is the release signing key, never a frontend asset. Future engine changes MUST bump immutable version in sign-web-bridge.mjs before publishing; never replace an existing release version.
6. Verify unauthenticated /mine rejected, wrong installation token rejected, pairing works with an authenticated support account, manager sees only own club, secretary can map/review only own club, and health/OTP unchanged.
7. At gym: disconnect old clients from device; install once; support pairs actual serial/IP; perform one fresh scan; map exact member ID; activate athlete trial; perform another fresh scan; review admission; verify 29 remaining and replay stays 29; disconnect internet, capture scan, reconnect, verify queue survives. Do not approve departures.

## Remaining acceptance / operational limits

- Real SDK/COM, unattended launch after Windows sign-in, connectivity, clock, read latency and actual scan codes need on-site verification. A successful mock does not guarantee last visit/test.
- Local Windows account must remain signed in; this is not a Windows system service. No SDK installer bundled.
- Existing v1 trials/mappings are not migrated automatically. V2 grant rejects an active legacy trial; don't activate both systems for the same athlete. Existing v1 menu remains available during staged rollout.
- Retention/compaction of encrypted raw events, fleet monitoring, unattended bootstrap upgrades, paid subscriptions, automatic direction interpretation and guaranteed multi-station offline accounting are outside this pilot.
- A receipt 'stored' means server ingestion, not admission approval. UI explicitly keeps these distinct.
- The initial implementation was local-only; the subsequent user-authorized rollout is recorded at the top. No trial grant, live pairing, SMS send or account/device mapping is part of publication.

# Controlled attendance pilot — NOT deployed

## Scope / activation gate

This implements a free **30-day / 30-session** pilot, not a calendar-month paid purchase. Granting requires a known active approved athlete, real club, verified device serial and exact string member ID. Do not guess a device ID from a Gym Pulse membership number. No user has been granted a trial yet; the user is creating an account and will supply its phone.

The desktop tool requires a private trial-scoped token returned only on grant or explicit rotation. This token permits operator-confirmed test consumption and must be delivered to the club operator, never to the athlete or a public release. Only its SHA-256 hash is stored server-side. Desktop persistence uses Windows CurrentUser DPAPI.

## Deployment checklist (requires deliberate rollout)

1. Run all backend/frontend tests and desktop tests. Preserve existing production configuration, bindings and secrets. Back up D1 using the existing deployment process.
2. Apply additive `migrations/004-attendance-pilot.sql` then `migrations/005-attendance-review.sql` to the intended D1 database only. Do not rerun base schema or replace the database.
3. Deploy **worker.js AND attendance-pilot.js as a bundled module dependency**, not worker.js alone. Existing deployment instructions for past single-file uploads do not cover this new import.
4. Leave `ATTENDANCE_PILOT_ENABLED` unset/false until deployment is verified. Set it to `true` only for this controlled rollout. Disabled routes return 503 without touching new tables.
5. Publish `attendance-pilot.html`, `attendance-pilot.js`, updated `access-center.js`, `access-center.html`, `support.html`, and `sw.js` with existing mg-api.js on the frontend. These pages are noindex and not in the sitemap. No support or pairing token is embedded.
6. While authenticated as the approved support account, verify club and athlete, then call POST `/api/attendance-pilot/grant` with:

```json
{"phone":"ACTUAL_REGISTERED_PHONE","clubId":"EXISTING_CLUB_ID","deviceSerial":"VERIFIED_DEVICE_SERIAL","deviceMemberId":"EXACT_DEVICE_ID","requestKey":"pilot-UNIQUE_REQUEST_KEY"}
```

The active interval begins at grant time. Do not activate days before the operator is ready. Same request key retries return the same grant but do not return the existing token; if its initial response is lost, explicitly rotate the token. Different setup under the same key is rejected. A new grant for an existing active user/mapping is blocked until the prior trial is revoked. Expired rows are not silently deleted or recycled.

7. Transfer the returned token privately to the operator and pair the desktop client online. Do not put it in a URL, ZIP, screenshot or Git. The client is pinned to the existing HTTPS Worker origin; no redirects.
8. Coordinate a quiet device test: close the old application's device connection, verify no background connection, observe one real arrival, capture its record, reopen the old application, select the observed arrival and queue confirmation. Do not confirm a departure/old/ambiguous event. Gym Pulse automatic processing of this test account must be addressed to avoid charging an old subscription too.
9. Send queued confirmation online, verify a durable receipt and remaining 29 on both desktop and the athlete's `/attendance-pilot.html`. Re-send and same-day confirmation must remain 29. Reload after network interruption should retain outbox/receipts. No automatic day-2 test can be asserted until actually observed.
10. POST `/api/attendance-pilot/{id}/revoke` revokes the pilot. POST `.../{id}/rotate-token` replaces its token and revokes the old one. Setting feature flag false stops all pilot APIs but preserves the ledger. Do not delete consumption history as rollback.

## API / policy

- GET `/api/attendance-pilot/me`: own grants/remaining only, with approved session.
- GET `/api/attendance-pilot/bridge/config`: mapped trial configuration, using active trial-scoped token.
- POST `/api/attendance-pilot/bridge/consume`: explicit `confirmedAdmission: true` plus matching device serial/member ID, `deviceWallTime` YYYY-MM-DDTHH:mm:ss and integer verificationCode/punchCode/workCode.
- Raw punch/verification values are preserved for fingerprinting, **not interpreted as proof of admission**. Trial relies on an authorized operator who observed the entry, not automatic access-control evidence.
- Server converts this contemporary pilot's device wall clock with +03:30, rejects malformed dates, pre-activation/post-expiry events and events more than five minutes in the future. Device clock must be checked before the trial. This is not a historical DST conversion service.
- Each trial/day in Tehran can consume at most once, enforced by database uniqueness. The ledger count is authoritative; no mutable remaining field. A guard trigger prevents more than 30, inactive grants, blocked users or out-of-range consumption. Retry is safe even after response loss.
- Offline confirmations are pending, **not final balance deductions**. Expired/revoked pilots are rejected at synchronization, and their queued events need review; no automatic transfer to another subscription.
- No payments/orders are created or marked paid. No SQL Server/Gym Pulse write is performed. No production automatic session consumption is enabled by this pilot.

## Known limits

Desktop UI needs on-site visual/interaction and end-to-end live testing; mock tests are not that evidence. Device SDK buffering may read all users into memory, but capture persists only the configured test member. No biometric templates are requested. Missing records/scan cap/device SDK timeout are explicitly incomplete results.

DPAPI is tied to one Windows account and device. Production backup, migration, tamper resilience, disaster recovery and multi-station/offline plan conflicts remain out of scope. Paths under LocalAppData should remain local and protected; only token-free diagnostic JSON should be shared.

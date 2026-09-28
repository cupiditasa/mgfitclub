# Controlled athlete pilot — 2026-09-28

## Implemented, not activated

Portable 64-bit Windows Forms app: private trial-token pairing, cached server config, serial/member-scoped capture, local encrypted pending confirmations, explicit operator confirmation, retry-safe online submission, cached-vs-authoritative balance messaging and token-free diagnostic report.

New opt-in Worker module, additive migration and private athlete balance page exist in source only. No account/phone has been provided yet, no free trial or pairing token was issued, and no migration, Worker deployment, Git commit/push or live frontend upload occurred. Activation requires the actual registered athlete and verified device member mapping.

## Validation

R3 device identity workflow: 92 backend/frontend tests, 8 attendance client tests, 6 identity client tests and 14 shadow tests pass. Identity uses staff attestation plus a fresh serial/member-bound observation within a 15-minute server challenge. No photo/template read/write, remote enrollment, live identity verification, credential issuance or publication occurred. Chrome was disconnected during visual QA; no completed mobile/desktop visual inspection is claimed. Start the independent identity UI with START-DEVICE-VERIFICATION.cmd; see DEVICE-VERIFICATION-FA.txt. Existing trial and identity credentials are different and cannot be exchanged.

R2: 74 backend/frontend tests and 8 desktop module tests pass. Added raw-observation upload (no charge), server-side manager club scope and support review, explicit approval/rejection, idempotent remote/local same-day consumption, and two isolated account launchers. A shared capture mutex prevents the two pilot profiles reading the device concurrently. UI visual and real hardware testing remain pending. The Gym Pulse database route is NOT implemented. See UPDATE-FA.txt.

- Backend pilot tests use real SQLite constraints/transactions via D1 adapter; cover disabled gate, authorization, no fake paid orders, idempotent grant, ownership, validation, concurrent retry, daily uniqueness, revocation, rotation, expiry and 30-session guard.
- Six client tests pass with synthetic DPAPI files and mocked transport: parser/security settings, encrypted settings replacement, binding/history checks, durable offline queue, authoritative receipts/retry, wrong-trial receipt rejection.
- Fourteen shadow tests pass with fake SDK, including storage/replay and filtering out other member IDs before persistence.
- Existing full backend/frontend regression suite passed after adding the new page's access cloak; frontend pilot-specific tests additionally check guard readiness, safe text rendering and failure states.
- UI dependency preflight passed; desktop visual/interactive behavior and live server/device end-to-end acceptance remain unverified. No live paid account or device was mutated.

## Blockers before a club visit

Phone of the newly registered athlete; real club ID; verified device serial and exact device member ID; support-authorized grant after rollout; safe plan for preventing old Gym Pulse from billing the same test entry. Current SQL trust issue remains unrelated and unresolved; this pilot does not integrate with Gym Pulse SQL.

Do not describe this as a finished autonomous attendance system. The pilot uses operator-confirmed arrivals, one session per Tehran calendar day, 30 days from activation, only one account/device mapping per token, and no automatic offline final deduction. No migration or token is embedded in the runtime ZIP.

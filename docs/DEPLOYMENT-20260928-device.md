# Device verification and attendance pilot — Git publication, 2026-09-28

This update publishes frontend, backend module sources, additive migrations, automated tests and portable Windows bridge source. It does **not** itself apply production database migrations or deploy/enable the Cloudflare Worker.

## Before the real club test

- Publish the frontend through the repository's existing Pages deployment.
- Back up production D1, then deliberately apply migrations 004, 005 and 006 for the two features.
- Bundle worker.js with attendance-pilot.js and device-verification.js, preserving existing bindings/secrets.
- Enable ATTENDANCE_PILOT_ENABLED and DEVICE_VERIFICATION_ENABLED only after validation.
- Support must verify the actual club/device serial and issue the club verification key. Athlete trial keys are separate; no real keys or accounts are included in Git or the ZIP.
- Extract the portable application on the club's 64-bit Windows machine with the previously working SDK. Run START-DEVICE-VERIFICATION.cmd for identity registration. Internet is required for the website handshake; local device reads require the gym LAN.
- Real hardware, authenticated end-to-end and visual acceptance remain pending. Do not describe a successful Git push as a successful production rollout.

See backend/DEVICE-VERIFICATION-DEPLOYMENT.md and backend/ATTENDANCE-PILOT-DEPLOYMENT.md for scope, security boundaries, rollout and recovery.

No Gym Pulse database writes, remote biometric enrollment, payment changes, session grants or SMS tests are performed by this publication.

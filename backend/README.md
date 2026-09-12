# MG FitClub API

Cloudflare Worker + D1 API for login, roles, dashboards and training requests.

## Required bindings and secrets

- `DB`: D1 database binding.
- `SMS_API_KEY`: SMS.ir X-API-KEY secret.
- `SMS_TEMPLATE_ID`: approved SMS.ir verification template ID; the current MG template is `791767`.
- `APP_ORIGIN`: final frontend origin.
- `DEV_MODE`: use only for local/test environments.
- `OTP_SECRET`: secret used to hash OTP challenges.

The SMS.ir verification template already contains the approved text and the `#CODE#` variable. The Worker sends only the generated six-digit code as the `CODE` parameter; the API key never belongs in frontend files.

## Test

```bash
npm test
```

# RCA — Admin login failing on production (/admin) for suminex

## Problem statement
User cannot log into `/admin` on production (https://suminex.emergent.host). After 5 failed attempts they hit "Too many failed attempts. Try again in 15 minutes." The same credentials (username `griblin`, password `Casey123!`) are verified working in preview. Backend reads `os.environ["ADMIN_USERNAME"]` / `os.environ["ADMIN_PASSWORD"]`.

## Evidence gathered (active run 971aa1f3-d59e-4c4e-bd95-a4cb75ccc73d, serving traffic)

### 1. Secrets exist and MATCH expected values
`list_secrets` (active run), with expected comparison:
- `ADMIN_USERNAME` — present, is_empty=false, **matches_expected=true** (== "griblin")
- `ADMIN_PASSWORD` — present, is_empty=false, **matches_expected=true** (== "Casey123!")

So the production secret VALUES are byte-identical to the preview credentials. This is NOT a stale/missing/wrong-secret case.

### 2. Backend logs (`fetch_app_logs`, last 1440m)
```
POST /api/admin/login HTTP/1.1  429 Too Many Requests   (x1)
POST /api/admin/login HTTP/1.1  401 Unauthorized        (x5 total)
```
status_counts: 401=5, 429=1, 500=0. **No 500s.** The lockout is purely the app's own rate-limiter returning 429 after 5× 401.

### 3. Latest deployment
`describe_deployment_state`: active_run_id 971aa1f3, type=redeploy, status=**success**, completed 2026-10-20T20:49:17Z. Deploy is healthy.

### 4. Lockout record in prod Mongo (`login_attempts`)
```
{ identifier: "admin:38.81.84.141", count: 5, until: "2026-10-20T21:16:10.389527+00:00" }
```
db_name: suminex-test_database. A single active lockout exists for the user's IP; it expires automatically at 21:16:10Z.

## Root cause / analysis
- The user is CURRENTLY blocked by the app's own rate-limiter (429), lockout active until 2026-10-20T21:16:10Z. Until that window passes, every attempt is rejected with 429 regardless of credential correctness.
- The underlying 5× 401 is NOT explained by a wrong production secret: both `ADMIN_USERNAME` and `ADMIN_PASSWORD` match the expected values exactly on the active run. No 500s, so it is not a backend crash either.
- Because the stored values are correct, the 401s point to the credential actually submitted at login time differing from the stored value — e.g. client-side whitespace/encoding, autofill, a trailing character, or attempts made against the pod before the most recent secret-bearing deploy settled. This part is INFERRED, not reproduced (an eph pod has no secrets/live DB, so it cannot reproduce the credential check).

## Suggested fixes (no deploy / no secret change performed)
1. Wait out the lockout (expires 21:16:10Z) OR clear the `login_attempts` doc for `admin:38.81.84.141` via DB Manager, then retry `/admin`.
2. On retry, type credentials manually (avoid autofill), and if it still 401s, capture the `POST /api/admin/login` request in DevTools to confirm the exact username/password bytes being sent — compare against stored "griblin"/"Casey123!".
3. No secret change is required: production `ADMIN_USERNAME`/`ADMIN_PASSWORD` already match the intended values.

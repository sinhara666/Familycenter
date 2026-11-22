# Family Sync service

The sync service for the standalone Family Command Center. One
family's board follows them across phone, computer, and tablet:
devices push their board snapshot here and pull the newest one back.
The board state is opaque JSON to the service; it stores and returns
it without interpreting any field.

This is the Next.js port of the `family-sync-bridge` contract
(stdlib Python + SQLite, proven locally Oct 18, 2026). Same
endpoints, same codes, same error semantics.

## Run it (local, zero accounts)

```
npm install
npm run dev        # http://127.0.0.1:3000
```

Local dev stores its database in a file, `data/family-sync.db`,
created on first use. No account, no token, nothing remote.

## Remote config

Remote storage comes ONLY from environment variables. With both set,
the service talks to Turso instead of the local file:

```
TURSO_DATABASE_URL=libsql://your-database-org.turso.io
TURSO_AUTH_TOKEN=...
```

No secret is written into any file in this app.

## Endpoints

| Method | Path | Body / params | Returns |
| --- | --- | --- | --- |
| POST | `/family/create` | `{device_name}` | `{ok, family_code, device_token, state, version}` |
| POST | `/family/join` | `{family_code, device_name}` | `{ok, family_code, device_token, state, version}` |
| POST | `/family/push` | `{family_code, device_token, state}` | `{ok, version}` |
| GET | `/family/latest` | `?family_code=...&device_token=...` | `{ok, state, version, updated_at}` |
| GET | `/health` | | `{ok}` |

- A family code looks like `FAM-BF2C-82`. A wrong code on join is a
  clean 404: `{"error": "family not found"}`.
- Every push replaces the family's snapshot and bumps `version`.
- A device token only works for the family it was minted on. A bad or
  mismatched token on push or latest returns 403.
- Device tokens are stored **hashed only** (sha256). The raw token is
  shown to the device once, at create or join time.
- CORS headers ride on every JSON response, and `OPTIONS` preflight
  on `/family/*` is answered, so the buyer file can call the service
  from `file://` and any https origin.
- One pushed snapshot is capped at 512 KB.

Redeploy with environment variables set on familycommandcenter.

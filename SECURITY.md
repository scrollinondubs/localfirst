# Security

## If GitGuardian (or similar) reports exposed secrets

This repo must not contain real API keys, tokens, or private keys. If you see alerts for:

- **Google API Key** (e.g. in `app.json`, `WebMapView.js`, `Info.plist`)  
  We use placeholders in the repo. Set `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` for local/build use. If a real key was ever committed, **revoke it** in [Google Cloud Console](https://console.cloud.google.com/) and create a new one.

- **OpenAI API Key** (e.g. in `packages/api/.env`)  
  `.env` is in `.gitignore` and must not be committed. If a key was exposed in the past, **revoke it** in the [OpenAI dashboard](https://platform.openai.com/) and use a new key only in local env or CI secrets.

- **Private keys** (e.g. `*.pem` files)  
  `*.pem` and `*.key` are in `.gitignore`. If any were ever committed, treat them as compromised: **revoke/regenerate** (e.g. new TLS certs with `mkcert`) and never commit the new keys.

**Do not** “fix” by only making the repo private or by committing on top of the current code. Rotate (revoke and replace) any exposed secret and store the new value only in environment variables or a secrets manager.

# Issue #12: Remove PII and Sensitive Credentials from Git History

This runbook must be completed **before** making the repository public.

## Prerequisites

```bash
# Install BFG Repo-Cleaner (macOS)
brew install bfg

# Or download JAR
# wget https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar
```

## Step 1: Create a fresh mirror clone

**Do this in a separate directory (e.g. your Desktop), not inside the current repo.**

```bash
cd ~/Desktop   # or another directory outside localfirst-main
git clone --mirror git@github.com:scrollinondubs/localfirst.git
cd localfirst.git
```

## Step 2: Create `replacements.txt`

Create a file **in the mirror clone directory** named `replacements.txt`.

**Format:** `literal_text_to_find==>replacement`

Add one line per secret. **Do not commit this file.** Example:

```
# Cloudflare (get from .claude/settings.local.json or Cloudflare dashboard)
YOUR_ACTUAL_CLOUDFLARE_API_TOKEN==>CLOUDFLARE_API_TOKEN_PLACEHOLDER
YOUR_ACTUAL_CLOUDFLARE_ACCOUNT_ID==>CLOUDFLARE_ACCOUNT_ID_PLACEHOLDER

***REMOVED***
D1_DATABASE_ID_PLACEHOLDER_PRODUCTION==>D1_DATABASE_ID_PLACEHOLDER_PRODUCTION
D1_DATABASE_ID_PLACEHOLDER_DEVELOPMENT==>D1_DATABASE_ID_PLACEHOLDER_DEVELOPMENT

# OpenAI (from packages/api/.env if it was ever committed)
YOUR_ACTUAL_OPENAI_API_KEY==>OPENAI_API_KEY_PLACEHOLDER
```

Replace the `YOUR_ACTUAL_*` values with the real secrets you want to scrub (copy from your local `.claude/settings.local.json` and `packages/api/.env`).

## Step 3: Run BFG to replace sensitive strings

```bash
# From inside the mirror clone (localfirst.git)
bfg --replace-text replacements.txt
```

## Step 4: Delete files that must be removed entirely

Run these from inside the mirror clone:

```bash
# PII data
bfg --delete-files "Local First - All Directory Businesses.csv"
bfg --delete-files "insert-businesses.sql"
bfg --delete-files "businesses-only.sql"
bfg --delete-files "d1-complete.sql"

# Private keys
bfg --delete-files "localhost.pem"
bfg --delete-files "localhost-key.pem"
bfg --delete-files "localhost+2.pem"
bfg --delete-files "localhost+2-key.pem"

# Secrets
bfg --delete-files ".env"
bfg --delete-files "settings.local.json"
```

## Step 5: Clean up and expire reflog

```bash
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

## Step 6: Verify

```bash
# Search for a known secret (use one you put in replacements.txt)
git log -p --all -S 'YOUR_ACTUAL_CLOUDFLARE_API_TOKEN' -- . || true
# Should return nothing if cleaned.
```

## Step 7: Force push (coordinate with team)

**Everyone must re-clone after this; existing clones will have invalid history.**

```bash
git push --force
```

## Step 8: Post-cleanup checklist

- [ ] **Rotate credentials:** Cloudflare API token, OpenAI API key.
- [ ] **Regenerate localhost certs** if needed: `mkcert localhost` etc.
- [ ] **Update wrangler.toml** in the repo with real D1 IDs again (via Cloudflare dashboard or env); they are now placeholders in the repo.
- [ ] Notify collaborators to **re-clone** the repo.
- [ ] Ensure `.gitignore` is in place (already updated in repo).
- [ ] Consider pre-commit hooks: `git-secrets` or `detect-secrets`.

## Reference

- [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/)
- [GitHub: Removing sensitive data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)

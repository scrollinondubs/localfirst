#!/usr/bin/env bash
# Issue #12: Full BFG history cleanup for localfirst repo.
# Run from repo root. Requires: bfg (brew install bfg).
# Optional: add your Cloudflare/OpenAI secrets to replacements.txt before running.

set -e
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MIRROR_DIR="${REPO_DIR}/../localfirst.git"
REMOTE="${1:-git@github.com:scrollinondubs/localfirst.git}"

echo "==> Repo root: $REPO_DIR"
echo "==> Mirror will be: $MIRROR_DIR"
echo "==> Remote: $REMOTE"
echo ""

# Prefer Homebrew OpenJDK so BFG JAR works (macOS /usr/bin/java is a stub)
for j in /opt/homebrew/opt/openjdk/bin/java /opt/homebrew/opt/openjdk@*/bin/java; do
  [ -x "$j" ] && export PATH="$(dirname "$j"):$PATH" && break
done

# Check for BFG
if [ -f "$REPO_DIR/bfg.jar" ]; then
  if ! command -v java >/dev/null 2>&1 || ! java -version >/dev/null 2>&1; then
    echo "ERROR: Java required to run bfg.jar. Install with:"
    echo "  brew install openjdk"
    echo "Then re-run this script."
    exit 1
  fi
  echo "==> Using bfg.jar from repo root"
  bfg() { java -jar "$REPO_DIR/bfg.jar" "$@"; }
elif command -v bfg >/dev/null 2>&1; then
  echo "==> BFG found: $(which bfg)"
else
  echo "ERROR: BFG not found. Install Java and use bfg.jar, or install BFG:"
  echo "  brew install openjdk   # then re-run (script uses repo bfg.jar)"
  echo "  brew install bfg       # alternative"
  exit 1
fi

# Clone mirror
if [ -d "$MIRROR_DIR" ]; then
  echo "==> Removing existing mirror at $MIRROR_DIR"
  rm -rf "$MIRROR_DIR"
fi
echo "==> Cloning mirror..."
git clone --mirror "$REMOTE" "$MIRROR_DIR"
cd "$MIRROR_DIR"

# Build replacements.txt (D1 IDs; user can add Cloudflare/OpenAI to repo file and we append)
REPLACEMENTS="$MIRROR_DIR/replacements.txt"
cat > "$REPLACEMENTS" << 'EOF'
# D1 Database IDs (from wrangler.toml history)
b27b33e0-b044-4a61-b265-939717be9fd4==>D1_DATABASE_ID_PLACEHOLDER_PRODUCTION
1c691acc-43d9-4841-ab53-e1920ae07716==>D1_DATABASE_ID_PLACEHOLDER_DEVELOPMENT
EOF
# Append user replacements if present (optional)
if [ -f "$REPO_DIR/replacements.txt" ]; then
  echo "==> Appending $REPO_DIR/replacements.txt (remove comment lines for BFG)"
  grep -v '^#' "$REPO_DIR/replacements.txt" | grep -v '^$' >> "$REPLACEMENTS" || true
fi

echo "==> Running BFG: replace-text..."
bfg --replace-text "$REPLACEMENTS"

echo "==> Running BFG: delete-files..."
bfg --delete-files "Local First - All Directory Businesses.csv"
bfg --delete-files "insert-businesses.sql"
bfg --delete-files "businesses-only.sql"
bfg --delete-files "d1-complete.sql"
bfg --delete-files "localhost.pem"
bfg --delete-files "localhost-key.pem"
bfg --delete-files "localhost+2.pem"
bfg --delete-files "localhost+2-key.pem"
bfg --delete-files ".env"
bfg --delete-files "settings.local.json"

echo "==> Expiring reflog and GC..."
git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo ""
echo "==> Cleanup done. To push the rewritten history (destructive):"
echo "    cd $MIRROR_DIR"
echo "    git push --force"
echo ""
echo "Then: rotate Cloudflare & OpenAI keys, have everyone re-clone."

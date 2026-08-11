#!/bin/sh
# Git hooks run with a minimal PATH that does not include nvm-managed Node, so
# `pnpm` is missing when committing from a GUI client or a non-login shell.
# Load nvm (if present) and select the version pinned in .nvmrc.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"

if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh" --no-use
  nvm use --silent >/dev/null 2>&1 || true
fi

# pnpm is provisioned through corepack (see packageManager in package.json).
if ! command -v pnpm >/dev/null 2>&1; then
  corepack enable >/dev/null 2>&1 || true
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "husky: pnpm not found. Run 'nvm use && corepack enable' and try again." >&2
  exit 1
fi

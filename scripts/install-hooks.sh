#!/bin/bash

# Script to install git hooks from .githooks directory
# This makes the hooks versionable and shareable with the team

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
GITHOOKS_DIR="$REPO_ROOT/.githooks"

# Check if .git directory exists (we're in a git repo)
if [ ! -d "$REPO_ROOT/.git" ]; then
    echo "⚠️  Not a git repository, skipping hooks installation"
    exit 0
fi

# Check if .githooks directory exists
if [ ! -d "$GITHOOKS_DIR" ]; then
    echo "⚠️  .githooks directory not found, skipping hooks installation"
    exit 0
fi

# Use git config to set hooks path (modern approach)
# This makes git look for hooks in .githooks instead of .git/hooks
git config core.hooksPath .githooks

# Make sure all hooks are executable
find "$GITHOOKS_DIR" -type f -name "*" -exec chmod +x {} \; 2>/dev/null

echo "✅ Git hooks installed successfully!"


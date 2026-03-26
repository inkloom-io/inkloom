#!/bin/sh
# init_docs.sh — Scaffold a docs/ directory for an InkLoom project.
#
# Usage:
#   ./init_docs.sh [output-directory]
#
# Creates the directory structure and copies MDX templates from the
# assets/ directory located relative to this script. Idempotent — will
# not overwrite files that already exist.

set -e

# Resolve the directory where this script lives
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ASSETS_DIR="${SCRIPT_DIR}/../assets"

# Output directory defaults to ./docs
OUTPUT_DIR="${1:-./docs}"

# Create directory structure
mkdir -p "${OUTPUT_DIR}"
mkdir -p "${OUTPUT_DIR}/api-reference"

# Copy templates (skip if target already exists)
copy_if_missing() {
  src="$1"
  dest="$2"
  if [ -f "$dest" ]; then
    echo "  skip: $dest (already exists)"
  else
    cp "$src" "$dest"
    echo "  create: $dest"
  fi
}

echo "Scaffolding docs in ${OUTPUT_DIR}/"
echo ""

copy_if_missing "${ASSETS_DIR}/getting-started-template.mdx" "${OUTPUT_DIR}/getting-started.mdx"
copy_if_missing "${ASSETS_DIR}/api-docs-template.mdx"        "${OUTPUT_DIR}/api-reference/endpoints.mdx"
copy_if_missing "${ASSETS_DIR}/page-template.mdx"             "${OUTPUT_DIR}/api-reference/authentication.mdx"

echo ""
echo "Done! Next steps:"
echo ""
echo "  1. Authenticate:  inkloom auth login"
echo "  2. Create project: inkloom projects create --name \"My Docs\""
echo "  3. Push pages:     inkloom pages push <project-id> --dir ${OUTPUT_DIR} --publish"
echo "  4. Deploy:         inkloom deploy <project-id> --production --wait"

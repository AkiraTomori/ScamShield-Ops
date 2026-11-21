#!/usr/bin/env bash
# Stop hook (non-blocking): remind to sync docs when code changed but docs did not.
# Rule: AGENTS.md, section "Đồng bộ tài liệu". Prints a JSON systemMessage or nothing.
# Test override: DOCS_SYNC_CHANGED_FILES (newline-separated) replaces the git lookup.
set -u
cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0

if [ -n "${DOCS_SYNC_CHANGED_FILES+x}" ]; then
  changed="$DOCS_SYNC_CHANGED_FILES"
else
  git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0
  changed="$( { git diff --name-only HEAD 2>/dev/null; git ls-files --others --exclude-standard 2>/dev/null; } | sort -u)"
fi

# Code = source under apps/ or packages/, excluding generated migrations metadata-only churn is still code, so keep it simple.
code=$(printf '%s\n' "$changed" | grep -Ec '^(apps|packages)/' || true)
docs=$(printf '%s\n' "$changed" | grep -Ec '^(docs/|AGENTS\.md$)' || true)

if [ "$code" -gt 0 ] && [ "$docs" -eq 0 ]; then
  echo '{"systemMessage":"Nhắc đồng bộ tài liệu: mã trong apps/ hoặc packages/ đã đổi nhưng docs/ và AGENTS.md chưa đổi. Rà mục \"Đồng bộ tài liệu\" trong AGENTS.md (trạng thái, hợp đồng, codebase, tasks.csv)."}'
fi
exit 0

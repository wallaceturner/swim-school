---
description: read/run the rules below first immediately unprompted then do a 'git commit and push' 
---
# Git Commit Protocol

**CRITICAL RULES - MUST FOLLOW EVERY TIME**

## Before ANY Commit

You MUST run these checks FIRST:

1. Do a code review of uncommitted files - use this to auto-generate an short commit message


## Commit Rules

- Do NOT include "Generated with Claude Code" or AI attribution in commit messages
- NEVER run `git push --force` without explicit permission
- NEVER use `git commit --amend` unless:
  1. User explicitly requested amend, OR
  2. Adding edits from pre-commit hook
- Before amending: ALWAYS check authorship with `git log -1 --format='%an %ae'`


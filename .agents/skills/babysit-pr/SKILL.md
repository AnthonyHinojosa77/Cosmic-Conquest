---
name: babysit-pr
description: Monitor a pull request through CI and review only when the user explicitly asks to watch or babysit it.
---

# Babysit Pull Request

Require an explicit request for the specific pull request before beginning. Pull requests are not the normal delivery path; this applies only to one that the task or repository requires.

1. Capture the pull-request URL, current head commit, original objective, required checks, and unresolved review threads.
2. Wait for state changes with the platform's bounded wait mechanism. Avoid noisy polling.
3. Evaluate each failure or comment against the current head and actual source before changing code.
4. Fix real regressions within the original objective, validate locally, and push through the repository's normal workflow.
5. Explain false positives factually. Do not expand scope to unrelated feature requests.
6. Rebase or resolve conflicts only when needed for the requested PR to pass.
7. Stop when required checks pass and actionable review comments are resolved, or when one concrete blocker requires the user.
8. Merge only as the file-pr pull-request exception allows, holding changes that need the owner's approval. Report the final state: merged, or held and why.

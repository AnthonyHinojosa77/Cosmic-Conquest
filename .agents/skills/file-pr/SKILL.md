---
name: file-pr
description: Prepare and file a pull request when the user explicitly requests a PR.
---

# File Pull Request

Complete the local implementation and validation before opening the pull request.

1. Read the repository instructions and inspect the diff against the intended base.
2. Confirm the branch contains only changes belonging to the requested outcome.
3. Check whether the branch already has an open pull request; update it instead of creating a duplicate.
4. Use a concrete title that states the resulting behavior.
5. Lead the body with the problem and resulting behavior. Add implementation detail and validation only when they help review.
6. Follow a repository pull-request template when present. Otherwise use `Summary`, `Validation`, and `Risks` only as needed.
7. Add a short provenance footer naming the executing harness and model when available.
8. Return the pull-request URL and its current state.

Do not start ongoing monitoring. Use `babysit-pr` only after the user explicitly requests monitoring.

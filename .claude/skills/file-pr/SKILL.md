---
name: file-pr
description: Ship a finished change through a pull request, with a branch named for the tracker issue, a plain-language description, a reviewer agent, a bounded wait for checks, and a merge only where the owner has authorized agents to merge.
disable-model-invocation: true
---

# Ship Through a Pull Request

Finish and validate the work before opening the pull request. Changes reach the default branch through a pull request; whether an agent may merge it is the owner's decision.

1. **Branch.** Start from the latest default branch. Work on a branch named with the project's tracker issue identifier when there is one, for example `abc-123-fix-checkout`. When the harness assigns a branch name, keep it and put the identifier in the pull request title. Confirm the branch holds only changes that belong to the requested outcome.
2. **Push.** Commit and push the branch.
3. **Open the pull request** when the work is ready; a draft while it is still in progress is fine. Check first whether the branch already has an open pull request and update that one instead of opening a duplicate. Follow the repository's pull-request template when it has one.
   - Title: the outcome in plain words, plus the issue identifier when there is one.
   - Description: a plain-language report: what changes for the user, what was checked and whether it passed, risks, and the preview link when the host gives one. Reference the tracker issue in the form the tracker recognizes, so it links the pull request and closes the issue only when the pull request finishes it.
   - Footer: one short provenance line naming the harness and model when available.
4. **Review.** After the last commit, have a reviewer agent in a fresh context check the committed diff against the issue or request, and post its verdict, pass or fail with evidence per item, as a pull request comment. On fail, find the cause, fix, push, and have it check again until it passes; contact the owner only when they alone can fix what remains. On pass, merge without waiting on the owner, except where an owner approval gate applies.
5. **Checks.** Wait for the pull request's checks inside the same session with a bounded wait, about 30 minutes per wait; fix failing checks the same way as review findings. Never subscribe to pull-request activity or leave a standing watcher.
6. **Merge.** Only where the owner has authorized agents to merge: when the checks pass, or the repository has none, and the review passed, merge it (squash) and delete the branch. Otherwise leave it open for the owner and say so.
7. **Owner gate.** Even with that authorization, leave a pull request that touches money, security, or accounts, or that releases a product to buyers, for the owner. Say in one plain sentence what the owner is approving and what happens on approval.
8. **Direct push.** The first commit of an empty repository has nothing to open a pull request against and may go straight to the default branch.

Return the pull request's URL and its final state: merged, or left open and why. Use `babysit-pr` only after the user explicitly asks to watch a pull request.

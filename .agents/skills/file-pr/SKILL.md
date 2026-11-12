---
name: file-pr
description: Deliver a finished, authorized change through proportional validation and a fresh independent review of the committed change, then push straight to the default branch on an In Spec verdict. Pull requests only where the task or repository requires one; no auto-merge or standing watchers.
---

# Deliver a Finished Change

Finish and validate the work before delivery. A change reaches the default branch by a direct push after a fresh independent reviewer finds the committed change In Spec; no routine pull request is needed.

1. **Prepare.** Start from the latest default branch and work on it. Keep only changes that belong to the requested outcome and preserve unrelated work. When the task or the repository's own delivery rules require a pull request, use the pull-request exception below instead of steps 5 and 6.
2. **Validate.** Run the project's checks that this change and its real risks need, and inspect the result the user will see. Stop once further checks would not change the decision.
3. **Commit.** Write a plain-language message: what changes for the user and what was checked. End with one short provenance line naming the harness and model when available.
4. **Review the committed change.** After the last commit, have a reviewer agent in a fresh context, never the builder, check that full commit against the request and return **In Spec** or **Out Of Spec** with evidence per item. On Out Of Spec, find the cause, fix, commit and have the new commit checked again, with no round limit. Contact the owner only when they alone can fix what remains.
5. **Push.** On In Spec, push straight to the default branch with a normal fast-forward push. If the remote moved, reconcile safely, rerun the affected checks and have the resulting commit reviewed again before pushing. Never force-push the default branch. A cloud thread that starts on its own side branch commits as it goes and pushes that branch before every turn ends, pushing more often only where a push starts no build; the default branch still moves only after In Spec, and the side branch is deleted once the default branch holds the reviewed work. A deployment that the push triggers automatically is part of this delivery.
6. **Owner gate.** Hold a change that spends money, touches accounts, makes a product publicly listed for sale, or needs a security step only a human can do (signing in, passwords, codes, approval prompts, credential or permission grants). Say in one plain sentence what the owner is approving and what happens on approval, and continue unaffected work. Security-related code that passes an independent In Spec review ships like any other change, without the owner's review.

## Pull-request exception

Only when the task or the repository requires a pull request: update an existing one rather than opening a duplicate, have the final head reviewed as in step 4, wait for required checks inside the session with a bounded wait, and merge only where the owner has authorized agents to merge, applying the owner gate. Otherwise leave it open and say why. No auto-merge, no subscribing to pull-request activity, no standing watcher.

Report the pushed commit, or the pull request and its final state. Use `babysit-pr` only after the user explicitly asks to watch a specific pull request.

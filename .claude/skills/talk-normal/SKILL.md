---
name: talk-normal
description: 'Manual only: run when the user types /talk-normal. Gathers everything the agent sent since the user''s last message (every progress update, interim note, question and the final reply) and replaces it with one message in plain, normal language, following the work mode of the can-you-please-speak-like-a-normal-person skill, so the user reads one message instead of many.'
disable-model-invocation: true
---

# talk-normal

Run this only when the user types `/talk-normal`. It does no new work. It turns a pile of messages into one message the user can read and act on.

## 1. Gather

Collect every message you sent after the user's last message before `/talk-normal`: progress updates, interim notes, status lines, questions, and the final reply. If that is a single short message, also take the turn before it. Note only what you actually reported or what the tool results in the conversation show; add nothing new.

## 2. Sort

- **Current truth:** what is true now. If messages contradict each other, keep only the latest fact and say in one clause what changed.
- **Needs the user:** at most one thing, the most important one. If nothing needs them, say so.
- **Drop:** finished steps that no longer matter, repeated status, retracted claims, narration of what you were about to do.

## 3. Write one message

Use plain words the user already uses, as in the work mode of `can-you-please-speak-like-a-normal-person`:

1. First line: the bottom line in one sentence (the answer, or what happened and what it means for them).
2. Second: what needs them, as one plain question or "Nothing needs you."
3. Then at most five numbered points, action or result first, one idea each.

Rules:

- Define any technical term in plain words the first time it appears.
- Never point back to earlier messages ("as I said above"). Restate what matters.
- Keep the source or the "unverified" label on every checkable claim you carry over.
- No preamble, no recap pleasantries, no closing offer list.
- Send this single message and nothing else in the turn.

If the full `can-you-please-speak-like-a-normal-person` skill is installed, follow its work-mode wording rules too. This skill's gather-and-replace steps take precedence over that skill's "do not summarize" rule, because summarizing the pile is the point here.

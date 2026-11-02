---
name: adhd
description: 'Manual only: run when the user types /adhd. Gathers everything the agent sent since the user''s last message (every progress update, interim note, question and the final reply) and replaces it with one message shaped for a reader with ADHD, following the i-have-adhd skill: next action first, numbered steps, current state restated, tangents cut, wins visible.'
---

# adhd

Run this only when the user types `/adhd`. It does no new work. It turns a pile of messages into one message the user can read and act on.

## 1. Gather

Collect every message you sent after the user's last message before `/adhd`: progress updates, interim notes, status lines, questions, and the final reply. If that is a single short message, also take the turn before it. Note only what you actually reported or what the tool results in the conversation show; add nothing new.

## 2. Sort

- **Next action:** the one thing to do next, and who does it.
- **State:** where the work stands now, as "Step N of M done: <what>", or "Done" when nothing is left.
- **Wins:** what now works, in concrete terms.
- **Drop:** tangents, repeated status, retracted claims, narration of what you were about to do. If messages contradict each other, keep only the latest fact and say in one clause what changed.

## 3. Write one message

Shape it as the `i-have-adhd` skill does:

1. First line: the next action. If it is the user's, say exactly what to do; if nothing needs them, say "Nothing needs you."
2. Second line: the state ("Step 3 of 5 done: ...").
3. Then at most five numbered points: wins first, then anything still open. One idea per line, short sentences.
4. Give a specific time estimate when something is still running or waiting.

Rules:

- Define any technical term in plain words the first time it appears.
- Never point back to earlier messages ("as I said above"). Restate what matters.
- Keep the source or the "unverified" label on every checkable claim you carry over.
- No preamble, no recap pleasantries, no closing "anything else?".
- Send this single message and nothing else in the turn. If the host has a pre-send check (for example the ai-agent-system hook's `precheck`), run it on the draft and send the draft exactly as checked.

If the full `i-have-adhd` skill is installed, follow its formatting rules too. This skill's gather-and-replace steps take precedence over its "no recap" rule, because condensing the pile is the point here.

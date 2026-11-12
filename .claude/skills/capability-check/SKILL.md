---
name: capability-check
description: Verify a disputed or untested tool, model, connector, automation, or account capability in its actual target surface.
disable-model-invocation: true
---

# Capability Check

Identify the target and intended operation, including the account, host or runtime where it affects the result. Never transfer a capability conclusion from one surface to another.

Check the applicable states independently:

| State | Evidence |
| --- | --- |
| Configured | The exact target points to the intended provider or item. |
| Authorized | The target reports a current authenticated connection. |
| Visible | The runtime exposes the tool, model, skill, or command now. |
| Callable | A fresh session can invoke the intended operation. |
| Tested | A harmless representative request returns a usable result. |
| Adopted | The result has been used successfully in the real workflow. |

Use a non-destructive test with a concrete expected result. For skills, restart or open a fresh task when discovery is cached. For connectors and providers, use their native status plus one harmless call. For automations, distinguish saved schedule, eligible execution, completed run, and notification delivery.

Report only states material to the requested outcome, using `Confirmed`, `Failed`, `Pending`, or `Unknown` where useful, with the relevant test, time and limitation. Do not turn a simple lookup into a full state checklist. A saved file, installed package, visible setting, successful login page, or agent progress indicator establishes only its own state.

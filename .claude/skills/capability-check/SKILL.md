---
name: capability-check
description: Verify whether an AI skill, model, connector, MCP, provider, automation, or account feature actually works in a named target surface.
disable-model-invocation: true
---

# Capability Check

Start by naming the exact product, app, account, host, runtime, and intended operation. Never transfer a capability conclusion from one surface to another.

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

Report each state as `Confirmed`, `Failed`, `Pending`, or `Unknown`, with the test, timestamp, and limitation. A saved file, installed package, visible setting, successful login page, or agent progress indicator establishes only its own state.

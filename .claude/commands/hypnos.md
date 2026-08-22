---
name: "Hypnos"
description: Route directly to the Hypnos agent via Janus (agent-authoring, not the router)
category: Workflow
tags: [workflow, routing]
---

Delegate this request to the `janus` agent with an explicit instruction: route directly to `hypnos`, overriding Janus's own judgment about which agent fits. Janus still performs the hand-off (including its normal identity/telemetry steps) — this command just fixes the destination.

Note: `hypnos` is the agent-authoring agent, not the router — the router is `janus`. This command does not invoke the router.

<!-- dreamland-managed: safe to overwrite on `dreamland init` -->

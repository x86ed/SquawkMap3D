---
name: "Meng Po"
description: Route directly to the Meng Po agent via Janus
category: Workflow
tags: [workflow, routing]
---

Delegate this request to the `janus` agent with an explicit instruction: route directly to `mengpo`, overriding Janus's own judgment about which agent fits. Janus still performs the hand-off (including its normal identity/telemetry steps) — this command just fixes the destination.

<!-- dreamland-managed: safe to overwrite on `dreamland init` -->

---
name: "Morpheus"
description: Route directly to the Morpheus agent via Janus
category: Workflow
tags: [workflow, routing]
---

Delegate this request to the `janus` agent with an explicit instruction: route directly to `morpheus`, overriding Janus's own judgment about which agent fits. Janus still performs the hand-off (including its normal identity/telemetry steps) — this command just fixes the destination.

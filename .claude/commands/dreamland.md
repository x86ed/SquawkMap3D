---
name: "Route"
description: Route this request to Janus, which delegates to the appropriate specialist agent
category: Workflow
tags: [workflow, routing]
---

Delegate this request to the `janus` agent. Janus checks `openspec status` (if relevant) and decides which specialist agent should handle it — `phantasos`, `nyx`, `morpheus`, `phobetor`, `baku`, `iktomi`, `zhougong`, `hypnos`, or `mengpo` — including delegating to `iktomi` when the request has no OpenSpec context at all (free-form coding).

This is the generic entry point: unlike `/opsx:*`, which cover the OpenSpec lifecycle specifically, `/drmlnd:route` hands the routing decision to Janus.

<!-- dreamland-managed: safe to overwrite on `dreamland init` -->

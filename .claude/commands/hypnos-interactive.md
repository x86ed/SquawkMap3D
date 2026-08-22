---
name: "hypnos-interactive"
description: Open an editable litegraph.js visualization of the current agent/skill/hook graph
category: Workflow
tags: [workflow, visualization]
---

Run `dreamland hypnos-serve --mode=interactive` and report the printed local URL to the user (the command also attempts to open it in their default browser).

This starts a local, `127.0.0.1`-only server rendering the same graph as `/hypnos-view`, but editable: moving, connecting, detaching, creating, or deleting nodes in the browser writes back to the six platform files through the same writer/tool-tier logic `hypnos` (agent authoring) and `mengpo` (archival) already apply by hand — the graph is a UI over those files, not a separate store.

<!-- dreamland-managed: safe to overwrite on `dreamland init` -->

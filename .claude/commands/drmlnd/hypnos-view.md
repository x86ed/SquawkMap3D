---
name: "hypnos-view"
description: Open a read-only litegraph.js visualization of the current agent/skill/hook graph
category: Workflow
tags: [workflow, visualization]
---

Run `dreamland hypnos-serve --mode=view` and report the printed local URL to the user (the command also attempts to open it in their default browser).

This starts a local, `127.0.0.1`-only server rendering every agent, skill, and hook installed in this repository as a litegraph.js graph — routing edges, hook attachments, and skill attachments all shown as connections. It refreshes live as the underlying files change (a filesystem watcher pushes updates over Server-Sent Events), so it's useful for watching work as it happens. No write path exists in this mode.

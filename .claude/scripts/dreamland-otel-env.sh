#!/bin/sh
# Appends OTEL env vars to $CLAUDE_ENV_FILE for Claude Code sessions.
# Claude Code sources this file into subsequent Bash tool invocations.
if [ -z "$CLAUDE_ENV_FILE" ]; then
  exit 0
fi
printf 'OTEL_EXPORTER_OTLP_ENDPOINT=%s\n' 'http://localhost:4317' >> "$CLAUDE_ENV_FILE"
printf 'OTEL_EXPORTER_OTLP_PROTOCOL=grpc\n' >> "$CLAUDE_ENV_FILE"
printf 'OTEL_SERVICE_NAME=dreamland\n' >> "$CLAUDE_ENV_FILE"

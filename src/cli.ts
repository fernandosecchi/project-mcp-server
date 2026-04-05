#!/usr/bin/env node

/**
 * CLI entry point.
 * - `project-mcp-server setup` → corre el setup interactivo
 * - `project-mcp-server` (sin args) → arranca el MCP server
 */

const command = process.argv[2]

if (command === "setup") {
  await import("./setup/index.js")
} else {
  await import("./index.js")
}

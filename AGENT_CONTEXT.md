# Agent Context Summary

This file serves as the main entry point to understand the structure and purpose of the `nest-extended` repository. AI Agents should read this context before starting new tasks to save time on codebase exploration.

## Project Overview
**NestExtended** is a monorepo workspace providing reusable components, utilities, and a robust CLI to enhance NestJS development.

## Key Directories
- `packages/`: Contains all published NPM packages (core, mongoose, cli, decorators).
- `scripts/`: Internal task scripts (e.g., build and release workflows).

## Published Packages
1. **`@nest-extended/core`**: Base classes, utilities, and common patterns forming the robust foundation.
2. **`@nest-extended/mongoose`**: Abstract generic `NestService` for seamless MongoDB operations, pagination, schemas, and query extensions.
3. **`@nest-extended/cli`**: Scaffolding tool (`nest-cli`, `nestx-cli`) for resources (services, controllers, modules, schemas) and applications.
4. **`@nest-extended/decorators`**: Repetitive logic generic decorators across the domain.

## Guidelines for AI Tasks
- First understand if the current goal is related to a specific package or the workspace overall.
- Check dependencies when generating resources to ensure they correctly resolve.
- Use this `AGENT_CONTEXT.md` as your initial prompt context for a seamless start in future workflows.

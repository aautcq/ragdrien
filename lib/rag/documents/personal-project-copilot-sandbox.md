---
source: https://github.com/aautcq/copilot-sandbox
fetchedAt: 2026-10-03T16:53:02.000Z
---

# copilot-sandbox

A generic, repo-agnostic sandbox for running GitHub Copilot CLI unattended ("AFK"/autopilot) against any git repo, isolated from the host machine and from production credentials/services. It creates a sibling git worktree next to the target repo and launches a container (Podman preferred, Docker as fallback) with the worktree bind-mounted, dropping into an interactive Copilot CLI session with every tool call auto-approved.

## Technologies

- Shell scripting
- Docker / Podman (containerization)
- Git worktrees

Repo: <https://github.com/aautcq/copilot-sandbox>

# Lauda 2.0

This workspace is part of the Lauda 2.0 project. Preserve unrelated local changes.

## Windows publication

Use the dedicated publisher described in [PUBLISHER.md](PUBLISHER.md). It runs under the owner's standard Windows account and accepts only fixed publication actions through the local queue.

- Inspect first: `node scripts/request-publication.cjs status`.
- Tests environment: `node scripts/request-publication.cjs publish-staging` or `restart-staging`.
- Production: `node scripts/request-publication.cjs publish-production` or `restart-production`, only when authorized for that environment by the user.
- Prepare and test both candidate artifacts and release manifests before publishing. The publisher does not build, run migrations, change Cloudflare, or push Git.
- If the publisher is not installed, give the user the administrator installation command in PUBLISHER.md. Do not try to elevate the chat, add it to Administrators, or change permissions on existing application processes.
- A failed/timeout/interrupted request is not permission to repeat it automatically. Read its result with `node scripts/request-publication.cjs --result <id>` and inspect the active release and backups first.
- A queued action is not a successful deployment. Report success only after the result and public smoke checks.
- The installer is one-time, separate from publication. It does not restart or publish either environment.
- If installation created the task but no heartbeat, use the installer's explicit `-Repair` mode from an administrator PowerShell under the original owner account. It preserves task diagnostics and refuses an active publication. The current task uses the owner's logged-on session; the owner must remain signed in. Inspect `.lauda-publisher/installation-startup-failed.json`, `launcher.log` and `worker.stderr.log` if startup fails again.

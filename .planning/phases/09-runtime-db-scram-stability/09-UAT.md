---
status: testing
phase: 09-runtime-db-scram-stability
source: [manual-targets: login-loop, blog-cron-scram]
started: 2026-04-04T18:42:05.761Z
updated: 2026-04-04T18:42:05.761Z
---

## Current Test

number: 1
name: Cold Start Smoke Test
expected: |
  Stop any running server process. Start the app from a cold state.
  The server boots without DB auth errors, login endpoint responds, and the blog cron endpoint request does not return HTTP 500 with "server signature is missing".
awaiting: user response

## Tests

### 1. Cold Start Smoke Test
expected: Stop any running server process. Start the app from a cold state. The server boots without DB auth errors, login endpoint responds, and the blog cron endpoint request does not return HTTP 500 with "server signature is missing".
result: [pending]

### 2. Login Does Not Loop
expected: Logging in as skleanings@gmail.com authenticates and keeps the user in an authenticated route instead of bouncing back to /login.
result: [pending]

### 3. Post-Login Route Is Stable
expected: After successful login, navigation lands on the correct role route and remains stable across refresh (no redirect ping-pong between /admin, /admin/login, and /login).
result: [pending]

### 4. Blog Cron Request Handles Cold Start
expected: Triggering /api/blog/cron/generate on a cold start succeeds (2xx) or returns an expected skipped response, without SCRAM signature errors.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps

[none yet]

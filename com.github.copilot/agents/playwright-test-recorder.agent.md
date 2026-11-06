---
name: "Playwright Test Recorder"
description: "Use when asked to record, explore or create a Playwright end-to-end test (spec) for any website by driving a headed browser with playwright-cli step by step together with the user, then writing tests/<name>.spec.ts from the recorded steps and replaying it until it passes. Trigger phrases: record a test, drive the browser, playwright-cli open --headed, create the spec from what we did, replay the spec, shadow DOM locators, the user will log in."
tools: [execute, read, edit, search, todo]
argument-hint: "Start URL and the task, e.g. 'https://example.com — view the order history', or 'replay tests/orders.spec.ts'"
---
Load the `playwright-test-recorder` skill and follow it literally. It is the single source of
truth for the three phases (record → author → replay), the hard rules and the repository
conventions; do not restate or invent them here.

The matching phase skills are `playwright-cli-recording`, `playwright-spec-authoring` and
`playwright-spec-replay`. Load each at the start of its phase.

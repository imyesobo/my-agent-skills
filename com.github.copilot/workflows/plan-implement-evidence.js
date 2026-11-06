// plan-implement-evidence: plan-then-implement plus visual evidence (Playwright / Storybook screenshots).
// Plan with Opus 5.5, pause for review, implement + verify with Sonnet 5.5, then capture and review screenshots.
// Workflows are session-scoped. To use it, ask Copilot CLI to register this file via
// dynamic_workflows_manage (operation "author") with name "plan-implement-evidence",
// phases Plan / Review / Implement / Verify / Evidence / Report and
// argsSchema { task: string, skipReview?: boolean, skipEvidence?: boolean, maxScenarios?: integer, evidenceDir?: string }.
// Run it with args { task: "..." }; resume the paused run to start implementation.
async (ctx) => {
  const PLANNER = 'claude-opus-5.5';
  const IMPLEMENTER = 'claude-sonnet-5.5';
  // Evidence needs tool use (run servers/tests, debug flaky selectors) and image reading, so use the
  // implementer-class model. Opus is overkill here; Haiku is too weak at fixing broken Playwright setups.
  const CAPTURER = 'claude-sonnet-5.5';
  const REVIEWER = 'claude-sonnet-5.5';

  const task = ctx.args && typeof ctx.args.task === 'string' ? ctx.args.task.trim() : '';
  if (!task) {
    return { ok: false, reason: 'args.task is required' };
  }
  const maxScenarios = Number.isInteger(ctx.args.maxScenarios) && ctx.args.maxScenarios > 0 ? ctx.args.maxScenarios : 6;
  const evidenceDir = typeof ctx.args.evidenceDir === 'string' && ctx.args.evidenceDir.trim()
    ? ctx.args.evidenceDir.trim().replace(/\/+$/, '')
    : '.evidence/' + ctx.runId;

  const PLAN_SCHEMA = {
    type: 'object',
    required: ['summary', 'steps', 'risks'],
    properties: {
      summary: { type: 'string' },
      steps: {
        type: 'array',
        items: {
          type: 'object',
          required: ['title', 'files', 'instructions'],
          properties: {
            title: { type: 'string' },
            files: { type: 'array', items: { type: 'string' } },
            instructions: { type: 'string' },
          },
        },
      },
      risks: { type: 'array', items: { type: 'string' } },
    },
  };

  const SCENARIOS_SCHEMA = {
    type: 'object',
    required: ['approach', 'runCommands', 'scenarios'],
    properties: {
      approach: { type: 'string' },
      runCommands: { type: 'array', items: { type: 'string' } },
      scenarios: {
        type: 'array',
        items: {
          type: 'object',
          required: ['id', 'title', 'source', 'expected'],
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            source: { type: 'string', enum: ['playwright-test', 'storybook-story', 'new-playwright-script'] },
            expected: { type: 'string' },
            target: { type: 'string' },
          },
        },
      },
    },
  };

  const CAPTURE_SCHEMA = {
    type: 'object',
    required: ['id', 'status', 'screenshots', 'notes'],
    properties: {
      id: { type: 'string' },
      status: { type: 'string', enum: ['captured', 'failed'] },
      screenshots: { type: 'array', items: { type: 'string' } },
      notes: { type: 'string' },
    },
  };

  const REVIEW_SCHEMA = {
    type: 'object',
    required: ['verdict', 'observations'],
    properties: {
      verdict: { type: 'string', enum: ['pass', 'mismatch', 'unclear'] },
      observations: { type: 'string' },
    },
  };

  // ---------- Plan ----------
  ctx.phase('Plan');
  ctx.log('Planning with ' + PLANNER);
  const plan = await ctx.step('plan-v1', async () => {
    const result = await ctx.agent(
      [
        'You are the technical planner. Explore the repository (read-only, do NOT edit files) and produce an implementation plan for this task:',
        task,
        '',
        'First read the repo instruction files (AGENTS.md, CLAUDE.md, .github/copilot-instructions.md, README, package.json) to learn the stack, conventions and test commands.',
        'Return JSON: summary (2-3 sentences), steps (ordered, each independently verifiable and small enough for a junior-level implementer: title, files to create or modify, and precise instructions including names, APIs and edge cases), and risks (things to double check).',
        'Include steps for tests and for docs/stories when the change affects them. Prefer tests/stories that render each user-visible use case, so they can later be screenshotted as evidence.',
      ].join('\n'),
      { label: 'planner', model: PLANNER, schema: PLAN_SCHEMA }
    );
    return result === null ? null : result;
  });
  if (!plan || !Array.isArray(plan.steps) || plan.steps.length === 0) {
    return { ok: false, reason: 'planner returned no usable plan' };
  }
  ctx.log('Plan has ' + plan.steps.length + ' steps: ' + plan.steps.map((s, i) => (i + 1) + '. ' + s.title).join(' | '));

  if (!ctx.args.skipReview) {
    ctx.phase('Review');
    ctx.log('Paused for plan review. Resume run ' + ctx.runId + ' to start implementation.');
    await ctx.pause('plan-review');
  }

  // ---------- Implement ----------
  ctx.phase('Implement');
  const done = [];
  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i];
    ctx.log('Step ' + (i + 1) + '/' + plan.steps.length + ': ' + step.title);
    const res = await ctx.step('impl-v1-' + i, async () => {
      const out = await ctx.agent(
        [
          'You are implementing step ' + (i + 1) + ' of ' + plan.steps.length + ' of an approved plan. Make the code changes now using the edit/create tools; do not re-plan or widen scope.',
          'Overall task: ' + task,
          'Plan summary: ' + plan.summary,
          'Risks to respect: ' + plan.risks.join('; '),
          'Steps already done: ' + (done.length ? done.map((d) => d.title).join('; ') : 'none'),
          '',
          'THIS STEP: ' + step.title,
          'Files: ' + step.files.join(', '),
          'Instructions: ' + step.instructions,
          '',
          'Follow the repo conventions in its instruction files. Finish with a 2-3 line summary of what you changed and anything that deviated from the instructions.',
        ].join('\n'),
        { label: 'implement:' + (i + 1), model: IMPLEMENTER }
      );
      return out === null ? null : { title: step.title, report: out };
    });
    if (!res) {
      return { ok: false, reason: 'implementation failed at step ' + (i + 1) + ': ' + step.title, completed: done, plan };
    }
    done.push(res);
  }

  // ---------- Verify ----------
  ctx.phase('Verify');
  const verification = await ctx.step('verify-v1', async () => {
    const out = await ctx.agent(
      'Find the project test/lint/build commands (package.json scripts or repo docs) and run the relevant ones. Fix only failures caused by the changes for this task: ' + task + '. Report pass/fail counts and any remaining failures with file and error.',
      { label: 'verify', model: IMPLEMENTER }
    );
    return out === null ? null : out;
  });

  if (ctx.args.skipEvidence) {
    return {
      ok: verification !== null,
      summary: plan.summary,
      steps: done,
      verification: verification === null ? '(verification agent failed)' : verification,
    };
  }

  // ---------- Evidence ----------
  ctx.phase('Evidence');
  ctx.log('Choosing evidence scenarios (max ' + maxScenarios + '), output in ' + evidenceDir);
  const changeSummary = done.map((d, i) => (i + 1) + '. ' + d.title + ': ' + d.report).join('\n');

  const scenarioPlan = await ctx.step('evidence-scenarios-v1', async () => {
    const out = await ctx.agent(
      [
        'You prepare visual evidence for a finished frontend change. Do NOT edit source files in this step; only read and run read-only commands.',
        'Task that was implemented: ' + task,
        'Change summary:',
        changeSummary,
        '',
        'Discover how this repo can render the use cases: Playwright config/tests (playwright.config.*, e2e/ or tests/ folders), Storybook (.storybook/, *.stories.*), and package.json scripts for them.',
        'Pick at most ' + maxScenarios + ' scenarios that best prove the change works visually: the main use case first, then key states/edge cases (empty, error, loading, responsive) only if relevant.',
        'For each scenario choose the cheapest source: an existing Playwright test (source "playwright-test", target = test file + title), an existing or newly added story (source "storybook-story", target = story id), or a short standalone Playwright script (source "new-playwright-script").',
        'Return JSON: approach (how servers are started, ports, whether browsers are installed), runCommands (exact commands to start dev server/storybook if needed), scenarios (id as kebab-case, title, source, expected = what a reviewer should SEE in the screenshot, target).',
        'If the repo has no way to render anything visual (no frontend), return an empty scenarios array and explain in approach.',
      ].join('\n'),
      { label: 'evidence-planner', model: CAPTURER, schema: SCENARIOS_SCHEMA }
    );
    return out === null ? null : out;
  });

  if (!scenarioPlan || !Array.isArray(scenarioPlan.scenarios) || scenarioPlan.scenarios.length === 0) {
    ctx.log('No visual scenarios available: ' + (scenarioPlan ? scenarioPlan.approach : 'evidence planner failed'));
    return {
      ok: verification !== null,
      summary: plan.summary,
      steps: done,
      verification: verification === null ? '(verification agent failed)' : verification,
      evidence: { captured: false, reason: scenarioPlan ? scenarioPlan.approach : 'evidence planner failed' },
    };
  }
  const scenarios = scenarioPlan.scenarios.slice(0, maxScenarios);
  ctx.log('Scenarios: ' + scenarios.map((s) => s.id).join(', '));

  // Sequential: scenarios share dev servers, ports and browser state, so parallel runs would collide.
  const evidence = [];
  for (let i = 0; i < scenarios.length; i++) {
    const sc = scenarios[i];
    ctx.log('Capturing ' + (i + 1) + '/' + scenarios.length + ': ' + sc.id);
    const captured = await ctx.step('capture-v1-' + sc.id, async () => {
      const cap = await ctx.agent(
        [
          'Capture visual evidence for ONE scenario. Save PNG screenshots under ' + evidenceDir + '/' + sc.id + '/ (create the folder).',
          'Scenario: ' + sc.title + ' (source: ' + sc.source + (sc.target ? ', target: ' + sc.target : '') + ')',
          'Expected to be visible: ' + sc.expected,
          'Environment notes: ' + scenarioPlan.approach,
          'Start commands (if a server is needed, start it in the background, wait until it responds, and stop it when done): ' + scenarioPlan.runCommands.join(' ; '),
          '',
          'How: for playwright-test, run that test with screenshots forced on (e.g. --reporter=line and page.screenshot via a small helper or use: --trace off with `screenshot: "on"` through CLI/env override) and copy the resulting PNG(s) to the folder. For storybook-story, open the story iframe (/iframe.html?id=<story-id>&viewMode=story) in Playwright and take a screenshot. For new-playwright-script, write a throwaway script in the evidence folder, run it, keep it next to the PNG.',
          'Install Playwright browsers only if missing (npx playwright install chromium). Do not modify product source files. If it fails, fix the capture setup (not the product) up to 2 attempts; otherwise report status "failed".',
          'Use full-page or component-scoped screenshots at a readable viewport (e.g. 1280x800). Return JSON with id "' + sc.id + '", status, screenshots (paths relative to the repo root) and notes.',
        ].join('\n'),
        { label: 'capture:' + sc.id, model: CAPTURER, schema: CAPTURE_SCHEMA }
      );
      return cap === null ? { id: sc.id, status: 'failed', screenshots: [], notes: 'capture agent failed' } : cap;
    });
    evidence.push({ scenario: sc, capture: captured });
  }

  // ---------- Report ----------
  ctx.phase('Report');
  const reviewed = await ctx.parallel(
    evidence.map((e) => async () => {
      if (e.capture.status !== 'captured' || e.capture.screenshots.length === 0) {
        return { verdict: 'unclear', observations: 'no screenshot: ' + e.capture.notes };
      }
      const r = await ctx.agent(
        [
          'Look at these screenshots with the view tool (read-only, do not edit anything): ' + e.capture.screenshots.join(', '),
          'Scenario: ' + e.scenario.title,
          'It should show: ' + e.scenario.expected,
          'Judge honestly whether the screenshot really shows that (not a blank page, error overlay, loading spinner or 404). Return verdict pass / mismatch / unclear and 1-3 sentences of observations.',
        ].join('\n'),
        { label: 'review:' + e.scenario.id, model: REVIEWER, schema: REVIEW_SCHEMA }
      );
      return r === null ? { verdict: 'unclear', observations: 'reviewer failed' } : r;
    })
  );
  const results = evidence.map((e, i) => ({
    id: e.scenario.id,
    title: e.scenario.title,
    source: e.scenario.source,
    status: e.capture.status,
    screenshots: e.capture.screenshots,
    verdict: reviewed[i] ? reviewed[i].verdict : 'unclear',
    observations: reviewed[i] ? reviewed[i].observations : 'review failed',
    notes: e.capture.notes,
  }));

  const reportPath = evidenceDir + '/REPORT.md';
  await ctx.step('write-report-v1', async () => {
    const out = await ctx.agent(
      [
        'Create the file ' + reportPath + ' (Markdown) using the create tool. Do not touch other files.',
        'Content: title, task, change summary, then one section per scenario with its verdict, observations and the screenshot embedded with a path relative to the report (e.g. ![title](<id>/<file>.png)).',
        'Task: ' + task,
        'Plan summary: ' + plan.summary,
        'Verification: ' + (verification === null ? 'failed' : verification),
        'Scenarios JSON: ' + JSON.stringify(results),
        'Reply with just "done".',
      ].join('\n'),
      { label: 'report', model: 'claude-haiku-4.5' }
    );
    return out === null ? null : 'ok';
  });

  const allPass = results.every((r) => r.verdict === 'pass');
  return {
    ok: verification !== null && allPass,
    summary: plan.summary,
    steps: done,
    verification: verification === null ? '(verification agent failed)' : verification,
    evidence: { dir: evidenceDir, report: reportPath, allPass, results },
  };
}

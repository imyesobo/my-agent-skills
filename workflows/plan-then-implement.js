// plan-then-implement: plan with Claude Opus 5.5, pause for review, implement with Claude Sonnet 5.5.
// Workflows are session-scoped. To use it, ask Copilot CLI to register this file via
// dynamic_workflows_manage (operation "author") with name "plan-then-implement",
// phases Plan / Review / Implement / Verify and argsSchema { task: string, skipReview?: boolean }.
// Run it with args { task: "..." }; resume the paused run to start implementation.
async (ctx) => {
  const PLANNER = 'claude-opus-5.5';
  const IMPLEMENTER = 'claude-sonnet-5.5';
  const task = ctx.args && typeof ctx.args.task === 'string' ? ctx.args.task.trim() : '';
  if (!task) {
    return { ok: false, reason: 'args.task is required' };
  }

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
        'Include steps for tests and for docs/stories when the change affects them.',
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

  ctx.phase('Verify');
  const verification = await ctx.agent(
    'Find the project test/lint/build commands (package.json scripts or repo docs) and run the relevant ones. Fix only failures caused by the changes for this task: ' + task + '. Report pass/fail counts and any remaining failures with file and error.',
    { label: 'verify', model: IMPLEMENTER }
  );

  return {
    ok: verification !== null,
    summary: plan.summary,
    steps: done,
    verification: verification === null ? '(verification agent failed)' : verification,
  };
}

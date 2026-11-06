# Session improve

Run this yourself at the end of a session. The point is the next session of the same kind of work should spend fewer AI credits.

Use only this session: the goals, the steps taken, and the prompts, skills, agents, and workflows that were actually used. Do not read Copilot source, its install, or its session logs.

## What is worth changing

Propose a change only if it would make a later session spend fewer credits. Prefer, in this order:

1. A skill that runs a deterministic script, so that step spends no model tokens.
2. A shorter prompt, when a long one caused repeated exploration.
3. An agent, only if a cheaper model can do a step this session spent an expensive model on.
4. A workflow, only if this session repeated a multi-step handoff a workflow would run on cheaper models.

Do not add a prompt, agent, or workflow step that makes the model do more work. Ignore style, naming, and one-off tasks that will not recur.

## What to do

1. State each goal of this session in one line.
2. For each goal, say if a missing or better prompt, skill, agent, or workflow would have finished it with fewer credits. Tie that to something that happened: a repeated command, reread files, an unused skill, or a retried step.
3. Propose at most 3 file changes. For each one, say create or edit, the path, and in one sentence why it saves credits.
4. New and edited files belong in this collection, matching the layout already here:
   - skills: `skills/<name>/SKILL.md`, with `scripts/` for deterministic steps and `references/` for the prompt text
   - agents: `com.github.copilot/agents/<name>.agent.md`
   - workflows: `com.github.copilot/workflows/<name>.js`
5. Change a file that was used this session when a smaller instruction or a script would replace work the model repeated. Do not edit product code in other repos.
6. If nothing would clearly save credits, say so and stop.
7. Do not write files unless the user told you to apply. If they did, write only the proposed files.

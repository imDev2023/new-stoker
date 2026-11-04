# Issue tracker: GitHub

Issues and PRDs for this repo live as GitHub issues. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`, filtering comments by `jq` and also fetching labels.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."` (on a ticket, post the closing record with `gh issue comment` first: a closed ticket drops the comment of `close --comment`).
- **Make an issue a sub-issue of a parent**: `gh issue create --parent <parent> ...`, or `gh issue edit <parent> --add-sub-issue <child>` afterwards (`gh` 2.94+); older `gh`: `gh api --method POST repos/imDev2023/new-stoker/issues/<parent>/sub_issues -F sub_issue_id=<child-db-id>` (the database id, as in **Blocking** below).

Infer the repo from `git remote -v` - `gh` does this automatically when run inside a clone.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/triage` reads this flag.)_

When set to `yes`, PRs run through the same labels and states as issues, using the `gh pr` equivalents:

- **Read a PR**: `gh pr view <number> --comments` and `gh pr diff <number>` for the diff.
- **List external PRs for triage**: `gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments` then keep only `authorAssociation` of `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR`, or `NONE` (drop `OWNER`/`MEMBER`/`COLLABORATOR`).
- **Comment / label / close**: `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close`.

GitHub shares one number space across issues and PRs, so a bare `#42` may be either - resolve with `gh pr view 42` and fall back to `gh issue view 42`.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.

## Multica mirror

GitHub issues are the source of truth; the owner's Multica dashboard (workspace Pandora, project `MULTICA_PROJECT_ID`) only mirrors them.
Every GitHub issue has one Multica ticket whose title starts with `#<number>`.
Mirror at the end of each session with the `multica-sync` skill: status changes, new issues and the "Current step" section.
Every Multica write passes `--no-start`, new tickets are assigned to `Farren Elli`, and no ticket is ever assigned to an agent.

## Wayfinding operations

The **map** is issue #1 (label `wayfinder:map`) and the build tickets (label `build`) are its sub-issues, as in the owner's Top-pad.

- **Blocking**: GitHub's native issue dependencies, the canonical and UI-visible representation.
  Add an edge with `gh api --method POST repos/imDev2023/new-stoker/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, where `<blocker-db-id>` is the blocker's numeric database id (`gh api repos/imDev2023/new-stoker/issues/<n> --jq .id`, not the `#number` or the `node_id`).
  GitHub reports `issue_dependencies_summary.blocked_by` (open blockers only, the live gate); each ticket also carries a `## Blocked by` section naming them, for reading.
  A ticket is unblocked when every blocker is closed.
- **Frontier**: the map's open sub-issues with no open blocker and no assignee, in the order of the map's `## Next`.
- **Claim**: `gh issue edit <n> --add-assignee @me`, the session's first write; a relay session's ticket carries `relay:running` instead, which `relay.py finish` removes.
- **Resolve**: `gh issue comment <n> --body-file <file>` with the closing record, then close the ticket (or let the PR's `Closes #<n>` close it), then add its line to the map's done lines and make `## Next` name what follows.

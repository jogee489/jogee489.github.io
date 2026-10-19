# Project rules

## Git commits

- Author name and email must always be `JJ Dorko <jdorko90@gmail.com>`
- Commit messages, PR titles and PR bodies describe the change
- When Claude Code wrote or helped write a change, end the commit message and the PR body with a blank line and then `Generated-by: Claude Code`. The author stays JJ Dorko
- No other credit lines: no `Co-Authored-By` for tools and no session links

## Branches

- Commit directly to `main`; don't create feature branches unless the user asks for one
- If the session starts on any branch other than `main`, switch to `main` before committing

## Push policy

- Never push unless the user explicitly says "push"

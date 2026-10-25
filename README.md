# jjdorko.com — Portfolio

Personal portfolio site for JJ Dorko, backend software engineer.

Built with [Astro](https://astro.build), three.js, React islands, and TypeScript. Deployed to GitHub Pages via GitHub Actions.

The page opens on a 3D desk whose monitor runs a working shell. Scrolling moves the camera into the screen, and the rest of the page is a two-column résumé layout. Press `` ` `` anywhere to open the same shell full screen.

## Stack

- **Astro** — static site framework, content collections for projects
- **three.js** — the desk scene
- **React** — interactive islands (contact form, repo strip)
- **TypeScript** — throughout
- **Web3Forms** — contact form email delivery (no backend required)
- **GitHub Pages** — hosting, auto-deployed on push to `main`

## Local development

```sh
npm install
npm run dev        # dev server at localhost:4321
npm run build      # production build to ./dist
npm run preview    # preview the production build locally
```

## Testing

```sh
npm test           # Vitest: the shell, the résumé formatting and checks, and the résumé script (about 10 seconds)
npm run test:e2e   # Playwright against a production build: console, keyboard, scrolling, links, repo strip, résumé, video
```

- **Unit tests** cover every shell command, path handling and tab completion (`src/scripts/shell-core.test.ts`), how the résumé is read, formatted and checked for phone numbers (`src/scripts/resume-format.test.ts`), and project links (`src/data/projects.test.ts`).
- **Script tests** (`scripts/*.test.ts`) run `scripts/resume.ts` for real in a temporary folder, with a local server standing in for jjdorko.com: a clean doc, a doc it must refuse, no copy to fall back to, a changed page setup, offline builds and the daily change check.
- **End-to-end tests** (`tests/e2e/`) cover the wiring the unit tests can't see. GitHub, YouTube and Google Fonts are stubbed and the résumé comes from `tests/fixtures/resume-export.html`, so they run offline.
- The script and end-to-end tests need Playwright's Chromium: on a new machine, run `npx playwright install chromium` once, or set `PLAYWRIGHT_CHROMIUM_PATH` to a Chromium that's already installed.

## Project structure

```
src/
├── components/          # Astro + React components (one per page section)
├── content/
│   └── projects/        # One .md file per project in Work
├── content.config.ts    # Fields each project file must have
├── data/
│   ├── links.ts         # LinkedIn, GitHub and résumé links used across the site
│   ├── projects.ts      # Where each project links to
│   └── skills.ts        # Output of the shell's `skills` command
├── pages/
│   └── index.astro      # Homepage (single page)
├── scripts/
│   ├── desk.ts          # three.js desk scene and camera move
│   ├── shell-core.ts    # Shell commands and filesystem logic (no DOM, unit tested)
│   └── shell.ts         # Builds the shell's files from the page; drives the monitor and console
tests/
└── e2e/                 # Playwright end-to-end tests
└── styles/
    └── portfolio.css    # All styles and design tokens
public/
├── images/              # Project screenshots
└── favicon.svg
```

## Adding a project

1. Create `src/content/projects/<slug>.md`. The fields are checked against the schema in `src/content.config.ts` when the site builds:
   ```yaml
   order: 5
   name: "Project Name"
   role: "Your role"
   stack: ["Tech", "Stack"]
   blurb: "One or two sentences."
   repo: "github.com/jogee489/repo-name"   # needed unless repoPublic is false
   repoPublic: true                        # optional, default true; false links to the video or case study instead
   image: "/images/screenshot.png"         # optional; for a project with a video, the poster shown before play
   video: "ZxlBJATvUNM"                    # optional YouTube ID, played in Work only after a click
   status: "In development"                # optional label next to the name
   caseStudy: "https://..."                # optional
   featured: true                          # optional; the one project shown large at the top of Work
   ```
2. That's it. The project shows up in Work and in the shell (`ls projects`, `cat <slug>`, `open <slug>`).

## Résumé

`scripts/resume.ts` runs before every build. It downloads the résumé Google Doc and writes `public/resume.pdf` (US Letter, titled "JJ Dorko – Résumé") and the text the shell uses for `resume.txt` and `skills`.

- **What it won't publish:** a doc with a phone number in it (including behind a tel: or WhatsApp link), or a page that isn't the résumé (Google shows a sign-in page if the doc stops being shared). The doc is shared with anyone who has the link, so keep anything private out of it.
- **When something's wrong:** it keeps the copy already on jjdorko.com, the deploy still goes out, and the run's last job, "Résumé check", fails with the reason, so GitHub emails you. It also fails, after publishing the new copy, when the doc's page setup or skills format changed and the script needs updating.
- **Format it relies on:** section titles are bold, all-caps paragraphs, and skills are "Label: a, b, c" lines under TECHNICAL SKILLS.
- **Locally:** `npm run dev` reuses the last copy if it came from the doc; `npm run resume` refreshes it. Offline, the build writes a placeholder. The end-to-end tests build from `tests/fixtures/resume-export.html`, and `RESUME_HTML=<file> npm run resume` does the same by hand.

## Deployment

`.github/workflows/deploy.yml` runs on every push to `main`, daily, and from "Run workflow" on GitHub. It builds with Node 26, runs the unit and end-to-end tests, and deploys to GitHub Pages.

- **Daily runs** first check whether the résumé doc changed, and only rebuild if it did. They also re-enable the workflow through GitHub's API, because GitHub switches off scheduled workflows in a public repo after 60 days without activity.
- **Résumé check** is the last job. It fails, and GitHub emails you, when the résumé couldn't be refreshed; the site still deploys with the copy it had.
- **The run summary** lists the repos in the strip that have no `.github/screenshot.png`.

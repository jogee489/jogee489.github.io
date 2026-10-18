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
npm test           # unit tests for the shell's commands (Vitest, well under a second)
npm run test:e2e   # Playwright against a production build: console, keyboard, scrolling, links, repo strip
```

- **Unit tests** (`src/scripts/shell-core.test.ts`) cover every command, path handling and tab completion. The shell engine in `shell-core.ts` has no DOM access, so these run in plain Node.
- **End-to-end tests** (`tests/e2e/`) cover the wiring the unit tests can't see. GitHub and Google Fonts are stubbed, so they run offline. On a new machine, run `npx playwright install chromium` once first.

## Project structure

```
src/
├── components/          # Astro + React components (one per page section)
├── content/
│   └── projects/        # One .md file per featured project
├── data/
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

1. Create `src/content/projects/<slug>.md` with the required frontmatter:
   ```yaml
   order: 7
   name: "Project Name"
   role: "Your role"
   stack: ["Tech", "Stack"]
   blurb: "One-sentence description."
   repo: "github.com/jogee489/repo-name"
   image: "/images/screenshot.png"   # optional
   ```
2. That's it. The project shows up in Work and in the shell (`ls projects`, `cat <slug>`, `open <slug>`). The first project with an `image` is the featured one.

## Deployment

Pushes to `main` automatically trigger the GitHub Actions workflow (`.github/workflows/deploy.yml`), which builds with Node 24 and deploys to GitHub Pages.

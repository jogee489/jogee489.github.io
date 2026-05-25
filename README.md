# jjdorko.com — Portfolio

Personal portfolio site for JJ Dorko, backend software engineer.

Built with [Astro](https://astro.build), React islands, and TypeScript. Deployed to GitHub Pages via GitHub Actions.

## Stack

- **Astro 5** — static site framework, content collections for projects
- **React** — interactive islands (terminal, contact form)
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

## Project structure

```
src/
├── components/          # Astro + React components
│   └── tiles/           # Project card tile illustrations
├── content/
│   └── projects/        # One .md file per featured project
├── data/
│   └── skills.ts        # Skills section data
├── pages/
│   └── index.astro      # Homepage (single page)
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
   tile: "slug"
   image: "/images/screenshot.png"   # optional
   ```
2. Create a matching tile component at `src/components/tiles/<Slug>Tile.astro`.
3. Add the tile case to `src/components/ProjectCard.astro`.

## Deployment

Pushes to `main` automatically trigger the GitHub Actions workflow (`.github/workflows/deploy.yml`), which builds with Node 24 and deploys to GitHub Pages.

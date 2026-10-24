# TODO

## Phone
- [ ] Test the site on real phones (iOS Safari, Android Chrome): the desk intro, tapping the monitor, the full-screen shell and its command buttons
- [ ] Update the phone layout based on what testing turns up
- [ ] Add a phone-size, touch-enabled run (390×844) to the Playwright suite

## Desk scene
- [ ] Play a project's demo video on the phone on the desk instead of a still screenshot
- [ ] Model the desk in Blender with baked lighting to replace the primitive shapes in `src/scripts/desk.ts` (better look, cheaper to render)

## Repo strip
- [ ] Play a demo video in the enlarged card on hover — convention would be `.github/demo.mp4` alongside `.github/screenshot.png` in each repo
- [ ] Add screenshot to repos that are missing one (place at `.github/screenshot.png`)
- [ ] Add GitHub token as env var / GitHub Actions secret to raise API rate limit from 60 to 5000 req/hr

## Work
- [ ] Poster image for the Sensei Connect video once the redesign is done (today it shows a plain placeholder)
- [ ] Screenshots for Weather Pet and Marvel Rivals Randomizer

## Experience
- [ ] Add anything since 2021 (freelance work, teaching)

## Resume
- [ ] Pull resume content from an API endpoint instead of hardcoding in `src/scripts/shell.ts`

## Ideas / Bigger lifts
- [ ] Embed live demos for Capacitor/Flutter apps (Heartopia Hub, Weather Pet) via iframe
- [ ] Embed LunchRoulette via appetize.io APK stream for in-browser Android emulation
- [ ] Resume sync: GitHub Action that checks Google Doc modifiedTime and triggers redeploy when updated

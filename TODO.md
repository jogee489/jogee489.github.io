# TODO

## Phone
- [ ] Test the site on real phones (iOS Safari, Android Chrome): the desk intro, tapping the monitor, the full-screen shell and its command buttons
- [ ] Update the phone layout based on what testing turns up
- [ ] Add a phone-size, touch-enabled run (390×844) to the Playwright suite

## Desk scene
- [ ] Model the desk in Blender with baked lighting to replace the primitive shapes in `src/scripts/desk.ts` (better look, cheaper to render)

## Repo strip
- [ ] On hover: card expands and plays a demo video — convention would be `.github/demo.mp4` alongside `.github/screenshot.png` in each repo
- [ ] Swipe left/right on the strip to speed it up or slow it down (touch + pointer drag)
- [ ] Add screenshot to repos that are missing one (place at `.github/screenshot.png`)
- [ ] Add GitHub token as env var / GitHub Actions secret to raise API rate limit from 60 to 5000 req/hr

## Work
- [ ] Screenshots for Leap, Weather Pet, Lunch Roulette, Laser Defender and Marvel Rivals Randomizer, and decide how Work shows more than one (today only the first project with an `image` is featured)
- [ ] Confirm the Heartopia Hub description (it used to say "tabletop game companion"; the screenshot shows a collection tracker)

## Experience
- [ ] Add anything since 2021 (freelance work, teaching)

## Resume
- [ ] Pull resume content from an API endpoint instead of hardcoding in `src/scripts/shell.ts`

## Ideas / Bigger lifts
- [ ] Embed live demos for Capacitor/Flutter apps (Heartopia Hub, Weather Pet) via iframe
- [ ] Embed LunchRoulette via appetize.io APK stream for in-browser Android emulation
- [ ] Resume sync: GitHub Action that checks Google Doc modifiedTime and triggers redeploy when updated

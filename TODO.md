# TODO

## Repo Marquee
- [ ] On hover: card expands and plays a demo video — convention would be `.github/demo.mp4` alongside `.github/screenshot.png` in each repo
- [ ] Swipe left/right on the marquee to speed it up or slow it down (touch + pointer drag)
- [ ] Add screenshot to repos that are missing one (place at `.github/screenshot.png`)
- [ ] Add GitHub token as env var / GitHub Actions secret to raise API rate limit from 60 to 5000 req/hr

## Projects
- [ ] Upload screenshots for remaining 5 featured project tiles:
      Leap, Weather Pet, LunchRoulette, LaserDefender, Marvel Rivals Randomizer
- [ ] Add `open <project>` terminal command to launch the project URL in a new tab

## Resume
- [ ] Pull resume content from an API endpoint instead of hardcoding in Terminal.tsx

## Ideas / Bigger lifts
- [ ] Embed live demos for Capacitor/Flutter apps (Heartopia Hub, Weather Pet) via iframe
- [ ] Embed LunchRoulette via appetize.io APK stream for in-browser Android emulation
- [ ] Resume sync: GitHub Action that checks Google Doc modifiedTime and triggers redeploy when updated

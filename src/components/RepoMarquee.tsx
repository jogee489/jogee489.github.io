import { useEffect, useRef, useState } from 'react';
import { REPOS_API, screenshotUrl, shown, type Repo } from '../data/repos';

type Card = { name: string; url: string; img: string };

const SPEED = 0.032;  // px per ms the strip drifts on its own
const IDLE = 3000;    // ms after a manual scroll before the drift picks up again
const EASE = 160;     // ms time constant for button glides and drag flings
const GROW = 1.3;     // hover scale; keep in step with .repo:hover in portfolio.css

/** width of one card plus the gap after it */
const pitch = (track: HTMLElement) =>
  (track.firstElementChild as HTMLElement).offsetWidth + parseFloat(getComputedStyle(track).columnGap);

export default function RepoMarquee() {
  const [cards, setCards] = useState<Card[]>([]);
  const fetched = useRef(false);
  // Keyed by URL and shared by every copy of a card, so each screenshot is requested once
  const [loaded, setLoaded] = useState<Set<string>>(() => new Set());
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  // True once the list is wider than the strip; then it loops and the arrows show
  const [loop, setLoop] = useState(false);
  const strip = useRef<HTMLDivElement>(null);
  const nudge = useRef((_dir: number) => {});

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;

    fetch(REPOS_API)
      .then(r => r.json())
      .then((data: Repo[]) => {
        if (!Array.isArray(data)) return;
        const list = shown(data).map(r => ({ name: r.name, url: r.html_url, img: screenshotUrl(r) }));
        setCards(list);
        // The shell lists these under ~/repos
        window.dispatchEvent(new CustomEvent('repos:loaded', { detail: list }));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    const track = el.firstElementChild as HTMLElement;
    // Three copies of the list; the view stays inside the middle one, so a jump of one copy's
    // width (span) is invisible and the strip scrolls forever in both directions.
    let span = cards.length * pitch(track);
    const sized = new ResizeObserver(() => {
      span = cards.length * pitch(track);
      setLoop(span > el.clientWidth);
      if (loop) { wrap(); put(); }
    });
    sized.observe(el);
    if (!loop) return () => sized.disconnect();

    const still = matchMedia('(prefers-reduced-motion: reduce)');
    let pos = span;               // where we last scrolled to
    let glide = 0;                // distance still to cover after an arrow press or a fling
    let touched = -Infinity;      // last manual scroll
    let hover = false, held = false;
    let raf = 0, last = 0, settle = 0;

    const wrap = () => { pos = span + ((((pos - span) % span) + span) % span); };
    const put = () => { el.scrollLeft = pos; };
    put();

    const frame = (t: number) => {
      const dt = Math.min(t - last, 250);
      last = t;
      if (glide) {
        const step = Math.abs(glide) < 0.5 ? glide : glide * (1 - Math.exp(-dt / EASE));
        pos += step;
        glide -= step;
        wrap(); put();
      } else if (!hover && !held && !still.matches && t - touched > IDLE && !el.querySelector(':focus-visible')) {
        pos += SPEED * dt;
        wrap(); put();
      }
      raf = requestAnimationFrame(frame);
    };
    // Only animate while the strip is on screen
    const seen = new IntersectionObserver(([e]) => {
      cancelAnimationFrame(raf);
      if (e.isIntersecting) raf = requestAnimationFrame(t => { last = t; frame(t); });
    });
    seen.observe(el);

    // Trackpad, touch and keyboard focus scroll the strip natively; follow along, then
    // recentre once it comes to rest so momentum isn't cut short.
    const settleSoon = () => {
      clearTimeout(settle);
      settle = window.setTimeout(() => { if (!held) { wrap(); put(); } }, 150);
    };
    const onScroll = () => {
      if (Math.abs(el.scrollLeft - pos) < 2) return;  // our own write
      pos = el.scrollLeft;
      glide = 0;
      touched = performance.now();
      settleSoon();
    };
    const onTouch = (e: TouchEvent) => {
      held = e.type === 'touchstart';
      touched = performance.now();
      if (!held) settleSoon();
    };

    // Mouse drag, with a fling on release
    let lastX = 0, lastT = 0, moved = 0, vel = 0;
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      held = true;
      glide = 0;
      moved = vel = 0;
      lastX = e.clientX;
      lastT = e.timeStamp;
    };
    const onMove = (e: PointerEvent) => {
      if (!held || e.pointerType !== 'mouse') return;
      const dx = e.clientX - lastX, dt = e.timeStamp - lastT;
      lastX = e.clientX;
      lastT = e.timeStamp;
      moved += Math.abs(dx);
      if (moved > 6 && !el.classList.contains('dragging')) {
        el.setPointerCapture(e.pointerId);
        el.classList.add('dragging');
      }
      if (dt > 0) vel = 0.8 * (-dx / dt) + 0.2 * vel;
      pos -= dx;
      wrap(); put();
    };
    const onUp = (e: PointerEvent) => {
      if (!held || e.pointerType !== 'mouse') return;
      held = false;
      touched = performance.now();
      el.classList.remove('dragging');
      if (moved > 6 && e.timeStamp - lastT < 80 && !still.matches) glide = vel * EASE;
    };
    // A drag ends in a click; don't let it open the repo
    const onClick = (e: MouseEvent) => {
      if (e.detail && moved > 6) e.preventDefault();
    };
    const onEnter = (e: PointerEvent) => { if (e.pointerType !== 'touch') hover = true; };
    const onLeave = () => { hover = false; };
    const noDrag = (e: DragEvent) => e.preventDefault();

    nudge.current = dir => {
      const p = span / cards.length;
      const by = dir * p * Math.max(1, Math.floor(el.clientWidth / p) - 1);
      // land on a card edge
      const to = Math.round((pos + glide + by) / p) * p;
      touched = performance.now();
      if (still.matches) { pos = to; wrap(); put(); } else glide = to - pos;
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('touchstart', onTouch, { passive: true });
    el.addEventListener('touchend', onTouch, { passive: true });
    el.addEventListener('touchcancel', onTouch, { passive: true });
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerenter', onEnter);
    el.addEventListener('pointerleave', onLeave);
    el.addEventListener('click', onClick, true);
    el.addEventListener('dragstart', noDrag);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(settle);
      sized.disconnect();
      seen.disconnect();
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('touchstart', onTouch);
      el.removeEventListener('touchend', onTouch);
      el.removeEventListener('touchcancel', onTouch);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerenter', onEnter);
      el.removeEventListener('pointerleave', onLeave);
      el.removeEventListener('click', onClick, true);
      el.removeEventListener('dragstart', noDrag);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      nudge.current = () => {};
    };
  }, [cards, loop]);

  // Grow the hovered card away from the strip's faded edges so it isn't cut off
  const aim = (card: HTMLElement) => {
    const el = strip.current;
    if (!el) return;
    const left = card.offsetLeft - el.scrollLeft;  // .strip is the offset parent
    const fade = el.clientWidth * 0.06, extra = card.offsetWidth * (GROW - 1);
    const lo = 1 - (el.clientWidth - fade - left - card.offsetWidth) / extra;
    const hi = (left - fade) / extra;
    const ox = Math.min(1, Math.max(0, Math.min(Math.max(0.5, lo), hi)));
    card.style.setProperty('--ox', `${ox * 100}%`);
  };

  const add = (set: Set<string>, url: string) => (set.has(url) ? set : new Set(set).add(url));
  const track = loop ? [...cards, ...cards, ...cards] : cards;
  const real = (i: number) => !loop || (i >= cards.length && i < cards.length * 2);

  return (
    <>
      <div className="repos-head">
        <p>Everything else on GitHub</p>
        <div className="repos-tools">
          {loop && (
            <div className="strip-nav">
              <button type="button" aria-label="Scroll repos back" aria-controls="repo-strip" onClick={() => nudge.current(-1)}>
                <svg className="ico back" aria-hidden="true"><use href="#i-chev" /></svg>
              </button>
              <button type="button" aria-label="Scroll repos forward" aria-controls="repo-strip" onClick={() => nudge.current(1)}>
                <svg className="ico" aria-hidden="true"><use href="#i-chev" /></svg>
              </button>
            </div>
          )}
          <a href="https://github.com/jogee489?tab=repositories" target="_blank" rel="noreferrer">
            All repos <svg className="ico" aria-hidden="true"><use href="#i-arrow" /></svg>
          </a>
        </div>
      </div>
      {cards.length > 0 && (
        <div className="strip" id="repo-strip" ref={strip}>
          <div className="strip-track">
            {track.map((card, i) => (
              <a
                key={i}
                href={card.url}
                target="_blank"
                rel="noreferrer"
                className={`repo${loaded.has(card.img) ? ' has-img' : ''}`}
                aria-hidden={!real(i) || undefined}
                tabIndex={real(i) ? undefined : -1}
                onPointerEnter={e => aim(e.currentTarget)}
                onFocus={e => aim(e.currentTarget)}
              >
                {!failed.has(card.img) && (
                  <img
                    src={card.img}
                    alt=""
                    onLoad={() => setLoaded(s => add(s, card.img))}
                    onError={() => setFailed(s => add(s, card.img))}
                  />
                )}
                <span className="rn">{card.name}</span>
                <span className="rv">
                  View repo <svg className="ico" aria-hidden="true"><use href="#i-arrow" /></svg>
                </span>
              </a>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

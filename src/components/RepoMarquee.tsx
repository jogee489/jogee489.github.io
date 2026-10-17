import { useEffect, useRef, useState } from 'react';

type Repo = { name: string; full_name: string; html_url: string; fork: boolean; default_branch: string };
type Card = { name: string; url: string; img: string };

const EXCLUDED = new Set([
  'jogee489.github.io',
]);

export default function RepoMarquee() {
  const [cards, setCards] = useState<Card[]>([]);
  const fetched = useRef(false);
  // Keyed by URL and shared by both copies of a card, so each screenshot is requested once
  const [loaded, setLoaded] = useState<Set<string>>(() => new Set());
  const [failed, setFailed] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;

    fetch('https://api.github.com/users/jogee489/repos?per_page=100&sort=updated')
      .then(r => r.json())
      .then((data: Repo[]) => {
        if (!Array.isArray(data)) return;
        setCards(
          data
            .filter(r => !r.fork && !EXCLUDED.has(r.name))
            .map(r => ({
              name: r.name,
              url: r.html_url,
              img: `https://raw.githubusercontent.com/${r.full_name}/${r.default_branch}/.github/screenshot.png`,
            }))
        );
      })
      .catch(() => {});
  }, []);

  if (!cards.length) return null;

  const add = (set: Set<string>, url: string) => (set.has(url) ? set : new Set(set).add(url));
  // Two copies of the list so the loop can wrap without a seam
  const track = [...cards, ...cards];

  return (
    <div className="strip">
      <div className="strip-track" style={{ '--count': cards.length } as React.CSSProperties}>
        {track.map((card, i) => {
          const copy = i >= cards.length;
          return (
            <a
              key={i}
              href={card.url}
              target="_blank"
              rel="noreferrer"
              className={`repo${loaded.has(card.img) ? ' has-img' : ''}`}
              aria-hidden={copy || undefined}
              tabIndex={copy ? -1 : undefined}
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
          );
        })}
      </div>
    </div>
  );
}

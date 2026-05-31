import { useEffect, useState } from 'react';

type Repo = { name: string; full_name: string; html_url: string };
type Card = { name: string; url: string; img: string; hasImg: boolean };

// Stable placeholder colors cycled by index
const PLACEHOLDER_GRADIENTS = [
  'linear-gradient(135deg,#1a1a2e 0%,#16213e 100%)',
  'linear-gradient(135deg,#0f3460 0%,#533483 100%)',
  'linear-gradient(135deg,#1b1b2f 0%,#2c2c54 100%)',
  'linear-gradient(135deg,#162447 0%,#1f4068 100%)',
  'linear-gradient(135deg,#2d132c 0%,#ee4540 100%)',
  'linear-gradient(135deg,#0d0d0d 0%,#2b2d42 100%)',
];

export default function RepoMarquee() {
  const [cards, setCards] = useState<Card[]>([]);

  useEffect(() => {
    fetch('https://api.github.com/users/jogee489/repos?per_page=100&sort=updated')
      .then(r => r.json())
      .then((data: Repo[]) => {
        const mapped: Card[] = data
          .filter(r => !(r as any).fork)
          .map(r => ({
            name: r.name,
            url: r.html_url,
            img: `https://raw.githubusercontent.com/${r.full_name}/main/.github/screenshot.png`,
            hasImg: true,
          }));
        setCards(mapped);
      })
      .catch(() => {});
  }, []);

  if (!cards.length) return null;

  const track = [...cards, ...cards];

  return (
    <div className="rmarquee">
      <div className="rmarquee-label">on github<span className="rmarquee-arrow">→</span></div>
      <div className="rmarquee-viewport">
        <div className="rmarquee-track" style={{ '--count': cards.length } as React.CSSProperties}>
          {track.map((card, i) => (
            <a
              key={i}
              href={card.url}
              target="_blank"
              rel="noreferrer"
              className="rmarquee-card"
              aria-label={card.name}
            >
              <div
                className="rmarquee-img-wrap"
                style={{ background: PLACEHOLDER_GRADIENTS[i % PLACEHOLDER_GRADIENTS.length] }}
              >
                <img
                  src={card.img}
                  alt=""
                  loading="lazy"
                  onError={e => { e.currentTarget.style.display = 'none'; }}
                />
              </div>
              <span className="rmarquee-name">{card.name}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

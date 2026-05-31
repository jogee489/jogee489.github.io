import { useEffect, useState } from 'react';

type Repo = { name: string; full_name: string; html_url: string };
type Card = { name: string; url: string; img: string };

export default function RepoMarquee() {
  const [cards, setCards] = useState<Card[]>([]);

  useEffect(() => {
    fetch('https://api.github.com/users/jogee489/repos?per_page=100&sort=updated')
      .then(r => r.json())
      .then((data: Repo[]) => {
        setCards(
          data
            .filter(r => !('fork' in r && (r as any).fork))
            .map(r => ({
              name: r.name,
              url: r.html_url,
              img: `https://raw.githubusercontent.com/${r.full_name}/main/.github/screenshot.png`,
            }))
        );
      })
      .catch(() => {});
  }, []);

  if (!cards.length) return null;

  // Duplicate for seamless infinite loop
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
              <div className="rmarquee-img-wrap">
                <img
                  src={card.img}
                  alt=""
                  loading="lazy"
                  onError={e => {
                    (e.currentTarget.closest('.rmarquee-card') as HTMLElement).style.display = 'none';
                  }}
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

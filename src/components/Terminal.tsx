import { useEffect, useRef, useState } from 'react';

type HistoryEntry = { kind: 'sys' | 'in' | 'out'; text: string };

const PROJECTS = [
  { name: 'heartopia-hub',            stack: 'React · Node · Capacitor', blurb: 'Cross-platform companion app for the Heartopia game.' },
  { name: 'leap',                     stack: 'Ruby on Rails',            blurb: 'Web scraper / data-collection Rails app on JRuby.' },
  { name: 'weather-pet',              stack: 'Flutter',                  blurb: 'Tiny weather app with a cute home-screen widget.' },
  { name: 'LunchRoulette',            stack: 'Kotlin · Android',         blurb: 'Native Android: pick lunch when nobody can decide.' },
  { name: 'LaserDefender',            stack: 'Unity · C#',               blurb: 'Space Invaders-style shooter built in Unity.' },
  { name: 'marvel-rivals-randomizer', stack: 'Vue · Vite',               blurb: 'Hero/loadout randomizer for Marvel Rivals matches.' },
];

const HELP = [
  '  whoami         — about me',
  '  ls projects    — list featured projects',
  '  cat <project>  — show one project',
  '  skills         — list tech stack',
  '  contact        — how to reach me',
  '  resume         — open resume.pdf',
  '  clear          — clear screen',
  '  exit · ESC · ~ — close terminal',
];

export default function Terminal() {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([
    { kind: 'sys', text: "jj-portfolio shell v1.0 — type 'help' for commands" },
  ]);
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const openHandler = () => setOpen(true);
    window.addEventListener('portfolio:open-terminal', openHandler);
    return () => window.removeEventListener('portfolio:open-terminal', openHandler);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName.toLowerCase();
      const inField = tag === 'input' || tag === 'textarea';
      if ((e.key === '`' || e.key === '~') && !inField) {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 60);
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 1e9, behavior: 'smooth' });
  }, [history]);

  const run = (cmdRaw: string) => {
    const cmd = cmdRaw.trim();
    const out: HistoryEntry[] = [{ kind: 'in', text: cmd }];
    if (!cmd) { setHistory(h => [...h, ...out]); return; }

    const [head, ...rest] = cmd.split(/\s+/);
    const arg = rest.join(' ');
    const push = (lines: string[]) => lines.forEach(l => out.push({ kind: 'out', text: l }));

    switch (head.toLowerCase()) {
      case 'help':
      case '?':
        push(HELP);
        break;
      case 'whoami':
        push([
          'JJ Dorko — software engineer · 10+ years · backend-focused.',
          'Currently: Rails + Postgres for healthcare-adjacent platforms.',
          'Also: teaching English to learners aged 5–65.',
          'Believes software exists to make life easier.',
        ]);
        break;
      case 'ls':
        if (arg.startsWith('proj') || !arg) {
          push(['total ' + PROJECTS.length]);
          PROJECTS.forEach((p, i) =>
            push([`  ${String(i + 1).padStart(2, '0')}  ${p.name.padEnd(28)} ${p.stack}`])
          );
        } else {
          push([`ls: cannot access '${arg}': no such directory`]);
        }
        break;
      case 'cat': {
        const p = PROJECTS.find(p => p.name.toLowerCase() === arg.toLowerCase());
        if (!p) push([`cat: ${arg || '<missing>'}: no such project (try 'ls projects')`]);
        else push([`# ${p.name}`, `stack: ${p.stack}`, '', p.blurb, '', `→ github.com/jogee489/${p.name}`]);
        break;
      }
      case 'skills':
        push([
          'backend/   ruby on rails · java · python · node.js · postgres',
          'frontend/  react · vue · javascript · jquery',
          'mobile/    capacitor · flutter · android (kotlin)',
          'ops/       linux (rhel) · bash · apache · glassfish · agile/safe',
        ]);
        break;
      case 'contact':
        push([
          'github    github.com/jogee489',
          'linkedin  linkedin.com/in/jjdorko',
          "resume    type 'resume' to open",
        ]);
        break;
      case 'resume':
        push(['→ opening résumé in Google Docs …']);
        break;
      case 'clear':
      case 'cls':
        setHistory([{ kind: 'sys', text: 'cleared.' }]);
        return;
      case 'exit':
      case 'quit':
        setOpen(false);
        return;
      case 'sudo':
        push(['nice try.']);
        break;
      case 'echo':
        push([arg]);
        break;
      default:
        push([`${head}: command not found — type 'help'`]);
    }

    setHistory(h => [...h, ...out]);
  };

  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      run(input);
      setInput('');
    } else if (e.key === 'Escape') {
      setOpen(false);
    } else if ((e.key === '`' || e.key === '~') && !input) {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div
      className={`term-root${open ? ' term-open' : ''}`}
      aria-hidden={!open}
      role="presentation"
      onClick={e => { if ((e.target as HTMLElement).classList.contains('term-root')) setOpen(false); }}
    >
      <div className="term-panel" role="dialog" aria-label="Portfolio terminal" aria-modal="true">
        <div className="term-chrome">
          <span className="term-dot" />
          <span className="term-dot" />
          <span className="term-dot" />
          <span className="term-title">~/jogee489 — zsh</span>
          <button className="term-close" onClick={() => setOpen(false)} aria-label="Close terminal">esc</button>
        </div>
        <div className="term-body" ref={scrollRef}>
          {history.map((h, i) => {
            if (h.kind === 'sys') return <div key={i} className="term-sys">{h.text}</div>;
            if (h.kind === 'in') return (
              <div key={i} className="term-line">
                <span className="term-prompt">jj@dorko</span>
                <span className="term-colon">:</span>
                <span className="term-path">~</span>
                <span className="term-dollar">$</span>
                <span>&nbsp;{h.text}</span>
              </div>
            );
            return <div key={i} className="term-out">{h.text}</div>;
          })}
          <div className="term-line">
            <span className="term-prompt">jj@dorko</span>
            <span className="term-colon">:</span>
            <span className="term-path">~</span>
            <span className="term-dollar">$</span>
            <span>&nbsp;</span>
            <input
              ref={inputRef}
              className="term-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onInputKey}
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
              aria-label="Terminal input"
            />
            <span className="term-caret" aria-hidden="true" />
          </div>
        </div>
      </div>
    </div>
  );
}

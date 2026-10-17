// Wires the shell engine to the page: the filesystem is read from the page's own content,
// and the same shell drives the monitor in the desk scene and the full-screen console.
import { SKILL_GROUPS } from '../data/skills';
import { createShell, dir, file, projectsDir, type FsNode, type Project } from './shell-core';

type DeskApi = {
  inHero(): boolean;
  zoom(to: number, ms: number): Promise<void>;
  reset(): void;
  toggleLamp(): boolean;
};

const RESUME_URL = 'https://docs.google.com/document/d/1lEfCjaSvtYKnsLCRMSEz7S896fTxNUJinJZli5wpCro/view';
const SECTIONS = ['about', 'experience', 'work', 'repos', 'contact'];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;

const PROJECTS: Project[] = JSON.parse(document.getElementById('shell-data')?.textContent || '[]');

// TODO: fetch resume content from an endpoint instead of hardcoding
const RESUME = [
  '┌─────────────────────────────────────────────────────┐',
  '│  joseph (jj) dorko — resume.txt                     │',
  '└─────────────────────────────────────────────────────┘',
  '',
  '  github.com/jogee489 · linkedin.com/in/jjdorko',
  '',
  '── GOAL ──────────────────────────────────────────────',
  '',
  '  Technology has always been a passion. Every piece of',
  '  software is intended to make life easier. Learning',
  '  new things and helping people drive me to keep',
  '  innovating.',
  '',
  '── SKILLS ────────────────────────────────────────────',
  '',
  '  linux (rhel · bash · scripting)  ruby on rails  java',
  '  postgresql  python  javascript/jquery',
  '  agile · scrum · safe',
  '',
  '── EXPERIENCE ────────────────────────────────────────',
  '',
  '  Vocera Communications / Extension Healthcare',
  '  ├─ Platform Dev II + Scrum Master   04/2018–12/2021',
  '  ├─ Platform Developer I              12/2016–04/2018',
  '  └─ Junior Platform Dev (intern)      11/2014–12/2016',
  '',
  '    · International team, customer escalation lead',
  '    · Ran scrum ceremonies, mentored new hires',
  '    · RedHat Linux: Apache, systemd, Glassfish',
  '    · Backend APIs — Ruby on Rails + PostgreSQL',
  '    · Device integration via XMPP + Java',
  '    · Frontend: AngularJS, JavaScript, HTML',
  '',
  '  Information Technology Services',
  '  └─ Web App Developer (intern)        05/2013–11/2014',
  '',
  '    · Web pages + DB tables in Groovy / Grails',
  '    · Direct client communication',
  '',
  '── KEY ACCOMPLISHMENTS ───────────────────────────────',
  '',
  '  High Availability   dual-node failover via keepalived',
  '  OpenMQ              reliable msg delivery in Glassfish',
  '  Event Templates     reusable event msgs for hospital staff',
  '  Import/Export       CSV-based data migration tooling',
  '  Alias Attributes    backwards-compat for data model changes',
  '  Scoped Security     facility-level admin permission scoping',
  '  Context in Calls    call/voicemail context in patient threads',
  '  Scalable Groups     efficient group membership calculations',
  '  Background Tasks    throttled processing for heavy operations',
  '  Onboarding Plans    intern + new-hire training program',
  '',
  '── EDUCATION ─────────────────────────────────────────',
  '',
  '  IPFW University · B.S. Computer Science · Dec 2017',
  '',
  '── CERTIFICATIONS ────────────────────────────────────',
  '',
  '  Certified Scrum Master',
  '  Certified SAFe 5 Practitioner',
  '',
  '── SIDE PROJECTS ─────────────────────────────────────',
  '',
  '  LaserDefender     Unity + C#',
  '  Werewolf app      MEAN stack',
  '  LunchRoulette     Kotlin / Android',
  '  Chaos Controller  Arduino',
];

// ── the filesystem is the page's own content ────────────
const text = (el: Element | null | undefined) => el?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
/** text directly inside an element, leaving out links like "Full résumé" */
const ownText = (el: Element) =>
  [...el.childNodes].filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent).join(' ').replace(/\s+/g, ' ').trim();
const paragraphs = (els: Iterable<Element>) => [...els].flatMap((el, i) => (i ? ['', text(el)] : [text(el)]));

function jobLines(job: Element) {
  const out = [text(job.querySelector('h3')), text(job.querySelector('.job-when'))];
  const prev = job.querySelector('.job-prev');
  if (prev) out.push(text(prev));
  out.push('', text(job.querySelector('.job-desc')));
  const wins = [...job.querySelectorAll('.job-wins li')].map(li => '· ' + text(li));
  if (wins.length) out.push('', ...wins);
  out.push('', text(job.querySelector('.job-tech')));
  return out;
}

// Filled by the repo strip once it has the list from GitHub
let repos: Record<string, FsNode> = {};
window.addEventListener('repos:loaded', e => {
  const list = (e as CustomEvent<{ name: string; url: string }[]>).detail;
  repos = Object.fromEntries(list.map(r => [r.name, file(() => [r.name, r.url.replace('https://', '')], { url: r.url })]));
});

const root = dir({
  about: dir({ 'about.txt': file(() => paragraphs(document.querySelectorAll('#about p'))) }),
  experience: dir(() => Object.fromEntries(
    [...document.querySelectorAll<HTMLElement>('#experience [data-file]')].map(el =>
      [el.dataset.file!, file(() => (el.matches('.job') ? jobLines(el) : [ownText(el)]))]),
  )),
  work: projectsDir(PROJECTS),
  repos: dir(() => repos, { empty: 'Nothing here yet. The list loads from GitHub, so try again in a moment.' }),
  contact: dir({
    linkedin: file(() => ['linkedin.com/in/jjdorko'], { url: 'https://linkedin.com/in/jjdorko' }),
    github: file(() => ['github.com/jogee489'], { url: 'https://github.com/jogee489' }),
    'form.txt': file(() => ['The contact form is at the bottom of the page.', "Run 'cd contact' to go there."]),
  }),
  'resume.txt': file(() => RESUME, { url: RESUME_URL }),
});

const core = createShell({
  root,
  projects: PROJECTS,
  skills: SKILL_GROUPS,
  resume: RESUME,
  resumeUrl: RESUME_URL,
  actions: {
    goto,
    top() {
      closeConsole();
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    },
    open(url) { window.open(url, '_blank', 'noopener'); },
    close() {
      closeConsole();
      document.getElementById('screen-input')?.blur();
    },
    lamp: () => (shell.desk ? shell.desk.toggleLamp() : null),
  },
});

export const shell = Object.assign(core, {
  /** registered by the desk scene once WebGL is up */
  desk: null as DeskApi | null,
  goto,
  openConsole,
  closeConsole,
});

function goto(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  closeConsole(false);
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}

// ── console ─────────────────────────────────────────────
const con = document.getElementById('console') as HTMLElement;
const cin = document.getElementById('console-input') as HTMLInputElement;
const sin = document.getElementById('screen-input') as HTMLInputElement | null;
const outEl = document.getElementById('console-out') as HTMLElement;
let lastFocus: Element | null = null;
let zoomed = false;
let opening = false;

// From the intro, the camera flies into the monitor first and the console takes over its screen
async function openConsole() {
  if (opening || con.classList.contains('open')) return;
  lastFocus = document.activeElement;
  if (shell.desk && !reduce && shell.desk.inHero()) {
    opening = true;
    zoomed = true;
    await shell.desk.zoom(1, 560);
    opening = false;
  }
  document.documentElement.classList.add('locked');
  con.classList.add('open');
  con.inert = false;
  con.setAttribute('aria-hidden', 'false');
  if (!coarse) setTimeout(() => cin.focus({ preventScroll: true }), 40);
  renderConsole(true);
}

// back=false when a command is about to scroll the page away from the desk
function closeConsole(back = true) {
  if (!con.classList.contains('open')) return;
  con.classList.remove('open');
  document.documentElement.classList.remove('locked');
  con.inert = true;
  con.setAttribute('aria-hidden', 'true');
  if (lastFocus instanceof HTMLElement && lastFocus !== document.body && lastFocus !== sin) lastFocus.focus({ preventScroll: true });
  else cin.blur();
  if (zoomed && shell.desk) {
    zoomed = false;
    if (back) shell.desk.zoom(0, 480);
    else shell.desk.reset();
  }
}

function bindInput(el: HTMLInputElement, onEscape: () => void, onBacktick: () => void) {
  const set = (v: string) => { el.value = v; shell.input = v; shell.emit(); };
  el.addEventListener('input', () => { shell.input = el.value; shell.emit(); });
  el.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const v = el.value;
      el.value = '';
      shell.input = '';
      shell.run(v);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      set(shell.prev());
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      set(shell.next());
    } else if (e.key === 'Tab') {
      e.preventDefault();
      set(shell.complete(el.value));
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onEscape();
    } else if ((e.key === '`' || e.key === '~') && !el.value) {
      e.preventDefault();
      onBacktick();
    }
  });
  shell.on(() => { if (document.activeElement !== el && el.value !== shell.input) el.value = shell.input; });
}

bindInput(cin, closeConsole, closeConsole);
if (sin) bindInput(sin, () => sin.blur(), () => { sin.blur(); openConsole(); });
document.getElementById('console-form')?.addEventListener('submit', e => e.preventDefault());
document.getElementById('console-close')?.addEventListener('click', () => closeConsole());
document.getElementById('chips')?.addEventListener('click', e => {
  const b = (e.target as Element).closest<HTMLElement>('button[data-cmd]');
  if (b?.dataset.cmd) shell.run(b.dataset.cmd);
});
document.querySelectorAll('[data-open-shell]').forEach(b => b.addEventListener('click', () => openConsole()));

document.addEventListener('keydown', e => {
  if (e.defaultPrevented) return;
  const typing = (e.target as Element).matches?.('input, textarea, select, [contenteditable]');
  if ((e.key === '`' || e.key === '~') && !typing) {
    e.preventDefault();
    if (con.classList.contains('open')) closeConsole();
    else openConsole();
  } else if (e.key === 'Escape' && con.classList.contains('open')) {
    closeConsole();
  }
});

let renderedV = -1;
function renderConsole(force: boolean) {
  document.querySelectorAll('[data-cwd]').forEach(n => { n.textContent = shell.cwd; });
  if (!force && (renderedV === shell.v || !con.classList.contains('open'))) return;
  renderedV = shell.v;
  const frag = document.createDocumentFragment();
  for (const l of shell.lines) {
    const d = document.createElement('div');
    d.className = 'ln ' + l.t;
    if (l.t === 'in') {
      const p = document.createElement('span');
      p.className = 'p';
      p.textContent = shell.promptFor(l.cwd ?? '~');
      d.append(p, l.s);
    } else {
      d.textContent = l.s || ' ';
    }
    frag.append(d);
  }
  outEl.replaceChildren(frag);
  outEl.scrollTop = outEl.scrollHeight;
}
shell.on(() => renderConsole(false));

// ── scroll position becomes the working directory ───────
const navLinks = [...document.querySelectorAll<HTMLAnchorElement>('.toc a')];
function setCwd(id: string) {
  const next = id && id !== 'top' ? '~/' + id : '~';
  if (next === shell.cwd) return;
  shell.cwd = next;
  navLinks.forEach(a => a.classList.toggle('on', a.dataset.sec === id));
  shell.emit();
}
const spy = new IntersectionObserver(entries => {
  entries.forEach(en => { if (en.isIntersecting) setCwd(en.target.id); });
}, { rootMargin: '-42% 0px -55% 0px' });
['top', ...SECTIONS].forEach(id => {
  const el = document.getElementById(id);
  if (el) spy.observe(el);
});

// If the desk scene never registers (no WebGL, script blocked), show the plain intro
setTimeout(() => { if (!shell.desk) document.documentElement.classList.add('no-gl'); }, 6000);
renderConsole(true);

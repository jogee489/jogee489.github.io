// One shell shared by the monitor in the desk scene and the full-screen console.
import { SKILL_GROUPS } from '../data/skills';

type Line = { t: 'in' | 'out' | 'sys'; s: string; cwd?: string };
type Project = { id: string; name: string; stack: string; blurb: string; url: string };
type DeskApi = {
  inHero(): boolean;
  zoom(to: number, ms: number): Promise<void>;
  reset(): void;
  toggleLamp(): boolean;
};

const RESUME_URL = 'https://docs.google.com/document/d/1lEfCjaSvtYKnsLCRMSEz7S896fTxNUJinJZli5wpCro/view';
const SECTIONS = ['about', 'experience', 'work', 'repos', 'contact'];
const COMMANDS = ['help', 'whoami', 'ls', 'cat', 'open', 'cd', 'resume', 'skills', 'contact', 'lamp', 'history', 'date', 'pwd', 'clear', 'exit'];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;

const PROJECTS: Project[] = JSON.parse(document.getElementById('shell-data')?.textContent || '[]');

const HELP = [
  'whoami            who this is',
  'ls [projects]     list sections or projects',
  'cat <project>     one project in detail (tab completes)',
  'open <project>    open its repo or live site',
  'cd <section>      move the page: ' + SECTIONS.join(', '),
  'resume            the résumé as plain text',
  'skills            what I work with',
  'contact           where to reach me',
  'lamp              switch the desk lamp',
  'clear, exit       tidy up, or close (` works too)',
];

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
  '',
  '→ opening full résumé in Google Docs …',
];

const lines: Line[] = [];
const subs: (() => void)[] = [];
const hist: string[] = [];
let hIdx = 0;

export const shell = {
  lines,
  input: '',
  cwd: '~',
  /** bumps whenever lines change, so views can skip redundant redraws */
  v: 0,
  /** registered by the desk scene once WebGL is up */
  desk: null as DeskApi | null,
  promptFor: (cwd: string) => `jj@dorko:${cwd}$ `,
  on(fn: () => void) { subs.push(fn); },
  emit() { subs.forEach(f => f()); },
  run,
  complete,
  goto,
  openConsole,
  closeConsole,
};

const out = (...ls: string[]) => ls.forEach(s => lines.push({ t: 'out', s }));
const echo = (s: string) => lines.push({ t: 'in', s, cwd: shell.cwd });
const findProject = (a: string) => {
  const q = a.toLowerCase().replace(/\/$/, '');
  return PROJECTS.find(p => p.id === q || p.name.toLowerCase() === q);
};

lines.push({ t: 'sys', s: `Last login: ${new Date().toDateString()} on ttys001` });
echo('whoami');
out('JJ Dorko. Backend engineer: Rails, Java, Linux. Available for freelance work.');
echo('ls projects');
out(PROJECTS.slice(0, 4).map(p => p.id).join('  '), PROJECTS.slice(4).map(p => p.id).join('  '));
lines.push({ t: 'sys', s: "Type 'help' to see what else this shell can do." });

function run(raw: string) {
  const cmd = raw.trim();
  echo(cmd);
  if (cmd) hist.push(cmd);
  hIdx = hist.length;
  const [head = '', ...rest] = cmd.split(/\s+/);
  const arg = rest.join(' ');

  switch (head.toLowerCase()) {
    case '':
      break;
    case 'help':
    case '?':
      out(...HELP);
      break;
    case 'whoami':
      out('JJ Dorko', 'Backend engineer. Rails, Java and Linux for over ten years.', 'Freelancing now. Teaches English to students aged 5 to 65.');
      break;
    case 'ls': {
      const a = arg.replace(/^~\/?/, '').toLowerCase();
      if (!a) out(SECTIONS.map(s => s + '/').join('  ') + '  projects/  resume.txt');
      else if (a.startsWith('proj') || a.startsWith('work')) PROJECTS.forEach(p => out(`${p.id.padEnd(27)}${p.stack}`));
      else out(`ls: ${arg}: No such file or directory`);
      break;
    }
    case 'cat': {
      if (/^resume(\.txt)?$/i.test(arg)) { out(...RESUME.slice(0, -1)); break; }
      const p = findProject(arg);
      if (!p) out(`cat: ${arg || '<project>'}: No such project. Try 'ls projects'.`);
      else out(p.name, p.stack, '', p.blurb, '', p.url.replace('https://', ''));
      break;
    }
    case 'open': {
      const p = findProject(arg);
      if (!p) { out(`open: ${arg || '<project>'}: No such project. Try 'ls projects'.`); break; }
      out(`Opening ${p.url.replace('https://', '')}`);
      window.open(p.url, '_blank', 'noopener');
      break;
    }
    case 'cd': {
      const t = arg.replace(/^~\/?/, '').replace(/\/$/, '').toLowerCase();
      if (!t || t === '..') {
        closeConsole();
        window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
      } else if (SECTIONS.includes(t) || t === 'projects') {
        goto(t === 'projects' ? 'work' : t);
      } else {
        out(`cd: no such directory: ${arg}. Try ${SECTIONS.join(', ')}.`);
      }
      break;
    }
    case 'pwd':
      out('/home/jj' + (shell.cwd === '~' ? '' : shell.cwd.slice(1)));
      break;
    case 'resume':
      out(...RESUME);
      window.open(RESUME_URL, '_blank', 'noopener');
      break;
    case 'skills':
      SKILL_GROUPS.forEach(g => out(`${g.label.toLowerCase().padEnd(15)}${g.items.join(', ')}`));
      break;
    case 'contact':
      out('linkedin  linkedin.com/in/jjdorko', 'github    github.com/jogee489', "form      'cd contact'");
      break;
    case 'lamp':
      if (!shell.desk) out('lamp: the desk needs WebGL, which this browser has off.');
      else out(shell.desk.toggleLamp() ? 'lamp: on' : 'lamp: off. The monitor is enough light anyway.');
      break;
    case 'history':
      hist.forEach((h, i) => out(`${String(i + 1).padStart(4)}  ${h}`));
      break;
    case 'date':
      out(new Date().toString());
      break;
    case 'clear':
    case 'cls':
      lines.length = 0;
      break;
    case 'exit':
    case 'quit':
      closeConsole();
      document.getElementById('screen-input')?.blur();
      break;
    case 'sudo':
      out('jj is not in the sudoers file. This incident will be reported.');
      break;
    case 'rm':
      out(/-\w*r\w*f|-\w*f\w*r/.test(arg) ? 'Not today.' : 'rm: permission denied');
      break;
    case 'echo':
      out(arg);
      break;
    case 'vim':
    case 'vi':
    case 'nano':
    case 'emacs':
      out(`${head}: this shell is read-only. Try 'cat' instead.`);
      break;
    default:
      out(`${head}: command not found. Try 'help'.`);
  }
  if (lines.length > 400) lines.splice(0, lines.length - 400);
  shell.v++;
  shell.emit();
}

function complete(v: string) {
  const m = v.match(/^(\S*)(\s+)?(.*)$/);
  if (!m) return v;
  const list = (opts: string[]) => { echo(v); out(opts.join('  ')); shell.v++; shell.emit(); };
  if (!m[2]) {
    const c = COMMANDS.filter(c => c.startsWith(m[1].toLowerCase()));
    if (c.length === 1) return c[0] + ' ';
    if (c.length > 1 && m[1]) list(c);
    return v;
  }
  const cmd = m[1].toLowerCase();
  const pool = cmd === 'cd' ? SECTIONS
    : cmd === 'cat' || cmd === 'open' ? PROJECTS.map(p => p.id)
    : cmd === 'ls' ? ['projects']
    : [];
  const c = pool.filter(x => x.startsWith(m[3].toLowerCase()));
  if (c.length === 1) return `${m[1]} ${c[0]}`;
  if (c.length > 1) list(c);
  return v;
}

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
      run(v);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (hIdx > 0) hIdx--;
      set(hist[hIdx] || '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (hIdx < hist.length) hIdx++;
      set(hist[hIdx] || '');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      set(complete(el.value));
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
  if (b?.dataset.cmd) run(b.dataset.cmd);
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
  for (const l of lines) {
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

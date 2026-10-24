// Command engine for the site's shell. It never touches the DOM: the page hands it a
// filesystem and a set of actions, which keeps every command unit-testable.
import { GITHUB_URL, LINKEDIN_URL, bare } from '../data/links';

export type Line = { t: 'in' | 'out' | 'sys'; s: string; cwd?: string };
export type FileNode = { kind: 'file'; read: () => string[]; url?: string; note?: string };
export type DirNode = { kind: 'dir'; entries: () => Record<string, FsNode>; empty?: string; note?: string };
export type FsNode = FileNode | DirNode;
export type Project = { id: string; name: string; stack: string; blurb: string; url: string };
export type SkillGroup = { label: string; items: string[] };

export type Actions = {
  /** scroll the page to a top-level section */
  goto(section: string): void;
  /** scroll back up to the desk */
  top(): void;
  open(url: string): void;
  /** leave the console or the monitor */
  close(): void;
  /** the lamp's new state, or null when there is no desk */
  lamp(): boolean | null;
};

export type ShellConfig = {
  root: DirNode;
  projects: Project[];
  skills: SkillGroup[];
  resume: string[];
  resumeUrl: string;
  actions: Actions;
  now?: () => Date;
};

export const file = (read: () => string[], extra: Partial<Omit<FileNode, 'kind' | 'read'>> = {}): FileNode =>
  ({ kind: 'file', read, ...extra });
export const dir = (
  entries: Record<string, FsNode> | (() => Record<string, FsNode>),
  extra: Partial<Omit<DirNode, 'kind' | 'entries'>> = {},
): DirNode => ({ kind: 'dir', entries: typeof entries === 'function' ? entries : () => entries, ...extra });

const projectLines = (p: Project) => [p.name, p.stack, '', p.blurb, '', p.url.replace(/^https?:\/\//, '')];
export const projectsDir = (projects: Project[]) =>
  dir(Object.fromEntries(projects.map(p => [p.id, file(() => projectLines(p), { url: p.url, note: p.stack })])));

export const COMMANDS = ['help', 'whoami', 'ls', 'cat', 'open', 'cd', 'resume', 'skills', 'contact', 'lamp', 'history', 'date', 'pwd', 'clear', 'exit'];
const PATH_COMMANDS = ['ls', 'cat', 'open', 'cd'];

export const HELP = [
  'whoami            who this is',
  'ls [path]         list a directory (try ls work)',
  'cat <file>        print a file, or a project by name',
  'cd <dir>          move the page: ~, about, experience, work, repos, contact',
  'open <file>       open a project, the résumé or a profile link',
  'resume            the résumé as plain text',
  'skills            what I work with',
  'contact           where to reach me',
  'lamp              switch the desk lamp',
  'history, pwd      the usual',
  'clear, exit       tidy up, or close (` works too)',
];

const commonPrefix = (words: string[]) =>
  words.reduce((a, w) => { let i = 0; while (i < a.length && a[i].toLowerCase() === w[i]?.toLowerCase()) i++; return a.slice(0, i); });

export function createShell(cfg: ShellConfig) {
  const now = cfg.now ?? (() => new Date());
  const lines: Line[] = [];
  const subs: (() => void)[] = [];
  const hist: string[] = [];
  let hIdx = 0;

  const shell = {
    lines,
    /** where the shell is, as `~` or `~/section` */
    cwd: '~',
    input: '',
    /** bumps whenever lines change, so views can skip redundant redraws */
    v: 0,
    promptFor: (cwd: string) => `jj@dorko:${cwd}$ `,
    on(fn: () => void) { subs.push(fn); },
    emit() { subs.forEach(f => f()); },
    run,
    complete,
    /** previous / next history entry, for the arrow keys */
    prev() { if (hIdx > 0) hIdx--; return hist[hIdx] ?? ''; },
    next() { if (hIdx < hist.length) hIdx++; return hist[hIdx] ?? ''; },
  };

  const out = (...ls: string[]) => { ls.forEach(s => lines.push({ t: 'out', s })); };
  const echo = (s: string) => { lines.push({ t: 'in', s, cwd: shell.cwd }); };
  const findProject = (a: string) => {
    const q = a.toLowerCase().replace(/\/$/, '');
    return cfg.projects.find(p => p.id === q || p.name.toLowerCase() === q);
  };

  // ── paths ──
  /** a typed path as segments under ~ (`..` stops at ~) */
  function segmentsOf(path: string, fromHome = false): string[] {
    let rest = path.trim();
    let segs: string[];
    if (rest === '~' || rest.startsWith('~/')) { segs = []; rest = rest.slice(1); }
    else if (rest === '/home/jj' || rest.startsWith('/home/jj/')) { segs = []; rest = rest.slice('/home/jj'.length); }
    else if (rest.startsWith('/')) return ['\0'];   // outside ~: nothing there
    else segs = fromHome || shell.cwd === '~' ? [] : shell.cwd.slice(2).split('/');
    for (const part of rest.split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') segs.pop();
      else segs.push(part);
    }
    return segs;
  }
  /** walks the tree, normalizing names in place (case, the old `projects` name for `work`) */
  function lookup(segs: string[]): FsNode | null {
    let node: FsNode = cfg.root;
    for (let i = 0; i < segs.length; i++) {
      if (node.kind !== 'dir') return null;
      const entries: Record<string, FsNode> = node.entries();
      let name = Object.keys(entries).find(k => k === segs[i]) ?? Object.keys(entries).find(k => k.toLowerCase() === segs[i].toLowerCase());
      if (!name && i === 0 && segs[i].toLowerCase() === 'projects') name = 'work';
      if (!name || !entries[name]) return null;
      segs[i] = name;
      node = entries[name];
    }
    return node;
  }
  /**
   * Plain names resolve from the working directory first, then from ~. The working directory
   * follows the page as you scroll, so visitors shouldn't need to know where they are.
   */
  function resolve(path: string) {
    let segs = segmentsOf(path);
    let node = lookup(segs);
    if (!node && !/^[~/.]/.test(path.trim())) {
      segs = segmentsOf(path, true);
      node = lookup(segs);
    }
    return { segs, node };
  }
  const display = (segs: string[]) => (segs.length ? '~/' + segs.join('/') : '~');

  // ── commands ──
  function ls(arg: string) {
    const { segs, node } = resolve(arg || '.');
    if (!node) return out(`ls: ${arg}: No such file or directory`);
    if (node.kind === 'file') return out(segs[segs.length - 1]);
    const entries = Object.entries(node.entries());
    if (!entries.length) return node.empty ? out(node.empty) : undefined;
    const names = entries.map(([n, e]) => (e.kind === 'dir' ? n + '/' : n));
    if (entries.some(([, e]) => e.note)) {
      const w = Math.max(...names.map(n => n.length)) + 3;
      entries.forEach(([, e], i) => out((names[i].padEnd(w) + (e.note ?? '')).trimEnd()));
    } else {
      out(names.join('  '));
    }
  }

  function cat(arg: string) {
    if (!arg) return out("cat: missing file name. Try 'ls' to see what's here.");
    const { node } = resolve(arg);
    if (node?.kind === 'file') return out(...node.read());
    if (node?.kind === 'dir') return out(`cat: ${arg}: Is a directory. Try 'ls ${arg}'.`);
    // project names work from anywhere
    const p = findProject(arg);
    if (p) return out(...projectLines(p));
    out(`cat: ${arg}: No such file or directory`);
  }

  function cd(arg: string) {
    const { segs, node } = resolve(arg || '~');
    if (!node) return out(`cd: no such file or directory: ${arg}`);
    if (node.kind !== 'dir') return out(`cd: not a directory: ${arg}`);
    shell.cwd = display(segs);
    if (segs.length) cfg.actions.goto(segs[0]);
    else cfg.actions.top();
  }

  function open(arg: string) {
    if (!arg) return out("open: missing file name. Try 'open sensei-connect'.");
    const { node } = resolve(arg);
    if (node?.kind === 'dir') return out(`open: ${arg}: Is a directory`);
    const url = node ? node.url : findProject(arg)?.url;
    if (!url) return out(`open: ${arg}: ${node ? 'has no link to open' : 'No such file or directory'}`);
    out(`Opening ${url.replace(/^https?:\/\//, '')}`);
    cfg.actions.open(url);
  }

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
        out(
          'JJ Dorko',
          'Software engineer in Osaka. Seven years of Rails, Java and Linux at Vocera,',
          'then COO and technical lead at a contracting company in Japan.',
          'Teaches English to students aged 1 to 65.',
        );
        break;
      case 'ls':
        ls(arg);
        break;
      case 'cat':
        cat(arg);
        break;
      case 'cd':
        cd(arg);
        break;
      case 'open':
        open(arg);
        break;
      case 'pwd':
        out('/home/jj' + shell.cwd.slice(1));
        break;
      case 'resume':
        out(...cfg.resume, '→ opening full résumé in Google Docs …');
        cfg.actions.open(cfg.resumeUrl);
        break;
      case 'skills':
        cfg.skills.forEach(g => out(`${g.label.toLowerCase().padEnd(15)}${g.items.join(', ')}`));
        break;
      case 'contact':
        out(`linkedin  ${bare(LINKEDIN_URL)}`, `github    ${bare(GITHUB_URL)}`, "form      'cd contact'");
        break;
      case 'lamp': {
        const on = cfg.actions.lamp();
        out(on === null ? 'lamp: the desk needs WebGL, which this browser has off.' : on ? 'lamp: on' : 'lamp: off. The monitor is enough light anyway.');
        break;
      }
      case 'history':
        hist.forEach((h, i) => out(`${String(i + 1).padStart(4)}  ${h}`));
        break;
      case 'date':
        out(now().toString());
        break;
      case 'clear':
      case 'cls':
        lines.length = 0;
        break;
      case 'exit':
      case 'quit':
        cfg.actions.close();
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

  /** tab completion: commands first, then paths for ls, cat, cd and open */
  function complete(v: string): string {
    const list = (opts: string[]) => { echo(v); out(opts.join('  ')); shell.v++; shell.emit(); };
    const m = v.match(/^(\S*)\s+(.*)$/);
    if (!m) {
      const c = COMMANDS.filter(c => c.startsWith(v.toLowerCase()));
      if (c.length === 1) return c[0] + ' ';
      if (c.length > 1 && v) list(c);
      return v;
    }
    const [, cmd, arg] = m;
    const lc = cmd.toLowerCase();
    if (!PATH_COMMANDS.includes(lc)) return v;

    const slash = arg.lastIndexOf('/');
    const dirPart = arg.slice(0, slash + 1);
    const base = arg.slice(slash + 1);
    const pool: [name: string, isDir: boolean][] = [];
    const offer = (name: string, isDir: boolean) => { if (!pool.some(([n]) => n === name)) pool.push([name, isDir]); };
    const offerDir = (node: FsNode | null) => {
      if (node?.kind === 'dir') Object.entries(node.entries()).forEach(([n, e]) => offer(n, e.kind === 'dir'));
    };
    if (dirPart) {
      offerDir(resolve(dirPart).node);
    } else {
      // same order resolve() tries: here, then ~, then project names
      offerDir(lookup(segmentsOf('.')));
      offerDir(cfg.root);
      if (lc === 'cat' || lc === 'open') cfg.projects.forEach(p => offer(p.id, false));
    }
    const matches = pool.filter(([n, isDir]) => n.toLowerCase().startsWith(base.toLowerCase()) && (lc !== 'cd' || isDir));
    if (matches.length === 1) {
      const [n, isDir] = matches[0];
      return `${cmd} ${dirPart}${n}${isDir ? '/' : ''}`;
    }
    if (matches.length > 1) {
      const prefix = commonPrefix(matches.map(([n]) => n));
      if (prefix.length > base.length) return `${cmd} ${dirPart}${prefix}`;
      list(matches.map(([n, isDir]) => (isDir ? n + '/' : n)));
    }
    return v;
  }

  lines.push({ t: 'sys', s: `Last login: ${now().toDateString()} on ttys001` });
  echo('whoami');
  out('JJ Dorko. Software engineer in Osaka. Open to full-time roles and contract work.');
  echo('ls');
  ls('');
  lines.push({ t: 'sys', s: "Type 'help' to see what else this shell can do." });

  return shell;
}

export type Shell = ReturnType<typeof createShell>;

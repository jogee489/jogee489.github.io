import { describe, expect, it, vi } from 'vitest';
import { COMMANDS, HELP, createShell, dir, file, projectsDir, type Actions, type FsNode } from './shell-core';

// The four projects in Work. Sensei Connect's repo is private, so it links to its demo video.
const PROJECTS = [
  { id: 'sensei-connect', name: 'Sensei Connect', stack: 'Next.js, Supabase', blurb: 'Teacher marketplace.', url: 'https://www.youtube.com/watch?v=ZxlBJATvUNM' },
  { id: 'heartopia-hub', name: 'Heartopia Hub', stack: 'React, Capacitor', blurb: 'Companion app.', url: 'https://github.com/jogee489/heartopia-hub' },
  { id: 'weather-pet', name: 'Weather Pet', stack: 'Flutter', blurb: 'Weather app.', url: 'https://github.com/jogee489/weather-pet' },
  { id: 'marvel-rivals-randomizer', name: 'Marvel Rivals Randomizer', stack: 'Vue', blurb: 'Team picker.', url: 'https://jjdorko.com/marvel-rivals-randomizer/' },
];
const RESUME_URL = 'https://docs.example/resume';
const ERROR = /No such file|Is a directory|not a directory|command not found|missing file/;

function setup({ repos = { 'rails-chat': file(() => ['rails-chat'], { url: 'https://github.com/jogee489/rails-chat' }) } as Record<string, FsNode>, desk = true } = {}) {
  let lampOn = true;
  const actions = {
    goto: vi.fn(),
    top: vi.fn(),
    open: vi.fn(),
    close: vi.fn(),
    lamp: vi.fn(() => (desk ? (lampOn = !lampOn) : null)),
  } satisfies Actions;
  const root = dir({
    about: dir({ 'about.txt': file(() => ['I build backends.']) }),
    experience: dir({ 'vocera.txt': file(() => ['Platform Developer II']), 'its.txt': file(() => ['Web intern']) }),
    work: projectsDir(PROJECTS),
    repos: dir(() => repos, { empty: 'Nothing here yet.' }),
    contact: dir({
      linkedin: file(() => ['linkedin.com/in/jjdorko'], { url: 'https://www.linkedin.com/in/jjdorko' }),
      'form.txt': file(() => ['The form is below.']),
    }),
    'resume.txt': file(() => ['RESUME TEXT'], { url: RESUME_URL }),
  });
  const sh = createShell({
    root,
    projects: PROJECTS,
    skills: [{ label: 'Backend', items: ['Rails', 'Java'] }],
    resume: ['RESUME TEXT'],
    resumeUrl: RESUME_URL,
    actions,
    now: () => new Date('2026-10-17T12:00:00Z'),
  });
  /** runs a command and returns what it printed */
  const run = (cmd: string) => {
    const start = sh.lines.length;
    sh.run(cmd);
    return sh.lines.slice(start + 1).map(l => l.s);
  };
  /** the text tab completion printed, if it listed options */
  const printed = () => sh.lines[sh.lines.length - 1].s;
  return { sh, run, actions, printed };
}

describe('filesystem', () => {
  it('can open everything ls shows', () => {
    const { run } = setup();
    const visited: string[] = [];
    // A listing is either one line of names, or one `name   note` line per entry
    const namesIn = (listing: string[]) =>
      listing.length > 1 ? listing.map(l => l.split(/\s{2,}/)[0]) : (listing[0] ?? '').split(/\s{2,}/).filter(Boolean);
    const visit = (path: string) => {
      const listing = run(path ? `ls ${path}` : 'ls');
      expect(listing.join('\n'), `ls ${path}`).not.toMatch(ERROR);
      for (const name of namesIn(listing)) {
        const child = (path ? `${path}/` : '') + name.replace(/\/$/, '');
        visited.push(child);
        if (name.endsWith('/')) visit(child);
        else expect(run(`cat ${child}`).join('\n'), `cat ${child}`).not.toMatch(ERROR);
      }
    };
    visit('');
    // make sure the walk really went into every directory
    expect(visited).toEqual(expect.arrayContaining([
      'about/about.txt', 'experience/vocera.txt', 'work/sensei-connect', 'repos/rails-chat', 'contact/linkedin', 'resume.txt',
    ]));
  });

  it('lists the working directory when ls has no argument', () => {
    const { run } = setup();
    run('cd experience');
    expect(run('ls')).toEqual(['vocera.txt  its.txt']);
  });

  it('understands ~, .., trailing slashes and /home/jj', () => {
    const { run } = setup();
    run('cd work');
    expect(run('ls ..')).toEqual(['about/  experience/  work/  repos/  contact/  resume.txt']);
    expect(run('ls ~/about/')).toEqual(['about.txt']);
    expect(run('ls /home/jj/contact')).toEqual(['linkedin  form.txt']);
    expect(run('ls /etc')).toEqual(['ls: /etc: No such file or directory']);
  });

  it('shows each project with its stack', () => {
    const { run } = setup();
    expect(run('ls work')).toEqual([
      'sensei-connect             Next.js, Supabase',
      'heartopia-hub              React, Capacitor',
      'weather-pet                Flutter',
      'marvel-rivals-randomizer   Vue',
    ]);
  });

  it('keeps projects as another name for work', () => {
    const { run } = setup();
    expect(run('ls projects')).toEqual(run('ls work'));
    expect(run('cat projects/weather-pet')[0]).toBe('Weather Pet');
  });

  it('prints a file name when ls is given a file', () => {
    const { run } = setup();
    expect(run('ls resume.txt')).toEqual(['resume.txt']);
  });

  it('says so when a directory is empty', () => {
    const { run } = setup({ repos: {} });
    expect(run('ls repos')).toEqual(['Nothing here yet.']);
  });

  it('ignores case in names', () => {
    const { run } = setup();
    expect(run('cat Experience/Vocera.txt')).toEqual(['Platform Developer II']);
  });
});

describe('from a section further down the page', () => {
  // The page sets cwd as you scroll, so these run with the shell already in a section
  const inExperience = () => {
    const s = setup();
    s.sh.cwd = '~/experience';
    return s;
  };

  it('resolves names from ~ when they are not in the working directory', () => {
    const { run } = inExperience();
    expect(run('ls work')).toEqual(run('ls ~/work'));
    expect(run('cat resume.txt')).toEqual(['RESUME TEXT']);
    expect(run('cat about/about.txt')).toEqual(['I build backends.']);
  });

  it('still prefers names in the working directory', () => {
    const { run } = inExperience();
    expect(run('ls')).toEqual(['vocera.txt  its.txt']);
    expect(run('cat its.txt')).toEqual(['Web intern']);
  });

  it('moves straight to another section with cd', () => {
    const { sh, run, actions } = inExperience();
    run('cd about');
    expect(actions.goto).toHaveBeenCalledWith('about');
    expect(sh.cwd).toBe('~/about');
  });

  it('completes names from the working directory and from ~', () => {
    const { sh } = inExperience();
    expect(sh.complete('cat v')).toBe('cat vocera.txt');
    expect(sh.complete('cd wo')).toBe('cd work/');
  });
});

describe('cat', () => {
  it('prints files by relative and absolute path', () => {
    const { run } = setup();
    run('cd experience');
    expect(run('cat vocera.txt')).toEqual(['Platform Developer II']);
    expect(run('cat ../about/about.txt')).toEqual(['I build backends.']);
    expect(run('cat ~/resume.txt')).toEqual(['RESUME TEXT']);
  });

  it('prints a project by name from anywhere', () => {
    const { run } = setup();
    run('cd about');
    expect(run('cat heartopia-hub')).toEqual(['Heartopia Hub', 'React, Capacitor', '', 'Companion app.', '', 'github.com/jogee489/heartopia-hub']);
    expect(run('cat weather pet')[0]).toBe('Weather Pet');
    // a private repo shows where its demo is instead
    expect(run('cat sensei-connect').at(-1)).toBe('www.youtube.com/watch?v=ZxlBJATvUNM');
  });

  it('explains directories, missing files and a missing name', () => {
    const { run } = setup();
    expect(run('cat work')).toEqual(["cat: work: Is a directory. Try 'ls work'."]);
    expect(run('cat nope')).toEqual(['cat: nope: No such file or directory']);
    expect(run('cat')).toEqual(["cat: missing file name. Try 'ls' to see what's here."]);
  });
});

describe('cd', () => {
  it('moves the page to the section and sets the working directory', () => {
    const { sh, run, actions } = setup();
    run('cd experience/');
    expect(actions.goto).toHaveBeenCalledWith('experience');
    expect(sh.cwd).toBe('~/experience');
    expect(run('pwd')).toEqual(['/home/jj/experience']);
  });

  it('goes back to the desk with cd, cd ~ and cd ..', () => {
    const { sh, run, actions } = setup();
    for (const cmd of ['cd', 'cd ~', 'cd ..']) {
      run('cd work');
      run(cmd);
      expect(sh.cwd).toBe('~');
    }
    expect(actions.top).toHaveBeenCalledTimes(3);
  });

  it('accepts the old projects name', () => {
    const { sh, run, actions } = setup();
    run('cd projects');
    expect(actions.goto).toHaveBeenCalledWith('work');
    expect(sh.cwd).toBe('~/work');
  });

  it('refuses files and missing paths without moving', () => {
    const { sh, run, actions } = setup();
    expect(run('cd resume.txt')).toEqual(['cd: not a directory: resume.txt']);
    expect(run('cd nowhere')).toEqual(['cd: no such file or directory: nowhere']);
    expect(actions.goto).not.toHaveBeenCalled();
    expect(sh.cwd).toBe('~');
  });
});

describe('open', () => {
  it('opens projects by name or path', () => {
    const { run, actions } = setup();
    expect(run('open heartopia-hub')).toEqual(['Opening github.com/jogee489/heartopia-hub']);
    run('open work/marvel-rivals-randomizer');
    expect(actions.open.mock.calls).toEqual([['https://github.com/jogee489/heartopia-hub'], ['https://jjdorko.com/marvel-rivals-randomizer/']]);
  });

  it('opens the demo video for a project with a private repo', () => {
    const { run, actions } = setup();
    expect(run('open sensei-connect')).toEqual(['Opening www.youtube.com/watch?v=ZxlBJATvUNM']);
    expect(actions.open).toHaveBeenCalledWith('https://www.youtube.com/watch?v=ZxlBJATvUNM');
  });

  it('opens the résumé and profile links', () => {
    const { run, actions } = setup();
    run('open resume.txt');
    run('open contact/linkedin');
    expect(actions.open.mock.calls).toEqual([[RESUME_URL], ['https://www.linkedin.com/in/jjdorko']]);
  });

  it('explains what it cannot open', () => {
    const { run, actions } = setup();
    expect(run('open about/about.txt')).toEqual(['open: about/about.txt: has no link to open']);
    expect(run('open work')).toEqual(['open: work: Is a directory']);
    expect(run('open nope')).toEqual(['open: nope: No such file or directory']);
    expect(run('open')).toEqual(["open: missing file name. Try 'open sensei-connect'."]);
    expect(actions.open).not.toHaveBeenCalled();
  });
});

describe('other commands', () => {
  it('runs every command that tab completion offers', () => {
    const { run } = setup();
    for (const cmd of COMMANDS) expect(run(cmd).join('\n'), cmd).not.toMatch(/command not found/);
  });

  it('only advertises commands that exist in help', () => {
    const advertised = HELP.flatMap(l => l.split(/\s{2,}/)[0].split(', ').map(c => c.split(' ')[0]));
    expect(advertised.filter(c => !COMMANDS.includes(c))).toEqual([]);
  });

  it('prints help and who this is', () => {
    const { run } = setup();
    expect(run('help')).toEqual(HELP);
    expect(run('?')).toEqual(HELP);
    expect(run('whoami')).toEqual([
      'JJ Dorko',
      'Software engineer in Osaka. Seven years of Rails, Java and Linux at Vocera,',
      'then COO and technical lead at a contracting company in Japan.',
      'Teaches English to students aged 1 to 65.',
    ]);
  });

  it('lists where to reach me', () => {
    expect(setup().run('contact')).toEqual([
      'linkedin  linkedin.com/in/jjdorko',
      'github    github.com/jogee489',
      "form      'cd contact'",
    ]);
  });

  it('numbers past commands in history, including itself', () => {
    const { run } = setup();
    run('whoami');
    run('ls work');
    expect(run('history')).toEqual(['   1  whoami', '   2  ls work', '   3  history']);
  });

  it('prints the date from the clock', () => {
    expect(setup().run('date')).toEqual([new Date('2026-10-17T12:00:00Z').toString()]);
  });

  it('accepts the usual aliases, in any case', () => {
    const { sh, run, actions } = setup();
    expect(run('LS ABOUT')).toEqual(['about.txt']);
    for (const editor of ['vi', 'nano', 'emacs']) expect(run(editor)).toEqual([`${editor}: this shell is read-only. Try 'cat' instead.`]);
    run('quit');
    expect(actions.close).toHaveBeenCalledTimes(1);
    run('cls');
    expect(sh.lines).toEqual([]);
  });

  it('shows a fresh prompt for an empty line and leaves it out of history', () => {
    const { sh, run } = setup();
    expect(run('   ')).toEqual([]);
    expect(sh.lines[sh.lines.length - 1]).toEqual({ t: 'in', s: '', cwd: '~' });
    expect(sh.prev()).toBe('');
  });

  it('prints the résumé and opens the full one', () => {
    const { run, actions } = setup();
    expect(run('resume')).toEqual(['RESUME TEXT', '', '→ opening the résumé (PDF) …']);
    expect(actions.open).toHaveBeenCalledWith(RESUME_URL);
  });

  it('switches the lamp, or explains when there is no desk', () => {
    expect(setup().run('lamp')).toEqual(['lamp: off. The monitor is enough light anyway.']);
    expect(setup({ desk: false }).run('lamp')).toEqual(['lamp: the desk needs WebGL, which this browser has off.']);
  });

  it('formats skills from the data file', () => {
    expect(setup().run('skills')).toEqual(['backend   Rails, Java']);
  });

  it('lines skill groups up behind the longest label', () => {
    const skills = [{ label: 'Languages', items: ['Ruby'] }, { label: 'Cloud & Infrastructure', items: ['AWS (EC2, S3)'] }];
    const sh = createShell({ root: dir({}), projects: [], skills, resume: [], resumeUrl: '', actions: {} as Actions });
    sh.run('skills');
    expect(sh.lines.slice(-2).map(l => l.s)).toEqual([
      'languages                Ruby',
      'cloud & infrastructure   AWS (EC2, S3)',
    ]);
  });

  it('walks history with the arrow keys', () => {
    const { sh, run } = setup();
    run('whoami');
    run('pwd');
    expect([sh.prev(), sh.prev(), sh.prev(), sh.next(), sh.next()]).toEqual(['pwd', 'whoami', 'whoami', 'pwd', '']);
  });

  it('clears the screen and closes on exit', () => {
    const { sh, run, actions } = setup();
    run('clear');
    expect(sh.lines).toEqual([]);
    run('exit');
    expect(actions.close).toHaveBeenCalled();
  });

  it('keeps the jokes', () => {
    const { run } = setup();
    expect(run('sudo ls')).toEqual(['jj is not in the sudoers file. This incident will be reported.']);
    expect(run('rm -rf /')).toEqual(['Not today.']);
    expect(run('rm resume.txt')).toEqual(['rm: permission denied']);
    expect(run('echo hello there')).toEqual(['hello there']);
    expect(run('vim')).toEqual(["vim: this shell is read-only. Try 'cat' instead."]);
    expect(run('make coffee')).toEqual(["make: command not found. Try 'help'."]);
  });

  it('greets with the date and a listing', () => {
    const { sh } = setup();
    expect(sh.lines[0].s).toBe('Last login: Sat Oct 17 2026 on ttys001');
    expect(sh.lines.map(l => l.s)).toContain('about/  experience/  work/  repos/  contact/  resume.txt');
  });

  it('notifies views and caps the scrollback', () => {
    const { sh } = setup();
    const view = vi.fn();
    sh.on(view);
    for (let i = 0; i < 300; i++) sh.run('echo hi');
    expect(view).toHaveBeenCalledTimes(300);
    expect(sh.lines.length).toBeLessThanOrEqual(400);
  });
});

describe('tab completion', () => {
  it('completes command names and lists ambiguous ones', () => {
    const { sh, printed } = setup();
    expect(sh.complete('wh')).toBe('whoami ');
    expect(sh.complete('c')).toBe('c');
    expect(printed()).toBe('cat  cd  contact  clear');
    expect(sh.complete('echo a')).toBe('echo a');
  });

  it('completes directories with a trailing slash', () => {
    const { sh } = setup();
    expect(sh.complete('ls a')).toBe('ls about/');
    expect(sh.complete('cd ex')).toBe('cd experience/');
  });

  it('completes inside directories and from the working directory', () => {
    const { sh, run } = setup();
    expect(sh.complete('cat work/we')).toBe('cat work/weather-pet');
    expect(sh.complete('cat experience/v')).toBe('cat experience/vocera.txt');
    run('cd experience');
    expect(sh.complete('cat i')).toBe('cat its.txt');
  });

  it('only offers directories to cd', () => {
    const { sh } = setup();
    expect(sh.complete('cd r')).toBe('cd repos/');
  });

  it('offers project names to cat and open from anywhere', () => {
    const { sh, printed } = setup();
    expect(sh.complete('open sen')).toBe('open sensei-connect');
    expect(sh.complete('cat m')).toBe('cat marvel-rivals-randomizer');
    expect(sh.complete('open h')).toBe('open heartopia-hub');
  });
});

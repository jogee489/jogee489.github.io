import { describe, expect, it } from 'vitest';
import { findPhone, parseSkills, problemWith, stableExport, toShellLines, type Block } from './resume-format';

// Shaped like the real résumé: section titles are bold all-caps paragraphs, and the
// certifications section has an all-caps line that isn't a title
const h = (text: string): Block => ({ tag: 'p', text, bold: true });
const p = (text: string): Block => ({ tag: 'p', text });
const BLOCKS: Block[] = [
  h('Joseph (JJ) Dorko'),
  p('Software Engineer  |  Suita, Osaka, Japan  |  jdorko90@gmail.com'),
  h('SUMMARY'),
  p('Software engineer with seven years building secure, high-availability clinical communication software.'),
  h('TECHNICAL SKILLS'),
  p('Languages: Ruby, Python, TypeScript'),
  p('AWS: EC2, S3, IAM'),
  p('Cloud & Infrastructure: AWS (EC2, S3), GitHub Actions, PostgreSQL'),
  h('EXPERIENCE'),
  p('Chief Operating Officer  |  ME Tech, Japan  |  01/2026 – 10/2026'),
  { tag: 'li', text: 'Upgraded LiveSchedule from Rails 4.2 to Rails 7.1, with 8,000+ unit tests and 500+ for Bokoco.' },
  h('CERTIFICATIONS'),
  p('JLPT N5 (2024)'),
];

describe('phone numbers', () => {
  // made-up numbers in the formats people actually write
  it.each([
    '+81 90-1234-5678',
    '090-1234-5678',
    '09012345678',
    '+819012345678',
    '(090) 1234 5678',
    '090‐1234‐5678', // U+2010 hyphens, as word processors write them
    '090–1234–5678', // en dashes
    '０９０-１２３４-５６７８', // full-width digits
    '+1 (555) 123-4567',
    '555.123.4567',
    'call me at 090 1234 5678 any time',
    '03-1234-5678',
    '(06) 6123-4567',
    '０９０ー１２３４ー５６７８', // typed with a Japanese keyboard: full-width digits and ー
    '090ｰ1234ｰ5678', // half-width ｰ
    '+44 20 7946 0958',
  ])('finds %s', s => {
    expect(findPhone(s)).toBeTruthy();
  });

  it.each([
    '01/2026 – 10/2026',
    '05/2013 – 11/2014',
    '2014 – 2021',
    '8,000+ unit tests and 500+ for Bokoco',
    '2,300+ healthcare facilities',
    'JLPT N5 (2024)',
    'Rails 4.2 to Rails 7.1',
    'about 800 students',
    'Junior Platform Developer (part-time), 11/2014 – 12/2016',
    '12/2017, completed while working full-time',
    'Vocera Communications | 2014 – 2016 (2.5 years)',
    'Osaka | 2016 – 2018 (18 months)',
    'from Rails 4.2 to 7.1 (2023 – 2024)',
    '2013\t2017\t3.8', // a table row, as the page text reads it
    '2014-2016',
    '2014 2015 2016',
    'Ruby 2.7.8 to Ruby 3.3',
  ])('leaves %s alone', s => {
    expect(findPhone(s)).toBeUndefined();
  });

  it("doesn't join numbers across lines", () => {
    expect(findPhone('2014 – 2016\n2016 – 2018')).toBeUndefined();
  });
});

describe('what not to publish', () => {
  it('accepts the résumé', () => {
    expect(problemWith(BLOCKS, BLOCKS.map(b => b.text).join('\n'))).toBeUndefined();
  });

  it('refuses a page that isn\'t the résumé, like a Google sign-in page', () => {
    const signIn = [p('Sign in'), p('to continue to Docs')];
    expect(problemWith(signIn, 'Sign in')).toMatch(/doesn't look like the résumé/);
  });

  it('refuses a résumé with a phone number, and says where without repeating it', () => {
    const withPhone = [...BLOCKS];
    withPhone[1] = p(`${BLOCKS[1].text}  |  +81 90-1234-5678`);
    const problem = problemWith(withPhone, withPhone.map(b => b.text).join('\n'));
    expect(problem).toMatch(/phone number \(paragraph 2\)/);
    expect(problem).not.toMatch(/\d{3}/);
  });

  it.each([
    'tel:+81-90-1234-5678',
    'https://wa.me/819012345678',
    'https://api.whatsapp.com/send?phone=819012345678',
    'sms:09012345678',
    // how Google's export writes a link: through google.com/url, with the address encoded
    'https://www.google.com/url?q=tel:%2B81%2090-1234-5678&sa=D&source=editors&ust=1&usg=x',
  ])('refuses a phone number hidden in a link: %s', href => {
    expect(problemWith(BLOCKS, BLOCKS.map(b => b.text).join('\n'), [href])).toMatch(/links to a phone number/);
  });

  it('accepts ordinary links', () => {
    const links = [
      'https://www.google.com/url?q=https://linkedin.com/in/jjdorko&sa=D&ust=1729000000000000&usg=AOvVaw',
      'mailto:jdorko90@gmail.com',
      'https://store.steampowered.com/app/1234567890/Echoes_of_Undeath/', // a long number that isn't a phone
    ];
    expect(problemWith(BLOCKS, BLOCKS.map(b => b.text).join('\n'), links)).toBeUndefined();
  });

  it('catches a number that only shows in the page text, such as in a table', () => {
    expect(problemWith(BLOCKS, 'Phone\t090-1234-5678')).toMatch(/phone number/);
  });
});

describe('shell résumé', () => {
  const lines = toShellLines(BLOCKS);

  it('starts with a box naming the file', () => {
    expect(lines[1]).toContain('joseph (jj) dorko — resume.txt');
    expect(new Set(lines.slice(0, 3).map(l => l.length)).size).toBe(1);
  });

  it('turns bold all-caps paragraphs into section rules', () => {
    expect(lines).toContain('── SUMMARY ' + '─'.repeat(45));
    expect(lines.filter(l => l.startsWith('── '))).toHaveLength(4);
  });

  it('keeps all-caps lines that aren\'t bold as text', () => {
    expect(lines).toContain('  JLPT N5 (2024)');
    expect(lines).toContain('  AWS: EC2, S3, IAM');
  });

  it('indents list items', () => {
    expect(lines.find(l => l.startsWith('    · '))).toMatch(/^    · Upgraded LiveSchedule/);
  });

  it('breaks "a | b | c" lines between their parts', () => {
    expect(lines).toContain('  Chief Operating Officer · ME Tech, Japan');
    expect(lines).toContain('  01/2026 – 10/2026');
  });

  it('wraps to the console width', () => {
    expect(Math.max(...lines.map(l => l.length))).toBeLessThanOrEqual(56);
  });
});

describe('skills', () => {
  it('reads every group under TECHNICAL SKILLS, including all-caps labels', () => {
    expect(parseSkills(BLOCKS)).toEqual([
      { label: 'Languages', items: ['Ruby', 'Python', 'TypeScript'] },
      { label: 'AWS', items: ['EC2', 'S3', 'IAM'] },
      { label: 'Cloud & Infrastructure', items: ['AWS (EC2, S3)', 'GitHub Actions', 'PostgreSQL'] },
    ]);
  });

  it('returns nothing when the section is missing', () => {
    expect(parseSkills(BLOCKS.slice(0, 3))).toEqual([]);
  });
});

describe('telling whether the doc changed', () => {
  const link = (ust: string, usg: string) =>
    `<a href="https://www.google.com/url?q=https://linkedin.com/in/x&amp;sa=D&amp;source=editors&amp;ust=${ust}&amp;usg=${usg}">x</a>`;

  it('ignores the parameters Google changes on every export', () => {
    expect(stableExport(link('1729000000000000', 'AOvVaw0abc'))).toBe(stableExport(link('1729999999999999', 'AOvVaw9xyz')));
  });

  it('still sees a changed link', () => {
    expect(stableExport(link('1', 'a'))).not.toBe(stableExport(link('1', 'a').replace('/in/x', '/in/y')));
  });
});

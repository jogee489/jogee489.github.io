// Turns the résumé, as read from the Google Doc, into what the site publishes: the shell's
// resume.txt and the skills list, and checks it's safe to publish. No DOM here, so it's unit
// tested; scripts/resume.ts does the fetching and the PDF.

/** a paragraph, list item or heading from the doc, in order; bold when all of its text is bold */
export type Block = { tag: string; text: string; bold?: boolean };
export type SkillGroup = { label: string; items: string[] };

// Phone numbers in the formats people write them, matched on whole numbers only. Between the
// digit groups: a space, dot, or a dash of any kind, including the ー a Japanese keyboard types.
const SEP = "[ .\\-\u2010-\u2015\u2212\u30fc~]";
const PHONES = [
  // Japanese: 090-1234-5678, 03 1234 5678, (06) 6123-4567, +81 90 1234 5678
  `(?:\\+81${SEP}?\\(?0?\\d{1,4}\\)?|\\(?0\\d{1,4}\\)?)${SEP}?\\d{1,4}${SEP}?\\d{4}`,
  // anywhere else, after a +: +1 (555) 123-4567, +44 20 7946 0958
  `\\+\\d{1,3}${SEP}?\\(?\\d{1,4}\\)?(?:${SEP}?\\d{2,4}){2,3}`,
  // North American without a +: (555) 123-4567, 555.123.4567
  `\\(?\\d{3}\\)?${SEP}?\\d{3}${SEP}?\\d{4}`,
  // written without breaks: 09012345678
  `\\d{10,13}`,
].map(p => new RegExp(`(?<![\\d+])${p}(?!\\d)`));

/**
 * The first phone number in the text, checking each line on its own. Full-width characters are
 * read as their usual forms first (０９０ as 090). Dates, years and counts like 2014 – 2016 (2.5
 * years) or 8,000+ aren't phone numbers: their groups are joined by more than one character.
 */
export function findPhone(text: string) {
  for (const line of text.normalize('NFKC').split('\n')) {
    for (const re of PHONES) {
      const m = line.match(re)?.[0];
      // a real number has 9 to 15 digits
      if (m && /^(?:\D*\d){9,15}\D*$/.test(m)) return m;
    }
  }
}

/**
 * Why this export shouldn't be published, or undefined when it's fine. Messages never repeat
 * the text they found, since build logs are public.
 */
export function problemWith(blocks: Block[], pageText: string, links: string[] = []) {
  // Google answers with a sign-in page if the doc stops being shared
  if (!blocks.some(b => /Dorko/.test(b.text))) return "the export doesn't look like the résumé";
  const at = blocks.findIndex(b => findPhone(b.text));
  if (at >= 0 || findPhone(pageText)) {
    return `the doc has a phone number${at >= 0 ? ` (paragraph ${at + 1})` : ''}; remove it and the next deploy publishes`;
  }
  // The PDF keeps link addresses, so a number behind a tel: or WhatsApp link would be published too
  if (links.some(href => findPhone(linkTarget(href)))) {
    return 'the doc links to a phone number (a tel: or messaging link); remove the link and the next deploy publishes';
  }
}

/**
 * The phone number a link dials or messages, if it's a tel:, sms: or WhatsApp link. Google sends
 * each link in the export through google.com/url?q=<address>, encoded, so unwrap that first.
 */
function linkTarget(href: string) {
  try {
    const url = new URL(href);
    const target = decodeURIComponent(url.hostname.endsWith('google.com') && url.pathname === '/url' ? url.searchParams.get('q') ?? '' : href);
    const m = target.match(/^(?:tel:|sms:|https?:\/\/(?:wa\.me|api\.whatsapp\.com\/send\?phone=)\/?)(.+)$/i);
    return m ? m[1] : '';
  } catch {
    return '';
  }
}

/**
 * The export with Google's per-download link parameters taken out. Each link in it goes through
 * google.com/url?q=…&ust=<time>&usg=<signature>, and those two change on every export, so the
 * doc would never look unchanged without this.
 */
export const stableExport = (html: string) => html.replace(/[?&](?:amp;)?(?:ust|usg)=[^&"'\s<>]*/g, '');

// Section titles in the doc are bold, all-caps paragraphs ("EXPERIENCE"). An all-caps line that
// isn't bold, like "JLPT N5 (2024)", is content.
const isHeading = (b: Block) =>
  /^h\d$/.test(b.tag) || (!!b.bold && /[A-Z]/.test(b.text) && b.text === b.text.toUpperCase() && b.text.length < 60);

const WIDTH = 56;
function wrap(text: string, first: string, rest: string) {
  const out: string[] = [];
  let line = first;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (line.trim() && line.length + word.length + 1 > WIDTH) {
      out.push(line.trimEnd());
      line = rest;
    }
    line += (line.endsWith(' ') ? '' : ' ') + word;
  }
  if (line.trim()) out.push(line.trimEnd());
  return out;
}

/** a line like "Title  |  Place  |  Dates", broken between its parts rather than inside them */
function wrapParts(parts: string[]) {
  const out: string[] = [];
  let line = '';
  for (const part of parts) {
    if (line && line.length + part.length + 3 > WIDTH) {
      out.push(line);
      line = '';
    }
    line = line ? `${line} · ${part}` : `  ${part}`;
  }
  if (line) out.push(line);
  return out.flatMap(l => (l.length > WIDTH ? wrap(l.trim(), '  ', '  ') : [l]));
}

/** the résumé as boxed, wrapped lines for the shell */
export function toShellLines(blocks: Block[]) {
  const [name, ...rest] = blocks.filter(b => b.text.trim());
  const title = `${(name?.text ?? 'résumé').toLowerCase()} — resume.txt`;
  const lines = [`┌${'─'.repeat(WIDTH - 2)}┐`, `│  ${title}`.padEnd(WIDTH - 1) + '│', `└${'─'.repeat(WIDTH - 2)}┘`];
  let prev: Block | undefined;
  for (const b of rest) {
    if (isHeading(b)) {
      lines.push('', `── ${b.text} ${'─'.repeat(Math.max(3, WIDTH - b.text.length - 4))}`, '');
    } else if (b.tag === 'li') {
      lines.push(...wrap(b.text, '    · ', '      '));
    } else {
      // a blank line between paragraphs, not after a heading
      if (prev && !isHeading(prev)) lines.push('');
      const parts = b.text.split(/\s*\|\s*/);
      lines.push(...(parts.length > 1 ? wrapParts(parts) : wrap(b.text, '  ', '  ')));
    }
    prev = b;
  }
  return lines;
}

/** splits on commas that aren't inside brackets, so "AWS (EC2, S3)" stays one item */
const splitItems = (s: string) =>
  s.split(/,(?![^()]*\))/).map(i => i.trim().replace(/\.$/, '')).filter(Boolean);

/** the "Label: a, b, c" lines under the TECHNICAL SKILLS heading */
export function parseSkills(blocks: Block[]): SkillGroup[] {
  const start = blocks.findIndex(b => isHeading(b) && /SKILLS/i.test(b.text));
  if (start < 0) return [];
  const groups: SkillGroup[] = [];
  for (const b of blocks.slice(start + 1)) {
    if (isHeading(b)) break;
    const m = b.text.match(/^([^:]{2,40}):\s*(.+)$/);
    if (m) groups.push({ label: m[1].trim(), items: splitItems(m[2]) });
  }
  return groups;
}

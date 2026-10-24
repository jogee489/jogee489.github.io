// Reporting from inside a GitHub Actions run: step outputs, annotations and the run summary.
// Outside Actions they just print, or do nothing.
import { appendFile } from 'node:fs/promises';

/** the runner reads outputs and annotations line by line, so a value must fit on one line */
export const oneLine = (s: string, max = 500) => s.replace(/\s+/g, ' ').trim().slice(0, max);

export async function setOutputs(values: Record<string, string>) {
  if (!process.env.GITHUB_OUTPUT) return;
  await appendFile(process.env.GITHUB_OUTPUT, Object.entries(values).map(([k, v]) => `${k}=${oneLine(v)}\n`).join(''));
}

/** an error or warning on the run; % has to be escaped in the message */
export function annotate(level: 'error' | 'warning', title: string, message: string) {
  if (process.env.GITHUB_ACTIONS) console.log(`::${level} title=${title}::${oneLine(message).replace(/%/g, '%25')}`);
  else console.warn(`${title}: ${message}`);
}

export async function summary(heading: string, body: string) {
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `### ${heading}\n\n${body}\n\n`);
}

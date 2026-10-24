import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { annotate, oneLine, setOutputs } from './github';

afterEach(() => vi.unstubAllEnvs());

describe('GitHub step outputs', () => {
  it('writes each value on one line, so a multi-line error can\'t break the step', async () => {
    const file = join(await mkdtemp(join(tmpdir(), 'gh-')), 'output');
    vi.stubEnv('GITHUB_OUTPUT', file);
    await setOutputs({ problem: 'page.setContent: Timeout exceeded.\nCall log:\n  - waiting', notice: '' });
    expect(await readFile(file, 'utf8')).toBe('problem=page.setContent: Timeout exceeded. Call log: - waiting\nnotice=\n');
  });

  it('keeps long values short', () => {
    expect(oneLine('x'.repeat(900))).toHaveLength(500);
  });
});

describe('annotations', () => {
  it('formats an error for the runner on one line, escaping %', () => {
    vi.stubEnv('GITHUB_ACTIONS', 'true');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    annotate('error', 'Résumé not updated', '100% sure\nsecond line');
    expect(log).toHaveBeenCalledWith('::error title=Résumé not updated::100%25 sure second line');
    log.mockRestore();
  });
});

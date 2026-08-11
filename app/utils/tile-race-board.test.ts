import { describe, expect, it } from 'vitest';
import { parseBoardScript } from './tile-race-board';

describe('parseBoardScript', () => {
  it('parses tasks, movement tiles, comments, and blank lines', () => {
    const result = parseBoardScript(
      [
        '# the opening stretch',
        'TASK 60KC @ Barrows | Any member reaches 60 KC',
        '',
        'BACK 3',
        'fwd 2',
        'TASK Any GWD unique',
      ].join('\n'),
    );

    expect(result).toEqual({
      ok: true,
      tiles: [
        {
          type: 'TASK',
          name: '60KC @ Barrows',
          description: 'Any member reaches 60 KC',
        },
        { type: 'GO_BACK', amount: 3 },
        { type: 'GO_FORWARD', amount: 2 },
        { type: 'TASK', name: 'Any GWD unique' },
      ],
    });
  });

  it('keeps pipes after the first as part of the description', () => {
    const result = parseBoardScript('TASK Solo CoX | no deaths | under 30 min');
    expect(result).toEqual({
      ok: true,
      tiles: [
        {
          type: 'TASK',
          name: 'Solo CoX',
          description: 'no deaths | under 30 min',
        },
      ],
    });
  });

  it('reports every bad line with its line number', () => {
    const result = parseBoardScript(
      ['TASK ok', 'TELEPORT 3', 'BACK zero'].join('\n'),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]).toContain('Line 2');
      expect(result.errors[1]).toContain('Line 3');
    }
  });

  it('rejects an empty board', () => {
    const result = parseBoardScript('# nothing but comments\n\n');
    expect(result.ok).toBe(false);
  });
});

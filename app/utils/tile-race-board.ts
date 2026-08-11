import type { IBoardTileInput } from '~/services/events-admin-service.server';

/**
 * The board script: the admin portal's human-friendly board format, one tile per
 * line, converted to the events API's board definition. START and FINISH are
 * added by the events service — the script is only the tiles between them.
 *
 *   # comments and blank lines are ignored
 *   TASK 60KC @ Barrows | Any member reaches 60 Barrows KC
 *   BACK 3
 *   FWD 2
 */
export type BoardParseResult =
  | { ok: true; tiles: IBoardTileInput[] }
  | { ok: false; errors: string[] };

const MOVEMENT_PATTERN = /^(BACK|FWD|FORWARD)\s+(\d+)$/i;
const TASK_PATTERN = /^TASK\s+(.+)$/i;

const parseLine = (line: string): IBoardTileInput | string => {
  const movement = line.match(MOVEMENT_PATTERN);
  if (movement) {
    const amount = parseInt(movement[2], 10);
    if (amount < 1) {
      return 'movement amount must be at least 1';
    }
    return {
      type: movement[1].toUpperCase() === 'BACK' ? 'GO_BACK' : 'GO_FORWARD',
      amount,
    };
  }

  const task = line.match(TASK_PATTERN);
  if (task) {
    const [name, ...descriptionParts] = task[1].split('|');
    if (!name.trim()) {
      return 'TASK needs a name';
    }
    const description = descriptionParts.join('|').trim();
    return {
      type: 'TASK',
      name: name.trim(),
      ...(description ? { description } : {}),
    };
  }

  return 'expected "TASK <name> [| description]", "BACK <n>", or "FWD <n>"';
};

export const parseBoardScript = (script: string): BoardParseResult => {
  const parsed = script
    .split('\n')
    .map((raw, i) => ({ line: raw.trim(), lineNumber: i + 1 }))
    .filter(({ line }) => line && !line.startsWith('#'))
    .map(({ line, lineNumber }) => ({ lineNumber, result: parseLine(line) }));

  const errors = parsed
    .filter(
      (p): p is { lineNumber: number; result: string } =>
        typeof p.result === 'string',
    )
    .map(p => `Line ${p.lineNumber}: ${p.result}`);

  if (errors.length) {
    return { ok: false, errors };
  }

  const tiles = parsed.map(p => p.result as IBoardTileInput);
  if (!tiles.length) {
    return { ok: false, errors: ['The board needs at least one tile'] };
  }
  return { ok: true, tiles };
};

export const BOARD_SCRIPT_PLACEHOLDER = [
  '# One tile per line, in board order. START and FINISH are added for you.',
  'TASK 60KC @ Barrows | Any member reaches 60 Barrows KC during the event',
  'TASK Any GWD unique',
  'BACK 3',
  'TASK Any raid unique | Any unique from CoX, ToB, or ToA',
  'FWD 2',
].join('\n');

import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LocalDate } from '~/components/LocalDate';
import dayjs from './dayjs';

// The October EHB comp ends 03:59 UTC Nov 1, which is still Oct 31 in New York.
const COMP_END = '2026-11-01T03:59:00.000Z';

describe('LocalDate', () => {
  const previousTz = process.env.TZ;
  beforeEach(() => {
    process.env.TZ = 'America/New_York';
  });
  afterEach(() => {
    process.env.TZ = previousTz;
  });

  it('renders UTC on the server pass so hydration matches the server HTML', () => {
    expect(
      renderToString(
        createElement(LocalDate, { date: COMP_END, format: 'MMM D, YYYY' }),
      ),
    ).toBe('Nov 1, 2026');
  });

  it('differs from the local date, which is why the server pass cannot use it', () => {
    expect(dayjs(COMP_END).format('MMM D, YYYY')).toBe('Oct 31, 2026');
  });
});

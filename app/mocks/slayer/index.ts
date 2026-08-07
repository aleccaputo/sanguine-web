import {
  MOCK_SPINS,
  MOCK_WHEEL_CLAN_EVENTS,
  MOCK_WHEELS,
} from '~/mocks/fixtures.server';

export const SPIN_STATUS = {
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  REPLACED: 'REPLACED',
  EXPIRED: 'EXPIRED',
} as const;

export const getWheelConfigs = async () => MOCK_WHEELS;

export const getWheelClanEvents = async () => MOCK_WHEEL_CLAN_EVENTS;

export const getCompletedSpins = async () =>
  MOCK_SPINS.filter(spin => spin.status === SPIN_STATUS.COMPLETED);

export const getActiveSpins = async () =>
  MOCK_SPINS.filter(spin => spin.status === SPIN_STATUS.ACTIVE);

export const getSpinsForDiscordId = async (discordId: string) =>
  MOCK_SPINS.filter(spin => spin.discordId === discordId);

export const getSpinCountsByStatus = async (): Promise<
  Record<string, number>
> =>
  MOCK_SPINS.reduce<Record<string, number>>(
    (counts, spin) => ({
      ...counts,
      [spin.status]: (counts[spin.status] ?? 0) + 1,
    }),
    {},
  );

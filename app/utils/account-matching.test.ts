import { describe, it, expect } from 'vitest';
import {
  matchesAccountName,
  buildAltsByDiscordId,
  resolveDisplayName,
} from './account-matching';

describe('matchesAccountName', () => {
  const mainNickname = 'MainRSN';

  describe('when checking the main account', () => {
    it('matches null osrsName (legacy records)', () => {
      expect(matchesAccountName(null, 'MainRSN', mainNickname)).toBe(true);
    });

    it('matches when osrsName equals main nickname', () => {
      expect(matchesAccountName('MainRSN', 'MainRSN', mainNickname)).toBe(true);
    });

    it('matches case-insensitively', () => {
      expect(matchesAccountName('mainrsn', 'MainRSN', mainNickname)).toBe(true);
      expect(matchesAccountName('MAINRSN', 'mainrsn', mainNickname)).toBe(true);
    });

    it('matches with surrounding whitespace', () => {
      expect(matchesAccountName(' MainRSN ', 'MainRSN', mainNickname)).toBe(true);
    });

    it('does not match a different osrsName', () => {
      expect(matchesAccountName('SomeAlt', 'MainRSN', mainNickname)).toBe(false);
    });
  });

  describe('when checking an alt account', () => {
    it('matches when osrsName equals alt name', () => {
      expect(matchesAccountName('MyAlt', 'MyAlt', mainNickname)).toBe(true);
    });

    it('matches case-insensitively', () => {
      expect(matchesAccountName('myalt', 'MyAlt', mainNickname)).toBe(true);
    });

    it('does not match null osrsName', () => {
      expect(matchesAccountName(null, 'MyAlt', mainNickname)).toBe(false);
    });

    it('does not match a different osrsName', () => {
      expect(matchesAccountName('OtherAlt', 'MyAlt', mainNickname)).toBe(false);
    });

    it('does not match the main nickname', () => {
      expect(matchesAccountName('MainRSN', 'MyAlt', mainNickname)).toBe(false);
    });
  });
});

describe('buildAltsByDiscordId', () => {
  it('returns an empty map for no alts', () => {
    const result = buildAltsByDiscordId([]);
    expect(result.size).toBe(0);
  });

  it('groups alts by discordId', () => {
    const alts = [
      { discordId: 'user1', altName: 'Alt1' },
      { discordId: 'user1', altName: 'Alt2' },
      { discordId: 'user2', altName: 'Alt3' },
    ];
    const result = buildAltsByDiscordId(alts);

    expect(result.size).toBe(2);
    expect(result.get('user1')).toEqual(new Set(['alt1', 'alt2']));
    expect(result.get('user2')).toEqual(new Set(['alt3']));
  });

  it('lowercases alt names', () => {
    const result = buildAltsByDiscordId([
      { discordId: 'user1', altName: 'MyAlt' },
    ]);
    expect(result.get('user1')!.has('myalt')).toBe(true);
    expect(result.get('user1')!.has('MyAlt')).toBe(false);
  });
});

describe('resolveDisplayName', () => {
  const mainNickname = 'MainRSN';
  const altNames = new Set(['myalt', 'anotherone']);

  it('returns main nickname when osrsName is null', () => {
    expect(resolveDisplayName(null, mainNickname, altNames)).toBe('MainRSN');
  });

  it('returns main nickname when osrsName is not an alt', () => {
    expect(resolveDisplayName('MainRSN', mainNickname, altNames)).toBe('MainRSN');
  });

  it('returns "AltName (MainName)" when osrsName is an alt', () => {
    expect(resolveDisplayName('MyAlt', mainNickname, altNames)).toBe(
      'MyAlt (MainRSN)',
    );
  });

  it('matches alt names case-insensitively', () => {
    expect(resolveDisplayName('MYALT', mainNickname, altNames)).toBe(
      'MYALT (MainRSN)',
    );
  });

  it('returns main nickname for unknown osrsName', () => {
    expect(resolveDisplayName('UnknownRSN', mainNickname, altNames)).toBe(
      'MainRSN',
    );
  });

  it('handles empty alt set', () => {
    expect(resolveDisplayName('MyAlt', mainNickname, new Set())).toBe('MainRSN');
  });
});

interface AltRecord {
  altName: string;
  discordId: string;
}

/**
 * Check if an osrsName belongs to a given account.
 * For the main account, null (legacy) or an exact match counts.
 * For alts, only an exact match counts.
 */
export const matchesAccountName = (
  osrsName: string | null,
  accountName: string,
  mainNickname: string,
): boolean => {
  if (accountName.toLowerCase().trim() === mainNickname.toLowerCase().trim()) {
    return (
      osrsName == null ||
      osrsName.toLowerCase().trim() === mainNickname.toLowerCase().trim()
    );
  }
  return (
    osrsName != null &&
    osrsName.toLowerCase().trim() === accountName.toLowerCase().trim()
  );
};

/**
 * Build a map of discordId -> Set of lowercased alt names.
 */
export const buildAltsByDiscordId = (
  alts: AltRecord[],
): Map<string, Set<string>> =>
  alts.reduce((map, alt) => {
    const existing = map.get(alt.discordId) ?? new Set<string>();
    existing.add(alt.altName.toLowerCase());
    return map.set(alt.discordId, existing);
  }, new Map<string, Set<string>>());

/**
 * Resolve the display name parts for an account.
 * For an alt, `name` is the alt's osrsName and `mainAccount` is the main nickname.
 * For a main, `name` is the main nickname and `mainAccount` is null.
 */
export const resolveDisplayParts = (
  osrsName: string | null,
  mainNickname: string,
  altNames: Set<string>,
): { name: string; mainAccount: string | null } => {
  const isAlt =
    osrsName != null && altNames.has(osrsName.toLowerCase().trim());
  return isAlt
    ? { name: osrsName, mainAccount: mainNickname }
    : { name: mainNickname, mainAccount: null };
};

/**
 * Resolve the display name for a drop recipient.
 * Returns "AltName (MainName)" for alts, or mainNickname for mains.
 */
export const resolveDisplayName = (
  osrsName: string | null,
  mainNickname: string,
  altNames: Set<string>,
): string => {
  const { name, mainAccount } = resolveDisplayParts(
    osrsName,
    mainNickname,
    altNames,
  );
  return mainAccount ? `${name} (${mainAccount})` : name;
};

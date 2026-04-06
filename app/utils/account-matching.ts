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
 * Resolve the display name for a drop recipient.
 * Returns "AltName (MainName)" for alts, or mainNickname for mains.
 */
export const resolveDisplayName = (
  osrsName: string | null,
  mainNickname: string,
  altNames: Set<string>,
): string => {
  const isAlt =
    osrsName != null && altNames.has(osrsName.toLowerCase().trim());
  return isAlt ? `${osrsName} (${mainNickname})` : mainNickname;
};

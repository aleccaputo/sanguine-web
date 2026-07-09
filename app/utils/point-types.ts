// PointAudit types that always pay into the clan-points bucket (GROUP_RAID payouts and manual
// CLAN adjustments) rather than the drop-driven `points` bucket. Mirrors the Discord bot's
// leaderboard exclusion — clan points never count toward drop-point charts or event totals.
export const CLAN_POINT_AUDIT_TYPES = ['GROUP_RAID', 'CLAN_MANUAL'] as const;

// When COMPETITION rewards (BOTW/SOTW/ROTW) moved from the drop-points bucket to clan points.
// COMPETITION audits before this instant were drop points and still count toward drop-point
// history; audits on/after it are clan points. Keep in sync with
// COMPETITION_CLAN_POINTS_CUTOVER in the bot's AuditService.
export const COMPETITION_CLAN_POINTS_CUTOVER = '2026-07-09T17:30:00.000Z';

interface IAuditBucketFields {
  type: string;
  createdAt: string;
}

// Whether an audit row is excluded from drop-point history (charts, event totals). Pre-cutover
// COMPETITION rows are NOT excluded — they paid into the drop bucket at award time and count in
// both buckets (see isLegacyCompetitionAudit). createdAt is an ISO-8601 UTC string (see the
// PointAudit schema), so lexicographic comparison is time order — the same comparison the bot's
// Mongo $gte performs.
export const isClanPointAudit = ({
  type,
  createdAt,
}: IAuditBucketFields): boolean =>
  (CLAN_POINT_AUDIT_TYPES as readonly string[]).includes(type) ||
  (type === 'COMPETITION' && createdAt >= COMPETITION_CLAN_POINTS_CUTOVER);

// Pre-cutover COMPETITION awards retroactively count as clan points too, but the bot only ever
// added them to the user record's drop bucket — so displays credit them on top of the stored
// clanPoints total.
export const isLegacyCompetitionAudit = ({
  type,
  createdAt,
}: IAuditBucketFields): boolean =>
  type === 'COMPETITION' && createdAt < COMPETITION_CLAN_POINTS_CUTOVER;

import { json, LoaderFunctionArgs } from '@remix-run/node';
import { requireModerator } from '~/services/auth.server';
import {
  getBountyScorecard,
  IBountyScorecardResult,
  womOutcome,
} from '~/services/engagement-service.server';
import type { FetchOutcome } from '~/utils/engagement';

export type BountyScorecardOutcome = FetchOutcome<{
  result: IBountyScorecardResult;
}>;

// Resource route behind the insights page's per-bounty fetchers: one bounty's WOM scorecard,
// computed on demand so listing every bounty costs no WOM calls. Flat-named (insights_) so it
// doesn't nest under the page and drag its loader along. An unknown id or a WOM failure comes
// back as { ok: false } for the row to show in place.
export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireModerator(request);
  const outcome = await womOutcome(async () => ({
    result: await getBountyScorecard(params.id ?? ''),
  }));
  const answer: BountyScorecardOutcome = !outcome.ok
    ? outcome
    : outcome.result === null
      ? { ok: false, error: 'No such bounty.' }
      : { ok: true, result: outcome.result };
  return json(answer);
}

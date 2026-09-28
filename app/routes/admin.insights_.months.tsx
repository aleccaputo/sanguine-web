import { json, LoaderFunctionArgs } from '@remix-run/node';
import { requireModerator } from '~/services/auth.server';
import {
  getInGameMonths,
  womOutcome,
} from '~/services/engagement-service.server';

/** How many calendar months the activity-by-month charts cover. */
export const INSIGHTS_MONTHS = 6;

// Resource route behind the insights page's activity-by-month fetcher: who played in each of
// the last months, from one cached WOM overall-xp read per month. A WOM failure comes back as
// { ok: false } for the section to show a retry.
export async function loader({ request }: LoaderFunctionArgs) {
  await requireModerator(request);
  return json(await womOutcome(() => getInGameMonths(INSIGHTS_MONTHS)));
}

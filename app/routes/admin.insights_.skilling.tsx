import { json, LoaderFunctionArgs } from '@remix-run/node';
import { requireModerator } from '~/services/auth.server';
import {
  getSkillingOnly,
  womOutcome,
} from '~/services/engagement-service.server';
import { parsePvmPeriodDays } from '~/utils/engagement';

// Resource route behind the insights page's "Skilling only" fetcher: members active in-game
// over the period who gained almost no EHB, from two cached WOM group-gains reads. A WOM
// failure comes back as { ok: false } for the section to show a retry.
export async function loader({ request }: LoaderFunctionArgs) {
  await requireModerator(request);
  const days = parsePvmPeriodDays(
    new URL(request.url).searchParams.get('days'),
  );
  return json(await womOutcome(() => getSkillingOnly(days)));
}

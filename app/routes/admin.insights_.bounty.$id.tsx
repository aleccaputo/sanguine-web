import { json, LoaderFunctionArgs } from '@remix-run/node';
import { requireModerator } from '~/services/auth.server';
import { getBountyScorecard } from '~/services/engagement-service.server';

// Resource route behind the insights page's per-bounty fetchers: one bounty's WOM scorecard,
// computed on demand so listing every bounty costs no WOM calls. Flat-named (insights_) so it
// doesn't nest under the page and drag its loader along.
export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireModerator(request);
  const result = await getBountyScorecard(params.id ?? '');
  if (!result) {
    throw new Response('Not found', { status: 404 });
  }
  return json(result);
}

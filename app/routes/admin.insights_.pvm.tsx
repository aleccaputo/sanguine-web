import { json, LoaderFunctionArgs } from '@remix-run/node';
import { requireModerator } from '~/services/auth.server';
import {
  DEFAULT_PVM_METRIC,
  getPvmActivity,
  isPvmMetricKey,
  womOutcome,
} from '~/services/engagement-service.server';
import { parsePvmPeriodDays } from '~/utils/engagement';

// Resource route behind the insights page's PvM activity fetcher: one metric over the last N
// days, from a single (cached) WOM group-gains read. Unknown metrics and periods fall back to
// the defaults rather than erroring, so a stale link still renders something sensible; a WOM
// failure comes back as { ok: false } for the section to show a retry.
export async function loader({ request }: LoaderFunctionArgs) {
  await requireModerator(request);
  const url = new URL(request.url);
  const metricParam = url.searchParams.get('metric') ?? '';
  const metric = isPvmMetricKey(metricParam) ? metricParam : DEFAULT_PVM_METRIC;
  const days = parsePvmPeriodDays(url.searchParams.get('days'));
  return json(await womOutcome(() => getPvmActivity(metric, days)));
}

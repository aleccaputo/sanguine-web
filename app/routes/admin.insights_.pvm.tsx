import { json, LoaderFunctionArgs } from '@remix-run/node';
import { requireStaff } from '~/services/auth.server';
import {
  DEFAULT_PVM_METRIC,
  getPvmActivity,
  isPvmMetric,
} from '~/services/engagement-service.server';
import { PVM_PERIOD_DAYS } from '~/utils/engagement';

// Resource route behind the insights page's PvM activity fetcher: one metric over the last N
// days, from a single (cached) WOM group-gains read. Unknown metrics and periods fall back to
// the defaults rather than erroring, so a stale link still renders something sensible.
export async function loader({ request }: LoaderFunctionArgs) {
  await requireStaff(request);
  const url = new URL(request.url);
  const metricParam = url.searchParams.get('metric') ?? '';
  const metric = isPvmMetric(metricParam) ? metricParam : DEFAULT_PVM_METRIC;
  const daysParam = Number(url.searchParams.get('days'));
  const days = (PVM_PERIOD_DAYS as readonly number[]).includes(daysParam)
    ? daysParam
    : 30;
  return json(await getPvmActivity(metric, days));
}

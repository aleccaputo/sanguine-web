import { json, LoaderFunctionArgs } from '@remix-run/node';
import { requireStaff } from '~/services/auth.server';
import { getSkillingOnly } from '~/services/engagement-service.server';
import { PVM_PERIOD_DAYS } from '~/utils/engagement';

// Resource route behind the insights page's "Skilling only" fetcher: members active in-game
// over the period who gained almost no EHB, from two cached WOM group-gains reads.
export async function loader({ request }: LoaderFunctionArgs) {
  await requireStaff(request);
  const daysParam = Number(new URL(request.url).searchParams.get('days'));
  const days = (PVM_PERIOD_DAYS as readonly number[]).includes(daysParam)
    ? daysParam
    : 30;
  return json(await getSkillingOnly(days));
}

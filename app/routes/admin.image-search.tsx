import { json, LoaderFunctionArgs } from '@remix-run/node';
import { requireStaff } from '~/services/auth.server';
import { searchItems } from '~/services/osrs-wiki-prices-service';
import {
  ITileImageOption,
  searchBossImages,
} from '~/utils/tile-image-catalog';

const MAX_RESULTS = 12;

/**
 * Resource route backing the tile builder's image picker: bosses/activities
 * from the curated catalog first, then items from the wiki mapping. Staff-only
 * — data requests skip the /admin layout gate, so the check lives here too.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  await requireStaff(request);
  const query = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  if (query.length < 2) {
    return json({ results: [] as ITileImageOption[] });
  }

  const bosses = searchBossImages(query, MAX_RESULTS);
  const items = await searchItems(query, MAX_RESULTS - bosses.length).catch(
    () => [],
  );
  return json({
    results: [
      ...bosses,
      ...items.map(item => ({ label: item.name, imageUrl: item.icon })),
    ].slice(0, MAX_RESULTS),
  });
}

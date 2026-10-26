import { faker } from '@faker-js/faker';

export interface OSRSItem {
  id: number;
  name: string;
  icon: string;
  price?: number;
}

export const wikiItemIconUrl = (): string => '/sanguine_icon.png';

// Deterministic stand-in for the admin image picker's item search
export const searchItems = async (
  query: string,
  limit: number,
): Promise<{ name: string; icon: string }[]> => {
  const lower = query.toLocaleLowerCase();
  return ['Abyssal whip', 'Dragon warhammer', 'Twisted bow', 'Scythe of vitur']
    .filter(name => name.toLocaleLowerCase().includes(lower))
    .slice(0, limit)
    .map(name => ({ name, icon: '/sanguine_icon.png' }));
};

// Deterministic ids (900000 + index) so mock audits can reference the names they ask for.
export const findItemIdsByNames = async (
  names: string[],
): Promise<Record<string, number[]>> =>
  Object.fromEntries(
    names.map((name, index) => [name.toLocaleLowerCase(), [900000 + index]]),
  );

const itemCache = new Map<number, OSRSItem>();

export const fetchOSRSItem = async (
  itemId: number,
): Promise<OSRSItem | null> => {
  const cached = itemCache.get(itemId);
  if (cached) return cached;

  faker.seed(itemId);
  const includePrice = faker.datatype.boolean(0.85);
  const priceTier = faker.number.int({ min: 0, max: 6 });
  const item: OSRSItem = {
    id: itemId,
    name: faker.commerce.productName(),
    icon: '/sanguine_icon.png',
    price: includePrice
      ? faker.number.int({ min: 100, max: 999 }) * Math.pow(10, priceTier)
      : undefined,
  };
  itemCache.set(itemId, item);
  return item;
};

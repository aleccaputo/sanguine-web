import { faker } from '@faker-js/faker';

export interface OSRSItem {
  id: number;
  name: string;
  icon: string;
  price?: number;
}

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

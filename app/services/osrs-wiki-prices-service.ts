import { untradeableItems } from '~/utils/untradable-items';
import { toTitleCase } from '~/utils/string-helpers';

export interface OSRSItem {
  id: number;
  name: string;
  icon: string;
  price?: number; // GE price for tradeable items
}

interface PricesResponseData {
  data: {
    [itemId: string]: {
      high: number | null;
      highTime: number | null;
      low: number | null;
      lowTime: number | null;
    };
  };
}

interface MappingItem {
  id: number;
  name: string;
}

const WIKI_HEADERS = {
  'User-Agent': 'sanguine-osrs.com - Clan Website (sanguine.pvm@gmail.com)',
};

// Cache durations
const LONG_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours (items + mapping)
const PRICE_CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

// Item cache for assembled OSRSItem objects
const itemCache: { [itemId: number]: { data: OSRSItem | null; timestamp: number } } = {};

// In-flight deduplication for item fetches
const itemFetchPromises = new Map<number, Promise<OSRSItem | null>>();

// Price cache
let priceCache: { data: PricesResponseData | null; timestamp: number } = { data: null, timestamp: 0 };
let priceFetchPromise: Promise<PricesResponseData> | null = null;

// Mapping cache (id → MappingItem)
let mappingCache: { data: Record<number, MappingItem> | null; timestamp: number } = { data: null, timestamp: 0 };
let mappingFetchPromise: Promise<Record<number, MappingItem>> | null = null;

/**
 * Formats an item name for use in a Wiki image URL
 * Example: "staff of the dead" -> "Staff_of_the_dead"
 */
function formatItemNameForWiki(name: string): string {
  return name
    .split(' ')
    .map((word, index) => (index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join('_');
}

/**
 * Fetches the full item mapping from the OSRS Wiki (id → name)
 */
async function fetchAllMapping(): Promise<Record<number, MappingItem>> {
  const now = Date.now();

  if (mappingCache.data && now - mappingCache.timestamp < LONG_CACHE_DURATION) {
    return mappingCache.data;
  }

  if (mappingFetchPromise) return mappingFetchPromise;

  mappingFetchPromise = fetch('https://prices.runescape.wiki/api/v1/osrs/mapping', {
    headers: WIKI_HEADERS,
  })
    .then(async response => {
      if (!response.ok) {
        throw new Error(`Failed to fetch mapping: ${response.status} ${response.statusText}`);
      }
      const items: MappingItem[] = await response.json();
      const data = Object.fromEntries(items.map(item => [item.id, item])) as Record<number, MappingItem>;
      mappingCache = { data, timestamp: Date.now() };
      return data;
    })
    .finally(() => {
      mappingFetchPromise = null;
    });

  return mappingFetchPromise;
}

/**
 * Fetches item details with name and Wiki image URL
 */
export async function fetchOSRSItem(itemId: number): Promise<OSRSItem | null> {
  const now = Date.now();

  if (itemCache[itemId] && now - itemCache[itemId].timestamp < LONG_CACHE_DURATION) {
    return itemCache[itemId].data;
  }

  const inflight = itemFetchPromises.get(itemId);
  if (inflight) return inflight;

  // Untradeable items - use local mapping
  if (untradeableItems[itemId]) {
    const itemName = untradeableItems[itemId];
    const icon =
      itemId === 0
        ? '/sanguine_icon.png'
        : `https://oldschool.runescape.wiki/images/${formatItemNameForWiki(itemName)}_detail.png`;

    const itemData: OSRSItem = { id: itemId, name: toTitleCase(itemName), icon };
    itemCache[itemId] = { data: itemData, timestamp: now };
    return itemData;
  }

  // Tradeable items - name + icon from wiki mapping, price from wiki prices
  const fetchPromise = (async () => {
    try {
      const [mapping, pricesData] = await Promise.all([fetchAllMapping(), fetchAllPrices()]);

      const entry = mapping[itemId];
      if (!entry) return null;

      const priceInfo = pricesData.data[itemId];
      const currentPrice = priceInfo?.high || priceInfo?.low || undefined;

      const itemData: OSRSItem = {
        id: itemId,
        name: toTitleCase(entry.name),
        icon: `https://oldschool.runescape.wiki/images/${formatItemNameForWiki(entry.name)}_detail.png`,
        price: currentPrice,
      };

      itemCache[itemId] = { data: itemData, timestamp: Date.now() };
      return itemData;
    } catch (error) {
      console.error('Error fetching item:', error);
      return null;
    } finally {
      itemFetchPromises.delete(itemId);
    }
  })();

  itemFetchPromises.set(itemId, fetchPromise);
  return fetchPromise;
}

/**
 * Fetches all item prices from the OSRS Wiki API with caching
 */
async function fetchAllPrices(): Promise<PricesResponseData> {
  const now = Date.now();

  if (priceCache.data && now - priceCache.timestamp < PRICE_CACHE_DURATION) {
    return priceCache.data;
  }

  if (priceFetchPromise) return priceFetchPromise;

  console.log('Fetching fresh price data from API');
  priceFetchPromise = fetch('https://prices.runescape.wiki/api/v1/osrs/latest', {
    headers: WIKI_HEADERS,
  })
    .then(async response => {
      if (!response.ok) {
        throw new Error(`Failed to fetch prices: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      priceCache = { data, timestamp: Date.now() };
      return data;
    })
    .finally(() => {
      priceFetchPromise = null;
    });

  return priceFetchPromise;
}

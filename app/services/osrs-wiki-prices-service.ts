import { untradeableItems } from '~/utils/untradable-items';
import { toTitleCase } from '~/utils/string-helpers';

export interface OSRSItem {
  id: number;
  name: string;
  icon: string;
  price?: number; // GE price for tradeable items
}

export interface PricesResponseData {
  data: {
    [itemId: string]: {
      high: number | null;
      highTime: number | null;
      low: number | null;
      lowTime: number | null;
    };
  };
}

// Item cache for OSRS item details
const itemCache: {
  [itemId: number]: {
    data: OSRSItem | null;
    timestamp: number;
  };
} = {};

// Price cache
let priceCache: {
  data: PricesResponseData | null;
  timestamp: number;
} = {
  data: null,
  timestamp: 0,
};

// Cache durations
const ITEM_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const PRICE_CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

/**
 * Helper function to format item name for Wiki URL
 * Only capitalizes the first letter of the first word
 * Example: "araxyte fang" -> "Araxyte_fang"
 */
function formatItemNameForWiki(name: string): string {
  const words = name.split(' ');
  return words
    .map((word, index) => {
      if (index === 0) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }
      return word;
    })
    .join('_');
}

/**
 * Fetches item details with name and Wiki image URL
 */
export async function fetchOSRSItem(itemId: number): Promise<OSRSItem | null> {
  const now = Date.now();

  // Check cache
  if (
    itemCache[itemId] &&
    now - itemCache[itemId].timestamp < ITEM_CACHE_DURATION
  ) {
    return itemCache[itemId].data;
  }

  // Untradeable items - use local mapping
  if (untradeableItems[itemId]) {
    const itemName = untradeableItems[itemId];
    const iconUrl =
      itemId === 0
        ? '/sanguine_icon.png' // Special case: pet
        : `https://oldschool.runescape.wiki/images/${formatItemNameForWiki(itemName)}_detail.png`;

    const itemData: OSRSItem = {
      id: itemId,
      name: toTitleCase(itemName),
      icon: iconUrl,
    };

    itemCache[itemId] = {
      data: itemData,
      timestamp: now,
    };

    return itemData;
  }

  // Tradeable items - fetch name and price from GE API, use Wiki for image
  try {
    const [itemResponse, pricesData] = await Promise.all([
      fetch(
        `https://secure.runescape.com/m=itemdb_oldschool/api/catalogue/detail.json?item=${itemId}`,
        {
          headers: {
            'User-Agent':
              'sanguine-osrs.com - Clan Website (sanguine.pvm@gmail.com)',
          },
        },
      ),
      fetchAllPrices(),
    ]);

    if (!itemResponse.ok) {
      itemCache[itemId] = { data: null, timestamp: now };
      return null;
    }

    const text = await itemResponse.text();
    if (!text || text.trim() === '') {
      itemCache[itemId] = { data: null, timestamp: now };
      return null;
    }

    const data = JSON.parse(text);
    if (!data?.item?.name) {
      itemCache[itemId] = { data: null, timestamp: now };
      return null;
    }

    const itemName = data.item.name;
    const priceInfo = pricesData.data[itemId];
    const currentPrice = priceInfo?.high || priceInfo?.low || undefined;

    const itemData: OSRSItem = {
      id: itemId,
      name: toTitleCase(itemName),
      icon: `https://oldschool.runescape.wiki/images/${formatItemNameForWiki(itemName)}_detail.png`,
      price: currentPrice,
    };

    itemCache[itemId] = {
      data: itemData,
      timestamp: now,
    };

    return itemData;
  } catch (error) {
    console.error('Error fetching item:', error);
    itemCache[itemId] = { data: null, timestamp: now };
    return null;
  }
}

/**
 * Fetches all item prices from the OSRS Wiki API with caching
 */
export async function fetchAllPrices(): Promise<PricesResponseData> {
  const now = Date.now();

  if (priceCache.data && now - priceCache.timestamp < PRICE_CACHE_DURATION) {
    console.log('Using cached price data');
    return priceCache.data;
  }

  console.log('Fetching fresh price data from API');
  const response = await fetch('https://prices.runescape.wiki/api/v1/osrs/latest', {
    headers: {
      'User-Agent': 'sanguine-osrs.com - Clan Website (sanguine.pvm@gmail.com)',
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch data: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();
  priceCache = { data, timestamp: now };

  return data;
}

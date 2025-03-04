// osrs-wiki-prices-service.ts
interface IWikiPriceItem {
  id: number;
  high: number | null;
  highTime: number | null;
  low: number | null;
  lowTime: number | null;
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

// Simple in-memory cache
let priceCache: {
  data: PricesResponseData | null;
  timestamp: number;
} = {
  data: null,
  timestamp: 0,
};

// Cache duration in milliseconds (e.g., 15 minutes)
const CACHE_DURATION = 15 * 60 * 1000;

/**
 * Fetches all item prices from the OSRS Wiki API with caching
 */
export const fetchAllPrices = async (): Promise<PricesResponseData> => {
  const now = Date.now();

  // Check if we have a valid cache
  if (priceCache.data && now - priceCache.timestamp < CACHE_DURATION) {
    console.log('Using cached price data');
    return priceCache.data;
  }

  console.log('Fetching fresh price data from API');
  const baseUrl = 'https://prices.runescape.wiki/api/v1/osrs';
  const endpoint = `/latest`;

  const response = await fetch(`${baseUrl}${endpoint}`, {
    headers: {
      'User-Agent': 'Your Application Name - Contact Info', // Good practice to identify your app to the API
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch data: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();

  // Update the cache
  priceCache = {
    data,
    timestamp: now,
  };

  return data;
};

/**
 * A version that uses Remix's Response caching mechanism
 * Use this if you need to use Remix's caching headers
 */
export const getItemPriceByIdWithResponseHeaders = async (
  itemId: number,
  prices: PricesResponseData,
): Promise<Response> => {
  try {
    const itemData = prices.data[itemId];

    if (!itemData) {
      throw new Error(`Price data for item with ID ${itemId} not found`);
    }

    const result: IWikiPriceItem = {
      id: itemId,
      high: itemData.high,
      highTime: itemData.highTime,
      low: itemData.low,
      lowTime: itemData.lowTime,
    };

    // Return a Response object with cache headers
    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `max-age=${CACHE_DURATION / 1000}`,
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};

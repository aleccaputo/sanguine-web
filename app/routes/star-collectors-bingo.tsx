import { MetaFunction } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import {
  getStarCollectorsStats,
  StarCollector,
} from '~/services/star-bingo-service.server';
import {
  fetchAllPrices,
  getItemPriceByIdWithResponseHeaders,
  PricesResponseData,
} from '~/services/osrs-wiki-prices-service';
import { useMemo, useState } from 'react';
import {
  createColumnHelper,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
} from '@tanstack/table-core';
import { flexRender, useReactTable } from '@tanstack/react-table';
import { Box, Text } from '@radix-ui/themes';
import { ExpandableCell } from '~/components/ExpandableCell';

export const meta: MetaFunction = () => {
  return [
    { title: 'Star Collectors Bingo 2025' },
    { name: 'description', content: 'A list of all drops and value' },
  ];
};

const parseItemIds = (itemIdsString: string): number[] =>
  itemIdsString.split(',').map(id => parseInt(id.trim(), 10));

async function fetchItemPrice(
  itemId: number,
  allItems: PricesResponseData,
): Promise<number> {
  try {
    const response = await getItemPriceByIdWithResponseHeaders(
      itemId,
      allItems,
    );

    if (!response.ok) {
      // console.error(`Error response for item ${itemId}: ${response.status}`);
      return 0;
    }

    const itemData = await response.json();
    // Use the high price if available, otherwise fall back to low price
    return itemData.high ?? itemData.low ?? 0;
  } catch (error) {
    console.error(`Error fetching price for item ${itemId}:`, error);
    return 0; // Return 0 if there's an error
  }
}

export async function loader() {
  const collectors = await getStarCollectorsStats();
  const allItems = await fetchAllPrices();

  const collectorPromises = collectors.map(async collector => {
    const itemIds = parseItemIds(collector.item_ids);
    const itemPrices = await Promise.all(
      itemIds.map(id => fetchItemPrice(id, allItems)),
    );
    const totalValue = itemPrices.reduce((sum, price) => sum + price, 0);
    return totalValue;
  });

  const collectorValues = await Promise.all(collectorPromises);

  // Create a lookup for collector values
  const collectorValueLookup: Record<string, number> = {};
  collectors.forEach((collector, index) => {
    collectorValueLookup[collector.nickname] = collectorValues[index];
  });

  // Return with cache headers using Response object directly
  return new Response(
    JSON.stringify({
      collectors,
      collectorValueLookup,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'max-age=900', // Cache for 15 minutes (900 seconds)
      },
    },
  );
}
export default function Index() {
  const { collectors, collectorValueLookup } = useLoaderData<{
    collectors: StarCollector[];
    collectorValueLookup: Record<string, number>;
  }>();

  const [sorting, setSorting] = useState<SortingState>([]);

  const columnHelper = createColumnHelper<StarCollector>();

  const columns = useMemo(
    () => [
      columnHelper.accessor('nickname', {
        header: 'Collector',
        cell: info => info.getValue(),
      }),
      columnHelper.accessor('total_submissions', {
        header: 'Total Submissions',
        cell: info => info.getValue(),
      }),
      columnHelper.accessor('unique_items', {
        header: 'Unique Items',
        cell: info => info.getValue(),
      }),
      columnHelper.accessor('items_submitted', {
        header: 'Items Submitted',
        cell: info => {
          const items = info.getValue();
          // Create a cell component with expandable content
          return <ExpandableCell content={items} />;
        },
      }),
      columnHelper.accessor(
        row => {
          const nickname = row.nickname;
          // Return the actual number value for sorting
          return collectorValueLookup[nickname] || 0;
        },
        {
          id: 'totalValue',
          header: 'Total Value (GP)',
          cell: info => {
            // For display, we use the formatted version
            const value = info.getValue();
            return (
              <Text className="text-sanguine-red group-hover:text-white">
                {value.toLocaleString()}
              </Text>
            );
          },
        },
      ),
    ],
    [columnHelper, collectorValueLookup],
  );

  const table = useReactTable({
    data: collectors,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <Box
      style={{ width: '100vw' }}
      className="mt-5 flex flex-col content-center items-center gap-5"
    >
      <Box>
        <Text size="9">Star Collectors Leaderboard</Text>
      </Box>
      <Box className="flex flex-row items-center gap-2">
        <Text size="5">Total Value Generated:</Text>
        <Text size="5" className="text-sanguine-red">
          {Object.values(collectorValueLookup)
            .reduce((sum, value) => sum + value, 0)
            .toLocaleString()}{' '}
          GP
        </Text>
      </Box>
      <Box className="overflow-x-auto" style={{ width: '80%' }}>
        <table className="min-w-full">
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    className="cursor-pointer border-b border-gray-300 px-4 py-2 text-left"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <Text size="3" weight="bold">
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                      {{
                        asc: ' 🔼',
                        desc: ' 🔽',
                      }[header.column.getIsSorted() as string] ?? null}
                    </Text>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => (
              <tr
                key={row.id}
                className="group hover:bg-sanguine-red hover:text-white"
              >
                {row.getVisibleCells().map(cell => (
                  <td
                    key={cell.id}
                    className="border-b border-gray-300 px-4 py-2"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Box>
    </Box>
  );
}

import { Flex, Text } from '@radix-ui/themes';

type PaginationProps = {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
};

const pageButtonClass =
  'rounded-sm border border-gray-800 bg-gray-900 px-3 py-1 text-sm text-gray-300 enabled:hover:border-gray-600 enabled:hover:text-white disabled:opacity-40';

export function Pagination({
  page,
  totalPages,
  onPrev,
  onNext,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <Flex justify="between" align="center" mt="4">
      <button
        onClick={onPrev}
        disabled={page === 1}
        className={pageButtonClass}
      >
        Previous
      </button>
      <Text size="2" className="text-gray-500">
        Page {page} of {totalPages}
      </Text>
      <button
        onClick={onNext}
        disabled={page === totalPages}
        className={pageButtonClass}
      >
        Next
      </button>
    </Flex>
  );
}

import { Button, Flex, Text } from '@radix-ui/themes';

type PaginationProps = {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
};

export function Pagination({ page, totalPages, onPrev, onNext }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <Flex justify="between" align="center" mt="4">
      <Button onClick={onPrev} disabled={page === 1} variant="soft">
        Previous
      </Button>
      <Text size="2" className="text-gray-400">
        Page {page} of {totalPages}
      </Text>
      <Button onClick={onNext} disabled={page === totalPages} variant="soft">
        Next
      </Button>
    </Flex>
  );
}

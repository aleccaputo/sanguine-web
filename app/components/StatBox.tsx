import { Box, Text } from '@radix-ui/themes';

interface StatBoxProps {
  label: string;
  value: string | number;
  valueClassName?: string;
}

export function StatBox({
  label,
  value,
  valueClassName = 'text-white font-medium',
}: StatBoxProps) {
  return (
    <Box>
      <Text size="2" className="mb-1 block text-gray-400">
        {label}
      </Text>
      <Text size="4" className={`block ${valueClassName}`}>
        {value}
      </Text>
    </Box>
  );
}

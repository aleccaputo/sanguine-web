import { Text } from '@radix-ui/themes';

interface EventStatusBadgeProps {
  status: string;
  color: string;
}

export function EventStatusBadge({ status, color }: EventStatusBadgeProps) {
  return (
    <Text size="4" className={`${color} block font-medium`}>
      {status}
    </Text>
  );
}

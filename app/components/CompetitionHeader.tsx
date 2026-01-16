import {
  Avatar,
  Box,
  Flex,
  Heading,
  IconButton,
  Text,
} from '@radix-ui/themes';
import { ArrowLeftIcon } from '@radix-ui/react-icons';
import { useNavigate } from '@remix-run/react';
import { getCompetitionImageUrl } from '~/utils/competition-images';
import { StatBox } from './StatBox';
import { EventStatusBadge } from './EventStatusBadge';

interface Competition {
  id: number;
  title: string;
  metric: string;
  startsAt: string;
  endsAt: string;
}

interface EventStatus {
  status: string;
  color: string;
}

interface CompetitionHeaderProps {
  competition: Competition;
  eventStatus: EventStatus;
  participantCount: number;
  formatDate: (date: string) => string;
  showBackButton?: boolean;
  backButtonText?: string;
  backButtonPath?: string;
  navigationSlot?: React.ReactNode;
}

export function CompetitionHeader({
  competition,
  eventStatus,
  participantCount,
  formatDate,
  showBackButton = true,
  backButtonText = 'Back to Events',
  backButtonPath = '/events',
  navigationSlot,
}: CompetitionHeaderProps) {
  const navigate = useNavigate();

  return (
    <Box>
      {showBackButton && (
        <Flex align="center" gap="3" mb="6">
          <IconButton
            variant="ghost"
            color="gray"
            onClick={() => navigate(backButtonPath)}
          >
            <ArrowLeftIcon width="16" height="16" />
          </IconButton>
          <Text size="2" className="text-gray-400">
            {backButtonText}
          </Text>
        </Flex>
      )}

      <Flex gap="4" align="start" className="sm:flex-row">
        <Avatar
          size="7"
          src={getCompetitionImageUrl(competition.metric)}
          radius="full"
          fallback="S"
        />

        <Box className="flex-1">
          <Flex justify="between" align="start" mb="3" className="flex-col gap-3 sm:flex-row sm:items-center sm:gap-0">
            <Heading size="6" className="text-sanguine-red sm:text-4xl">
              {competition.title}
            </Heading>
            {navigationSlot && <Box>{navigationSlot}</Box>}
          </Flex>
          <Box className="mb-6 h-1 w-32 bg-sanguine-red"></Box>

          <Flex gap="4" wrap="wrap" className="sm:gap-8">
            <Box>
              <Text size="2" className="mb-1 block text-gray-400">
                Status
              </Text>
              <EventStatusBadge
                status={eventStatus.status}
                color={eventStatus.color}
              />
            </Box>
            <StatBox label="Started" value={formatDate(competition.startsAt)} />
            <StatBox label="Ends" value={formatDate(competition.endsAt)} />
            <StatBox
              label="Participants"
              value={participantCount}
              valueClassName="text-sanguine-red font-bold"
            />
          </Flex>
        </Box>
      </Flex>
    </Box>
  );
}

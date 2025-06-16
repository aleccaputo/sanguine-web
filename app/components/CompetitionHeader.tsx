import {
  Avatar,
  Box,
  Flex,
  Heading,
  IconButton,
  Text,
  Button,
} from '@radix-ui/themes';
import { ArrowLeftIcon, ExternalLinkIcon } from '@radix-ui/react-icons';
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
}

export function CompetitionHeader({
  competition,
  eventStatus,
  participantCount,
  formatDate,
  showBackButton = true,
  backButtonText = 'Back to Events',
  backButtonPath = '/events',
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

      <Flex gap="6" align="start">
        <Avatar
          size="7"
          src={getCompetitionImageUrl(competition.metric)}
          radius="full"
          fallback="S"
        />

        <Box className="flex-1">
          <Flex justify="between" align="start" mb="3">
            <Heading size="8" className="text-sanguine-red">
              {competition.title}
            </Heading>
            <a
              href={`https://wiseoldman.net/competitions/${competition.id}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                size="2"
                color="gray"
                className="border-none bg-[rgb(37,99,235)] text-white transition-colors hover:cursor-pointer hover:bg-blue-700"
              >
                View on WoM
                <ExternalLinkIcon width="14" height="14" className="ml-1" />
              </Button>
            </a>
          </Flex>
          <Box className="mb-6 h-1 w-32 bg-sanguine-red"></Box>

          <Flex gap="8" wrap="wrap">
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

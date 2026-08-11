import type {
  IGuildMember,
  IGuildTextChannel,
} from '../services/discord-admin-service.server';

export const getGuildMember = async (): Promise<IGuildMember | null> => ({
  roles: ['mock-admin-role'],
  nick: 'MockAdmin',
});

export const getGuildTextChannels = async (): Promise<IGuildTextChannel[]> => [
  { id: '200000000000000001', name: 'event-announcements' },
  { id: '200000000000000002', name: 'event-approvals' },
  { id: '200000000000000003', name: 'general' },
];

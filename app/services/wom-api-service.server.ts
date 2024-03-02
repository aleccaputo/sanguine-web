import { WOMClient } from '@wise-old-man/utils';
import { remember } from '@epic-web/remember';
import * as process from 'process';
import chalk from 'chalk';

const groupId = parseInt(process.env.WOM_GROUP_ID!, 10);
const verificationCode = process.env.WOM_VERIFICATION_CODE!;

const client = remember('wom', () => {
	return new WOMClient({
		apiKey: process.env.WOM_API_KEY,
	});
});

// limit actually doesn't work for this endpoint. This is apparently by design
export const getCompetitions = async (limit?: number) => {
	try {
		const compettions = await client.groups.getGroupCompetitions(groupId, {
			limit: limit,
		});
		return compettions;
	} catch (e) {
		chalk['red'](e);
	}
};

export const getCompetitionById = async (id: number) => {
	const competition = await client.competitions.getCompetitionDetails(id);
	return competition;
};

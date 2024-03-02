import { json, LoaderFunctionArgs } from '@remix-run/node';
import { getCompetitionById } from '~/services/wom-api-service.server';
import { useLoaderData } from '@remix-run/react';
import { Response } from '@remix-run/web-fetch';
import { getUsersWithNicknames } from '~/services/sanguine-service.server';
import { getAuditDataForDateRange } from '~/data/points-audit';
import dayjs from 'dayjs';
import {
	CartesianGrid,
	Label,
	Legend,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from 'recharts';
import { Text } from '@radix-ui/themes';

export async function loader({ params }: LoaderFunctionArgs) {
	if (!params.id) {
		throw new Response('', { status: 404 });
	}
	const womComp = await getCompetitionById(parseInt(params.id, 10));
	const sanguineUsersPromise = getUsersWithNicknames();
	const pointAuditPromise = getAuditDataForDateRange(
		womComp.startsAt.toISOString(),
		womComp.endsAt.toISOString(),
	);

	const [sanguineUsers, pointAudit] = await Promise.all([
		sanguineUsersPromise,
		pointAuditPromise,
	]);

	return json(
		{
			auditData: pointAudit,
			sanguineUsers: sanguineUsers,
			compDetails: womComp,
		},
		200,
	);
}
const EventById = () => {
	const data = useLoaderData<typeof loader>();
	const startDate = dayjs(data.compDetails.startsAt);
	const endDate = dayjs(data.compDetails.endsAt);
	const days = endDate.diff(startDate, 'days');
	const uniqueUsersForTimePeriod = [
		...new Set(
			[...Array(days).keys()]
				.map((_, idx) => {
					const date = startDate.add(idx, 'days').format('DD/MM/YYYY');
					return data.auditData.filter(
						audit => dayjs(audit.createdAt).format('DD/MM/YYYY') === date,
					);
				})
				.flat()
				.map(
					x =>
						data.sanguineUsers.find(
							y =>
								y.discordId === x.destinationDiscordId &&
								data.compDetails.participations.some(
									z =>
										z.player.displayName.toLowerCase().trim() ==
										y.nickname?.toLowerCase().trim(),
								),
						)?.nickname,
				)
				.filter(realUser => realUser),
		),
	];
	const uniqueUsersDiscordIdsForTimePeriod = [
		...new Set(
			[...Array(days).keys()]
				.map((_, idx) => {
					const date = startDate.add(idx, 'days').format('DD/MM/YYYY');
					return data.auditData.filter(
						audit => dayjs(audit.createdAt).format('DD/MM/YYYY') === date,
					);
				})
				.flat()
				.map(
					x =>
						data.sanguineUsers.find(
							y =>
								y.discordId === x.destinationDiscordId &&
								data.compDetails.participations.some(
									z =>
										z.player.displayName.toLowerCase().trim() ==
										y.nickname?.toLowerCase().trim(),
								),
						)?.discordId,
				)
				.filter(realUser => realUser),
		),
	];

	const allUsersForTimePeriod = uniqueUsersForTimePeriod.reduce((acc, cur) => {
		return {
			...acc,
			[cur as string]: 0,
		};
	}, {});

	const allDiscordIdsForTimePeriod = uniqueUsersDiscordIdsForTimePeriod.reduce(
		(acc, cur) => {
			return {
				...acc,
				[cur as string]: 0,
			};
		},
		{},
	);

	const initialRecord = {
		...allUsersForTimePeriod,
		name: startDate.subtract(1, 'days').format('DD/MM/YYYY'),
	};

	console.log(uniqueUsersForTimePeriod);
	const graphData = Array.from({ length: days }, () => ({
		...allUsersForTimePeriod,
	})).map((allUserInstance, idx) => {
		const date = startDate.add(idx, 'days').format('DD/MM/YYYY');
		const usersForDate = data.auditData
			.filter(audit => dayjs(audit.createdAt).format('DD/MM/YYYY') === date)
			.reduce(
				(acc, record) => {
					return {
						...acc,
						[record.destinationDiscordId]:
							(acc[record.destinationDiscordId] ?? 0) + record.pointsGiven,
					};
				},
				{} as { [discordId: string]: number },
			);
		return {
			name: startDate.add(idx, 'days').toString(),
			...allDiscordIdsForTimePeriod,
			...usersForDate,
		};
	});

	type KeyMap = { [oldKey: string]: string };

	const keyMap: KeyMap = graphData.reduce<KeyMap>((map, obj) => {
		return Object.keys(obj).reduce<KeyMap>((innerMap, key) => {
			const nickname = data.sanguineUsers.find(
				x => x.discordId === key,
			)?.nickname;
			if (key !== 'name' && !innerMap[key] && nickname) {
				return {
					...innerMap,
					[key]: nickname,
				};
			}
			return innerMap;
		}, map);
	}, {});

	interface DataObject {
		[key: string]: number | string;
	}
	function remapKeys(
		object: DataObject,
		keyMap: { [oldKey: string]: string },
	): DataObject {
		return Object.entries(object).reduce((newObject, [oldKey, value]) => {
			if (oldKey === 'name') {
				return { ...newObject, [oldKey]: value };
			}
			const newKey = keyMap[oldKey];
			return { ...newObject, [newKey]: value };
		}, {} as DataObject);
	}

	interface IFoo {
		name: string;
		[key: string]: number | string;
	}
	function accumulateValues(data: IFoo[]): DataObject[] {
		const accumulatedData: DataObject[] = [];

		data.forEach((day, index) => {
			const accumulatedDay: DataObject = { name: day.name };

			Object.keys(day).forEach(key => {
				if (key !== 'name') {
					let accumulatedValue = day[key] as number;
					for (let i = 0; i < index; i++) {
						const prevDay = data[i];
						if (prevDay[key] !== undefined) {
							accumulatedValue += prevDay[key] as number;
						}
					}
					accumulatedDay[key] = accumulatedValue;
				}
			});

			accumulatedData.push(accumulatedDay);
		});

		return accumulatedData;
	}

	const remappedData = graphData.map(obj => remapKeys(obj, keyMap)).flat();
	const foo = accumulateValues(remappedData as IFoo[]);

	const actuallyAllTheData = [initialRecord, ...foo];

	return (
		<div
			style={{ width: '100vw', height: '100vh' }}
			className={'mt-5 flex flex-col items-center gap-5'}
		>
			<Text>{`${data.compDetails.title} Points Earned`}</Text>
			<ResponsiveContainer width="80%" height="80%">
				<LineChart
					width={2000}
					height={1000}
					data={actuallyAllTheData}
					margin={{
						top: 5,
						right: 30,
						left: 20,
						bottom: 5,
					}}
				>
					<CartesianGrid strokeDasharray="3 3" />
					<XAxis dataKey="name" />
					<YAxis />
					<Legend />
					<Tooltip
						contentStyle={{ background: 'color(display-p3 0.067 0.067 0.074)' }}
					/>
					{uniqueUsersForTimePeriod.map((username, index) => (
						<Line
							connectNulls={true}
							key={index}
							type="monotone"
							dataKey={username}
							stroke={`#${Math.floor(Math.random() * 16777215).toString(16)}`} // Random color
						/>
					))}
				</LineChart>
			</ResponsiveContainer>
		</div>
	);
};

export default EventById;

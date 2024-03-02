import { json, LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { getUserById } from '~/data/user';
import { getNicknameById } from '~/data/nicknames';
import { Avatar, Box, Card, Flex, Text } from '@radix-ui/themes';

export const meta: MetaFunction = () => {
	return [
		{ title: 'New Remix App' },
		{ name: 'description', content: 'Welcome to Remix!' },
	];
};

export async function loader({ params }: LoaderFunctionArgs) {
	const user = await getUserById(params.id ?? '');
	const nicknameResponse = await getNicknameById(params.id ?? '');
	return json(
		{
			user: user,
			nickname: nicknameResponse?.nickname.split('[')[0],
		},
		200,
	);
}

export default function Index() {
	const data = useLoaderData<typeof loader>();

	return (
		<Card style={{ maxWidth: 250 }}>
			<Flex gap={'3'} align={'center'}>
				<Avatar fallback={'P'} radius={'full'} size={'3'} />
				<Box>
					<Text as={'div'} size={'2'} weight={'bold'}>
						{data.nickname}
					</Text>
					<Text as="div" size="2" color="gray">
						{data?.user?.points ?? 0} points
					</Text>
				</Box>
			</Flex>
		</Card>
	);
}

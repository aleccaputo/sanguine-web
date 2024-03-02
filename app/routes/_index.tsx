import { MetaFunction } from '@remix-run/node';
import { Outlet } from '@remix-run/react';

export const meta: MetaFunction = () => {
	return [
		{ title: 'New Remix App' },
		{ name: 'description', content: 'Welcome to Remix!' },
	];
};
export default function Index() {
	return (
		<div className="flex h-screen flex-row items-center justify-center">
			<Outlet />
		</div>
	);
}

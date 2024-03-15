import { MetaFunction } from '@remix-run/node';

export const meta: MetaFunction = () => {
  return [
    { title: 'Sanguine' },
    { name: 'description', content: 'Welcome to Sanguine!' },
  ];
};
export default function Index() {
  return (
    <div className="flex h-screen flex-col items-center">
      <p>{'Welcome to Sanguine'}</p>
      <p>{'This site is a work in progress'}</p>
      <p>{'Check out the Events tab!'}</p>
    </div>
  );
}

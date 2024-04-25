import { MetaFunction } from '@remix-run/node';

export const meta: MetaFunction = () => {
  return [
    { title: 'Sanguine' },
    { name: 'description', content: 'Welcome to Sanguine!' },
  ];
};
export default function Index() {
  return (
    <div className="mt-20 flex h-screen flex-col items-center">
      <h1 className={'text-5xl text-sanguine-red'}>Welcome to Sanguine</h1>
      <img
        src={'/SanguinePersonalBanner.png'}
        alt={'Sanguine-Banner'}
        className={'mt-20'}
      />
    </div>
  );
}

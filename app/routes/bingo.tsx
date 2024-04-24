import React from 'react';
import { MetaFunction } from '@remix-run/node';

export const meta: MetaFunction = () => {
  return [
    { title: 'Sanguine Bingo' },
    { name: 'description', content: 'Used to view and manage bingo' },
  ];
};

const BingoRoute = () => (
  <div className={'mt-2 flex h-screen flex-row items-start justify-center'}>
    <iframe
      height={'70%'}
      width={'80%'}
      src={'https://pattyrich.github.io/github-pages/#/bingo/join'}
      title={'Bingo'}
    ></iframe>
  </div>
);

export default BingoRoute;

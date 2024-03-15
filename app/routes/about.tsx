import React from 'react';
import { MetaFunction } from '@remix-run/node';

export const meta: MetaFunction = () => {
  return [
    { title: 'About Sanguine' },
    { name: 'description', content: 'Welcome to Sanguine!' },
  ];
};

const AboutRoute = () => (
  <React.Fragment>
    <div className={'flex flex-col gap-5'}>
      <div className={'flex flex-col items-center'}>
        <p>{'We are a PvM/Social OSRS Clan'}</p>
        <p>{'We Offer:'}</p>
        <ul>
          <li>{'ToB'}</li>
          <li>{'CoX'}</li>
          <li>{'ToA'}</li>
          <li>{'Weekly Boss of the Week and Skill of the Week'}</li>
          <li>{'Bingo, inter and intra clan events'}</li>
        </ul>
      </div>
    </div>
    <div className={'mt-5 flex flex-col items-center'}>
      <a href={'https://discord.gg/ecBRCQPA'}>
        <img
          src={'https://invidget.switchblade.xyz/6rcJfHCNE4'}
          alt={'discord-invite'}
        />
      </a>
    </div>
  </React.Fragment>
);
export default AboutRoute;

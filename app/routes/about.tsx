import * as React from 'react';
import { MetaFunction } from '@remix-run/node';

export const meta: MetaFunction = () => {
  return [
    { title: 'About Sanguine' },
    { name: 'description', content: 'Welcome to Sanguine!' },
  ];
};

const AboutRoute = () => (
  <React.Fragment>
    <div className={'m-5 flex flex-col gap-5'}>
      <div className={'flex flex-col items-center'}>
        <p className={'text-5xl text-sanguine-red'}>
          {'We are a PvM/Social OSRS Clan'}
        </p>
        <p className={'text-3xl text-sanguine-red'}>{'We Offer:'}</p>
        <ul>
          <li className={'text-sanguine-red'}>{'Theatre of Blood'}</li>
          <li className={'text-sanguine-red'}>{'Chambers of Xeric'}</li>
          <li className={'text-sanguine-red'}>{'Tombs of Amascut'}</li>
          <li className={'text-sanguine-red'}>
            {'Weekly Boss of the Week and Skill of the Week'}
          </li>
          <li className={'text-sanguine-red'}>
            {'Bingo, inter and intra clan events'}
          </li>
        </ul>
      </div>
    </div>
    <div className={'mt-5 flex flex-col items-center'}>
      <a href={'https://discord.gg/sanguine'}>
        <img
          src={'https://invidget.switchblade.xyz/sanguine'}
          alt={'discord-invite'}
        />
      </a>
    </div>
  </React.Fragment>
);
export default AboutRoute;

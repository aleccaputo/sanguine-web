import { MetaFunction } from '@remix-run/node';
import { Text } from '@radix-ui/themes';
import { Link } from '@remix-run/react';

export const meta: MetaFunction = () => {
  return [
    { title: 'Sanguine Bingo' },
    { name: 'description', content: 'Used to view and manage bingo' },
  ];
};

const BingoRoute = () => (
  <div>
    <div className={'flex items-center justify-center'}>
      <Link to={'#rules'} className={'mt-2 hover:underline md:text-5xl'}>
        {'Click here for the rules and FAQs'}
      </Link>
    </div>
    <div className={'mt-2 flex h-screen flex-row items-start justify-center'}>
      <iframe
        className={'h-full w-full md:h-5/6 md:w-11/12'}
        src={'https://pattyrich.github.io/github-pages/#/bingo/join'}
        title={'Bingo'}
      ></iframe>
    </div>
    <div className={'m-3 md:m-10'}>
      <h1 id={'rules'}>Bingo Rules</h1>
      <Text className={'font-bold text-sanguine-red underline'}>General:</Text>
      <ul className={'list-inside list-disc md:indent-5'}>
        <li>
          If you are planning to utilize multiple accounts (an iron and a main)
          for different tiles, you MUST disclose this ahead of the competition
          start date and abide by the following:
        </li>
        <li>There is absolutely no boosting allowed</li>
        <li>
          You CANNOT be working on multiple tiles at the same time or the same
          time on multiple accounts - i.e. you can only be actively playing on
          one account at a time
        </li>
        <li>You MAY use an alt as a wilderness scout</li>
        <li>
          You must use the Wise Old Man plugin on any/all accounts played, and
          ensure that you have the proper codeword (to be released just prior to
          the start of bingo), and timestamp enabled within the runelite plugin
          This codeword and timestamp MUST be included in screenshot submissions
          in order to get credit for a drop
        </li>
        <li>Absolutely NO stacking clue reward caskets ahead of time</li>
        <li>
          You MAY have clues in your bank and complete them upon the start of
          bingo
        </li>

        <li>
          You CANNOT stack rewards permits or crates from Wintertodt & Tempoross
          ahead of time
        </li>

        <li>
          You MAY go for particular slayer tasks ahead of time and have them
          stored for the onset of bingo (i.e. it is okay to actively hunt a
          revenant task and wait to start that once bingo starts)
        </li>
        <li>
          Single drops can be used to satisfy multiple tiles (i.e. the Dragon
          pickaxe from KQ can also be used as the dragon component of the
          Crystal tool, or the pet from Nex will also count for the PvM pet)
        </li>
      </ul>
      <h3>Tile Specific:</h3>

      <Text className={'font-bold text-sanguine-red underline'}>
        DT2 Unique:
      </Text>
      <ul className={'list-inside list-disc indent-5'}>
        <li>Any Virtus piece, Axe piece, or Vestige WILL count</li>
        <li>Ingots, quartz’s, teleports WILL NOT count</li>
      </ul>

      <Text className={'font-bold text-sanguine-red underline'}>
        5 Slayer Boss Uniques:
      </Text>
      <ul className={'list-inside list-disc indent-5'}>
        <li>
          These drops MUST be obtained from the boss itself (i.e. an occult will
          not count from normal smoke devils, but will count from Thermy)
        </li>
      </ul>

      <Text className={'font-bold text-sanguine-red underline'}>
        Full God D’hide:
      </Text>
      <ul className={'list-inside list-disc indent-5'}>
        <li>This includes coif, body, legs, boots, vambraces</li>
        <li>This DOES NOT include the shield</li>
        <li>
          These can be obtained and mixed from any god (i.e. Bandos chaps and
          Guthix body will both count towards the full set)
        </li>
      </ul>

      <Text className={'font-bold text-sanguine-red underline'}>
        Ornament Kit:
      </Text>
      <ul className={'list-inside list-disc indent-5'}>
        <li>This can be obtained from any tier clue scroll</li>
      </ul>

      <Text className={'font-bold text-sanguine-red underline'}>
        Perilous Moons Set:
      </Text>
      <ul className={'list-inside list-disc indent-5'}>
        <li>
          This MUST be all from one set (i.e. you must complete a full blood
          moon set, inclusive of weapon, you CANNOT get the body from blue moon
          and the legs from blood moon)
        </li>
      </ul>

      <Text className={'font-bold text-sanguine-red underline'}>
        Nex Unique:
      </Text>
      <ul className={'list-inside list-disc indent-5'}>
        <li>Includes Pet</li>
        <li>Excludes Nihil Shards</li>
      </ul>

      <Text className={'font-bold text-sanguine-red underline'}>
        Full Armadyl or Bandos:
      </Text>
      <ul className={'list-inside list-disc indent-5'}>
        <li>
          This MUST be from one boss (i.e. you cannot get Arma Chestplate and
          Bandos Tassets and boots)
        </li>
      </ul>

      <Text className={'font-bold text-sanguine-red underline'}>25M PK:</Text>
      <ul className={'list-inside list-disc indent-5'}>
        <li>This must be done in the wilderness, i.e. no Bounty Hunter</li>
        <li>
          Absolutely no PKing alts/friends/clanmates to satisfy this tile (must
          be a real PK)
        </li>
        <li>
          This DOES NOT need to be singles, 1v1 pking - multi-pking with the
          clan is 100% acceptable and encouraged
        </li>
      </ul>
      <Text className={'font-bold text-sanguine-red underline'}>
        1M Budget Raid:
      </Text>
      <ul className={'list-inside list-disc indent-5'}>
        <li>
          Pictures MUST be taken before and after the raid of your gear and
          inventory, use the party hub plugin and have this included in your
          screenshots as this captures your teams gear/inventory as well
        </li>
        <li>
          You CAN use untradables. But if something has a hidden value (ex:
          crystal hally = crystal weapon seed) you have to include this in your
          budget.
        </li>
      </ul>
      <Text className={'font-bold text-sanguine-red underline'}>
        Complete Barrows Set:
      </Text>
      <ul className={'list-inside list-disc indent-5'}>
        <li>
          This MUST be all from one set (i.e. full Guthans, or Full Dharok’s, no
          mixing sets)
        </li>
      </ul>

      <Text className={'font-bold text-sanguine-red underline'}>
        Any Colosseum Unique:
      </Text>
      <ul className={'list-inside list-disc indent-5'}>
        <li>This DOES NOT include Quiver or Sunfire Splinters</li>
      </ul>

      <Text className={'font-bold text-sanguine-red underline'}>Any Jar:</Text>
      <ul className={'list-inside list-disc indent-5'}>
        <li>Any Jar from any content, inclusive of Skotizo</li>
        <li>Stacked totems CAN be used for this tile</li>
      </ul>

      <Text className={'font-bold text-sanguine-red underline'}>
        Nightmare Unique:
      </Text>
      <ul className={'list-inside list-disc indent-5'}>
        <li>DOES NOT include Parasitic egg or Tablet</li>
      </ul>
    </div>
  </div>
);

export default BingoRoute;

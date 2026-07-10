import { useLocation } from 'react-router';
import { Link } from '@remix-run/react';
import { useEffect, useState } from 'react';
import * as NavigationMenu from '@radix-ui/react-navigation-menu';

type SubLink = { to: string; label: string };

const eventsLinks: SubLink[] = [
  { to: '/events', label: 'Events' },
  { to: '/bingo', label: 'Bingo' },
  { to: '/monthly-winners', label: 'Monthly Winners' },
];

const dropsLinks: SubLink[] = [
  { to: '/drops', label: 'Drops' },
  { to: '/drop-stats', label: 'Drop Stats' },
];

const topLinks = [
  { to: '/', label: 'Home', match: (p: string) => p === '/' },
  { to: '/about', label: 'About', match: (p: string) => p === '/about' },
  {
    to: '/users',
    label: 'Members',
    match: (p: string) => p.startsWith('/users'),
  },
  {
    to: '/personal-bests',
    label: 'PBs',
    match: (p: string) => p.startsWith('/personal-bests'),
  },
];

const topLinkClass = (active: boolean) =>
  `block rounded px-3 py-2 md:hover:text-sanguine-red md:dark:hover:text-sanguine-red ${
    active ? 'text-sanguine-red' : 'text-gray-900 dark:text-white'
  } hover:bg-gray-100 md:border-0 md:p-0 md:hover:bg-transparent dark:hover:bg-gray-700 dark:hover:text-white md:dark:hover:bg-transparent`;

const DropdownNav = ({
  label,
  links,
  pathname,
}: {
  label: string;
  links: SubLink[];
  pathname: string;
}) => {
  const active = links.some(({ to }) => pathname.startsWith(to));
  return (
    <NavigationMenu.Item className="md:relative">
      <NavigationMenu.Trigger
        className={`${topLinkClass(active)} group flex w-full items-center justify-between md:w-auto md:gap-1`}
      >
        {label}
        <svg
          className="h-3 w-3 transition-transform duration-200 group-data-[state=open]:rotate-180"
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 10 6"
        >
          <path
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="m1 1 4 4 4-4"
          />
        </svg>
      </NavigationMenu.Trigger>
      <NavigationMenu.Content className="mt-1 md:absolute md:left-0 md:top-full md:mt-0 md:min-w-[12rem] md:pt-2">
        <ul className="m-0 list-none space-y-1 p-0 pl-3 md:space-y-0 md:rounded-lg md:border md:border-gray-100 md:bg-white md:p-2 md:pl-2 md:shadow-lg dark:md:border-gray-700 dark:md:bg-gray-900">
          {links.map(({ to, label: linkLabel }) => {
            const linkActive = pathname.startsWith(to);
            return (
              <li key={to}>
                <NavigationMenu.Link asChild active={linkActive}>
                  <Link
                    to={to}
                    className={`block rounded px-3 py-2 ${
                      linkActive
                        ? 'text-sanguine-red'
                        : 'text-gray-900 dark:text-white'
                    } hover:bg-gray-100 md:hover:text-sanguine-red dark:hover:bg-gray-700 md:dark:hover:text-sanguine-red`}
                  >
                    {linkLabel}
                  </Link>
                </NavigationMenu.Link>
              </li>
            );
          })}
        </ul>
      </NavigationMenu.Content>
    </NavigationMenu.Item>
  );
};

const Navbar = () => {
  const location = useLocation();
  const [hamburgerOpen, setHamburgerOpen] = useState(false);

  useEffect(() => {
    setHamburgerOpen(false);
  }, [location]);

  return (
    <nav className="fixed top-0 z-50 w-full border-gray-200 bg-white dark:bg-gray-900">
      <div className="mx-auto flex max-w-screen-xl flex-wrap items-center justify-between p-4">
        <a href="/" className="flex items-center space-x-3 rtl:space-x-reverse">
          <img
            src="/sanguine_icon_small.png"
            alt=""
            width={28}
            height={28}
            className="[image-rendering:pixelated]"
          />
          <span className="self-center whitespace-nowrap text-3xl dark:text-white">
            Sanguine
          </span>
        </a>
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg p-2 text-sm text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200 md:hidden dark:text-gray-400 dark:hover:bg-gray-700 dark:focus:ring-gray-600"
          aria-controls="navbar-default"
          aria-expanded={hamburgerOpen}
          onClick={() => setHamburgerOpen(!hamburgerOpen)}
        >
          <span className="sr-only">Open main menu</span>
          <svg
            className="h-5 w-5"
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 17 14"
          >
            <path
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M1 1h15M1 7h15M1 13h15"
            />
          </svg>
        </button>
        <div
          className={`${!hamburgerOpen ? 'hidden' : ''} w-full md:block md:w-auto`}
          id="navbar-default"
        >
          <NavigationMenu.Root
            delayDuration={100}
            className="mt-4 rounded-lg border border-gray-100 bg-gray-50 p-4 font-medium md:mt-0 md:border-0 md:bg-white md:p-0 dark:border-gray-700 dark:bg-gray-800 md:dark:bg-gray-900"
          >
            <NavigationMenu.List className="m-0 flex list-none flex-col p-0 md:flex-row md:space-x-8 rtl:space-x-reverse">
              {topLinks.map(({ to, label, match }) => {
                const active = match(location.pathname);
                return (
                  <NavigationMenu.Item key={to}>
                    <NavigationMenu.Link asChild active={active}>
                      <Link to={to} className={topLinkClass(active)}>
                        {label}
                      </Link>
                    </NavigationMenu.Link>
                  </NavigationMenu.Item>
                );
              })}
              <DropdownNav
                label="Drops"
                links={dropsLinks}
                pathname={location.pathname}
              />
              <DropdownNav
                label="Events"
                links={eventsLinks}
                pathname={location.pathname}
              />
            </NavigationMenu.List>
          </NavigationMenu.Root>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

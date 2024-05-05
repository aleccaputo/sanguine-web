import { Icon } from '~/components/icon';
import { useLocation } from 'react-router';
import { Link } from '@remix-run/react';
import { useEffect, useState } from 'react';

const Navbar = () => {
  const location = useLocation();
  const [hamburgerOpen, setHamburgerOpen] = useState(false);

  useEffect(() => {
    setHamburgerOpen(false);
  }, [location]);

  return (
    <nav className="border-gray-200 bg-white dark:bg-gray-900">
      <div className="mx-auto flex max-w-screen-xl flex-wrap items-center justify-between p-4">
        <a href="/" className="flex items-center space-x-3 rtl:space-x-reverse">
          <Icon name={'SanguineIcon'} size={'xl'} />
          <span className="self-center whitespace-nowrap text-3xl dark:text-white">
            Sanguine
          </span>
        </a>
        <button
          data-collapse-toggle="navbar-default"
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg p-2 text-sm text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200 md:hidden dark:text-gray-400 dark:hover:bg-gray-700 dark:focus:ring-gray-600"
          aria-controls="navbar-default"
          aria-expanded="false"
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
          className={`${!hamburgerOpen ? 'hidden' : null} w-full md:block md:w-auto`}
          id="navbar-default"
        >
          <ul
            className={
              'mt-4 flex flex-col rounded-lg border border-gray-100 bg-gray-50 p-4 font-medium md:mt-0 md:flex-row md:space-x-8 md:border-0 md:bg-white md:p-0 rtl:space-x-reverse dark:border-gray-700 dark:bg-gray-800 md:dark:bg-gray-900'
            }
          >
            <li>
              <Link
                to="/"
                className={`block rounded px-3 py-2 md:hover:text-sanguine-red md:dark:hover:text-sanguine-red ${location.pathname === '/' ? 'text-sanguine-red' : 'text-gray-900'} hover:bg-gray-100 md:border-0 md:p-0 md:hover:bg-transparent dark:${location.pathname === '/' ? 'text-sanguine-red' : 'text-white'} dark:hover:bg-gray-700 dark:hover:text-white md:dark:hover:bg-transparent`}
                aria-current="page"
              >
                Home
              </Link>
            </li>
            <li>
              <Link
                to="/about"
                className={`block rounded px-3 py-2 md:hover:text-sanguine-red md:dark:hover:text-sanguine-red ${location.pathname === '/about' ? 'text-sanguine-red' : 'text-gray-900'} hover:bg-gray-100 md:border-0 md:p-0 md:hover:bg-transparent dark:${location.pathname === '/about' ? 'text-sanguine-red' : 'text-white'} dark:hover:bg-gray-700 dark:hover:text-white md:dark:hover:bg-transparent`}
              >
                About
              </Link>
            </li>
            <li>
              <Link
                to="/users"
                className={`block rounded px-3 py-2 md:hover:text-sanguine-red md:dark:hover:text-sanguine-red ${location.pathname === '/users' ? 'text-sanguine-red' : 'text-gray-900'} hover:bg-gray-100 md:border-0 md:p-0 md:hover:bg-transparent dark:${location.pathname === '/users' ? 'text-sanguine-red' : 'text-white'} dark:hover:bg-gray-700 dark:hover:text-white md:dark:hover:bg-transparent`}
              >
                Members
              </Link>
            </li>
            <li>
              <Link
                to="/events"
                className={`block rounded px-3 py-2 md:hover:text-sanguine-red md:dark:hover:text-sanguine-red ${location.pathname === '/events' ? 'text-sanguine-red' : 'text-gray-900'} hover:bg-gray-100 md:border-0 md:p-0 md:hover:bg-transparent dark:${location.pathname === '/events' ? 'text-sanguine-red' : 'text-white'} dark:hover:bg-gray-700 dark:hover:text-white md:dark:hover:bg-transparent`}
              >
                Events
              </Link>
            </li>
            <li>
              <Link
                to="/bingo"
                className={`block rounded px-3 py-2 md:hover:text-sanguine-red md:dark:hover:text-sanguine-red ${location.pathname === '/bingo' ? 'text-sanguine-red' : 'text-gray-900'} hover:bg-gray-100 md:border-0 md:p-0 md:hover:bg-transparent dark:${location.pathname === '/bingo' ? 'text-sanguine-red' : 'text-white'} dark:hover:bg-gray-700 dark:hover:text-white md:dark:hover:bg-transparent`}
              >
                Bingo
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

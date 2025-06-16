import { captureRemixErrorBoundaryError } from '@sentry/remix';
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
} from '@remix-run/react';
import { Theme } from '@radix-ui/themes';
import tailwindStyleSheetUrl from './tailwind.css?url';
import { LinksFunction, MetaFunction } from '@remix-run/node';
import Navbar from '~/components/navbar';
import { LoadingBar } from '~/components/loading-bar';

export const links: LinksFunction = () => [
  { rel: 'stylesheet', href: tailwindStyleSheetUrl },
  { rel: 'icon', href: '/favicon.ico' },
];

export const meta: MetaFunction = () => [
  { title: 'Sanguine - OSRS Clan' },
  {
    name: 'description',
    content:
      'Old School RuneScape PvM clan. Active community with raids, bossing, and weekly events.',
  },

  // Open Graph tags for social media embeds
  { property: 'og:title', content: 'Sanguine - OSRS Clan' },
  {
    property: 'og:description',
    content:
      'Old School RuneScape PvM clan. Active community with raids, bossing, and weekly events.',
  },
  { property: 'og:type', content: 'website' },
  { property: 'og:image', content: '/favicon.ico' },
  { property: 'og:site_name', content: 'Sanguine' },

  // Twitter Card tags
  { name: 'twitter:card', content: 'summary' },
  { name: 'twitter:title', content: 'Sanguine - OSRS Clan' },
  {
    name: 'twitter:description',
    content: 'OSRS PvM clan with an active community',
  },
  { name: 'twitter:image', content: '/favicon.ico' },
];

export function Layout() {
  return (
    <html lang="en" style={{ height: '100%' }}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body style={{ minHeight: '100%' }}>
        <Theme appearance={'dark'}>
          <Navbar />
          <LoadingBar />
          <Outlet />
          <ScrollRestoration />
          <Scripts />
        </Theme>
      </body>
    </html>
  );
}

export const ErrorBoundary = () => {
  const error = useRouteError();
  captureRemixErrorBoundaryError(error);
  return <div>Something went wrong</div>;
};

export default function App() {
  return <Outlet />;
}

import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from '@remix-run/react';
import { Theme } from '@radix-ui/themes';
import '@radix-ui/themes/styles.css';
import tailwindStyleSheetUrl from './tailwind.css?url';
import { LinksFunction } from '@remix-run/node';
import Navbar from '~/components/navbar';
import { LoadingBar } from '~/components/loading-bar';

export const links: LinksFunction = () => [
  { rel: 'stylesheet', href: tailwindStyleSheetUrl },
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

export default function App() {
  return <Outlet />;
}

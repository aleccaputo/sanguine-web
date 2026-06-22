import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { vitePlugin as remix } from '@remix-run/dev';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mockMode = process.env.MOCK_MODE === '1';

const mockAlias = (from: string, to: string) => ({
  find: new RegExp(`^${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`),
  replacement: path.resolve(__dirname, to),
});

const mockAliases = mockMode
  ? [
      mockAlias(
        '~/services/wom-api-service.server',
        './app/mocks/wom-api-service.server.ts',
      ),
      mockAlias(
        '~/services/osrs-wiki-prices-service',
        './app/mocks/osrs-wiki-prices-service.ts',
      ),
      mockAlias('~/data/user', './app/mocks/user/index.ts'),
      mockAlias('~/data/nicknames', './app/mocks/nicknames/index.ts'),
      mockAlias('~/data/points-audit', './app/mocks/points-audit/index.ts'),
      mockAlias(
        '~/data/monthly-winners',
        './app/mocks/monthly-winners/index.ts',
      ),
    ]
  : [];

export default defineConfig(({ mode }) => ({
  plugins: [
    remix(),
    tsconfigPaths(),
    sentryVitePlugin({
      org: 'alec-caputo',
      project: 'sanguine-web',
      telemetry: mode !== 'development',
    }),
  ],

  resolve: {
    alias: mockAliases,
  },

  build: {
    sourcemap: true,
  },
}));

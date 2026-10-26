import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { useSyncExternalStore } from 'react';

dayjs.extend(utc);

export default dayjs;

type DayjsFactory = (date?: dayjs.ConfigType) => dayjs.Dayjs;

const subscribe = () => () => {};

// False during the server render and hydration, true from then on (and immediately
// for anything mounted after hydration, e.g. on client navigation). React's
// recommended two-pass render for content that must differ between server and client.
export const useHydrated = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

// Dates read in the viewer's own timezone, but the server only knows UTC: formatting
// locally during hydration renders a different day than the server HTML (a comp ending
// 03:59 UTC Nov 1 is Oct 31 in New York) and React throws a hydration error. So render
// UTC until hydrated, then switch to local time.
export const useLocalDayjs = (): DayjsFactory => {
  const hydrated = useHydrated();
  return hydrated ? dayjs : dayjs.utc;
};

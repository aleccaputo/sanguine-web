import { useLocalDayjs } from '~/utils/dayjs';

interface ILocalDateProps {
  date: string | Date;
  format: string;
}

// A date in the viewer's timezone that still hydrates cleanly (see useLocalDayjs).
export const LocalDate = ({ date, format }: ILocalDateProps) => {
  const day = useLocalDayjs();
  return <>{day(date).format(format)}</>;
};

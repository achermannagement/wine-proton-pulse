import { formatDateTime, formatRelativeTime } from '../lib/format';

export function TimeAgo({
  epoch,
  className = '',
}: {
  epoch: number | null | undefined;
  className?: string;
}) {
  if (!epoch) return <span className={className}>unknown</span>;
  return (
    <time
      dateTime={new Date(epoch * 1000).toISOString()}
      title={formatDateTime(epoch)}
      className={className}
    >
      {formatRelativeTime(epoch)}
    </time>
  );
}

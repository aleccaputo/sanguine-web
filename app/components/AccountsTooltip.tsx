import { HoverCard } from '@radix-ui/themes';
import { fetchRankImage } from '~/utils/clan-ranks';

interface IAccount {
  name: string;
  role?: string;
}

interface IAccountsTooltipProps {
  accounts: IAccount[];
  children: React.ReactNode;
}

export function AccountsTooltip({ accounts, children }: IAccountsTooltipProps) {
  return (
    <HoverCard.Root>
      <HoverCard.Trigger>
        <span className="cursor-default">{children}</span>
      </HoverCard.Trigger>
      <HoverCard.Content
        style={{
          backgroundColor: '#1F2937',
          border: '1px solid #374151',
          borderRadius: '8px',
          padding: '8px 12px',
          fontSize: '12px',
          color: '#F9FAFB',
          minWidth: '140px',
        }}
      >
        {accounts.map(account => (
          <div
            key={account.name}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '2px 0' }}
          >
            {account.role && (
              <img
                src={fetchRankImage(account.role)}
                alt={account.role}
                width={18}
                height={18}
                style={{ flexShrink: 0 }}
              />
            )}
            <span>{account.name}</span>
          </div>
        ))}
      </HoverCard.Content>
    </HoverCard.Root>
  );
}

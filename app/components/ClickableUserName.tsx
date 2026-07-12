import { Text } from '@radix-ui/themes';
import { useNavigate } from '@remix-run/react';

interface User {
  discordId: string;
  nickname: string;
}

interface ClickableUserNameProps {
  user: User;
  size?: '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
  className?: string;
}

export function ClickableUserName({
  user,
  size = '3',
  className = 'text-sanguine-bright',
}: ClickableUserNameProps) {
  const navigate = useNavigate();

  return (
    <Text
      size={size}
      className={`${className} cursor-pointer transition-colors hover:text-white`}
      onClick={() => navigate(`/users/${user.discordId}`)}
    >
      {user.nickname}
    </Text>
  );
}

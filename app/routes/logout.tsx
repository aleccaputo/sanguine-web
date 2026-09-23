import { ActionFunctionArgs, redirect } from '@remix-run/node';
import { authenticator, getSessionUser } from '~/services/auth.server';
import { audit } from '~/services/audit.server';

export const loader = () => redirect('/');

export const action = async ({ request }: ActionFunctionArgs) => {
  const user = await getSessionUser(request);
  if (user) {
    audit('auth.logout', { discordId: user.discordId, username: user.username });
  }
  return authenticator.logout(request, { redirectTo: '/' });
};

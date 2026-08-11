import { LoaderFunctionArgs } from '@remix-run/node';
import { authenticator } from '~/services/auth.server';

export const loader = ({ request }: LoaderFunctionArgs) =>
  authenticator.authenticate('discord', request, {
    successRedirect: '/admin',
    failureRedirect: '/login',
  });

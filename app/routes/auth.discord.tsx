import { ActionFunctionArgs, redirect } from '@remix-run/node';
import { authenticator } from '~/services/auth.server';

export const loader = () => redirect('/login');

export const action = ({ request }: ActionFunctionArgs) =>
  authenticator.authenticate('discord', request);

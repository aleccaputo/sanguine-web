import { redirect } from '@remix-run/node';

// The tile race is the only admin surface today; go straight to it.
export const loader = () => redirect('/admin/tile-race');

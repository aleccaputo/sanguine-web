import { json, LoaderFunctionArgs } from '@remix-run/node';
import { Form, Link, Outlet, useLoaderData } from '@remix-run/react';
import { Box, Container, Flex, Text } from '@radix-ui/themes';
import { Button } from '~/components/button';
import { requireStaff } from '~/services/auth.server';

// Layout gate for every /admin screen: requireStaff redirects anonymous visitors
// to /login and non-staff to /login?denied=1. Child routes re-check in their own
// loaders/actions — layout loaders don't guard child actions.
export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireStaff(request);
  return json({ user });
}

export default function AdminLayout() {
  const { user } = useLoaderData<typeof loader>();

  return (
    <Container size="4" mt="3" pb="6" px="4">
      <Flex
        align="center"
        justify="between"
        gap="3"
        className="mb-6 border-b-2 border-b-sanguine-red pb-2"
      >
        <Link to="/admin">
          <Text size="3" className="text-osrs-orange hover:text-white">
            Events admin
          </Text>
        </Link>
        <Flex align="center" gap="3">
          {user.avatarUrl && (
            <img
              src={user.avatarUrl}
              alt=""
              width={24}
              height={24}
              className="rounded-sm"
            />
          )}
          <Text size="3" className="text-sanguine-bright">
            {user.username}
          </Text>
          <Form method="post" action="/logout">
            <Button type="submit">Log out</Button>
          </Form>
        </Flex>
      </Flex>
      <Box>
        <Outlet />
      </Box>
    </Container>
  );
}

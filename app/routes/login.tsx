import { json, LoaderFunctionArgs, MetaFunction, redirect } from '@remix-run/node';
import { Form, useLoaderData } from '@remix-run/react';
import { Button, Container, Text } from '@radix-ui/themes';
import { getSessionUser } from '~/services/auth.server';
import { PageHeader } from '~/components/PageHeader';

export const meta: MetaFunction = () => [{ title: 'Events Admin — Login' }];

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getSessionUser(request);
  if (user?.isStaff) {
    throw redirect('/admin');
  }
  const denied = new URL(request.url).searchParams.has('denied');
  return json({ denied });
}

export default function Login() {
  const { denied } = useLoaderData<typeof loader>();

  return (
    <Container size="2" mt="3" pb="6" px="4">
      <PageHeader title="Events admin" iconSrc="/sanguine_icon_small.png">
        Race configuration and overrides for event staff. Sign in with the
        Discord account that holds your staff role.
      </PageHeader>
      {denied && (
        <Text as="p" size="3" className="mb-4 text-red-400">
          That account doesn&apos;t hold an event staff role in the Sanguine
          server.
        </Text>
      )}
      <Form method="post" action="/auth/discord">
        <Button size="3" type="submit" className="cursor-pointer">
          Sign in with Discord
        </Button>
      </Form>
    </Container>
  );
}

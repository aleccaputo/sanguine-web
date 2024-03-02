import {json, LoaderFunctionArgs} from "@remix-run/node";
import {getUserById} from "~/data/user";

export async function loader({params}: LoaderFunctionArgs) {
    const user = await getUserById(params.id ?? '');

    if (!user) {
        return json('Not Found', {status: 404});
    }

    return json({
        user: user
    }, 200);
}

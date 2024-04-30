/* import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { WebhookEvent } from '@clerk/nextjs/server'
import { createUser, deleteUser, updateUser } from '@/lib/actions/user.actions'
import { clerkClient } from '@clerk/nextjs'
import { NextResponse } from 'next/server'
 
export async function POST(req: Request) {
 
  const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET
 
  if (!WEBHOOK_SECRET) {
    throw new Error('Please add WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local')
  }
 
  const headerPayload = headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error occured -- no svix headers', {
      status: 400
    })
  }
 
 
  const payload = await req.json()
  const body = JSON.stringify(payload);
 
  
  const wh = new Webhook(WEBHOOK_SECRET);
 
  let evt: WebhookEvent
 
  
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return new Response('Error occured', {
      status: 400
    })
  }
 

  const { id } = evt.data;
  const eventType = evt.type;
 
  if(eventType === 'user.created') {
    const { id, email_addresses, image_url, first_name, last_name, username } = evt.data;

    const user = {
      clerkId: id,
      email: email_addresses[0].email_address,
      username: username!,
      firstName: first_name || "",
      lastName: last_name || "",
      photo: image_url,
    }

    const newUser = await createUser(user);

    if(newUser) {
      await clerkClient.users.updateUserMetadata(id, {
        publicMetadata: {
          userId: newUser._id
        }
      })
    }

    return NextResponse.json({ message: 'OK', user: newUser })
  }

  if (eventType === 'user.updated') {
    const {id, image_url, first_name, last_name, username } = evt.data

    const user = {
      firstName: first_name || "",
      lastName: last_name || "",
      username: username!,
      photo: image_url,
    }

    const updatedUser = await updateUser(id, user)

    return NextResponse.json({ message: 'OK', user: updatedUser })
  }

  if (eventType === 'user.deleted') {
    const { id } = evt.data

    const deletedUser = await deleteUser(id!)

    return NextResponse.json({ message: 'OK', user: deletedUser })
  }
 
  return new Response('', { status: 200 })
} */



import { Webhook } from 'svix';
import { createClerkClient } from '@clerk/clerk-sdk-node';
import { NextApiRequest, NextApiResponse } from 'next';
import { createUser, deleteUser, updateUser } from '@/lib/actions/user.actions';

// A Clerk kliens példány létrehozása
const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

export async function POST(req: NextApiRequest, res: NextApiResponse) {
    const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
    if (!WEBHOOK_SECRET) {
        return res.status(500).json({ error: 'WEBHOOK_SECRET is missing. Please configure it in your environment variables.' });
    }

    // A fejlécek beolvasása közvetlenül a kérésből
    const svix_id = req.headers['svix-id'];
    const svix_timestamp = req.headers['svix-timestamp'];
    const svix_signature = req.headers['svix-signature'];

    if (!svix_id || !svix_timestamp || !svix_signature) {
        return res.status(400).json({ error: 'Error occurred -- no Svix headers found' });
    }

    const payload = await req.json();
    const body = JSON.stringify(payload);
    const webhook = new Webhook(WEBHOOK_SECRET);

    let event;
    try {
        event = webhook.verify(body, {
            "svix-id": svix_id,
            "svix-timestamp": svix_timestamp,
            "svix-signature": svix_signature,
        });
    } catch (error) {
        console.error('Error verifying webhook:', error);
        return res.status(400).json({ error: 'Error occurred during webhook verification' });
    }

    const { id, email_addresses, image_url, first_name, last_name, username } = event.data;
    const eventType = event.type;

    switch (eventType) {
        case 'user.created':
            if (!id) {
                return res.status(400).json({ error: 'User ID is missing from the event data' });
            }
            const newUser = await createUser({
                clerkId: id,
                email: email_addresses[0]?.email_address || "",
                username: username || "",
                firstName: first_name || "",
                lastName: last_name || "",
                photo: image_url || "",
            });

            if (newUser) {
                await clerkClient.users.updateUserMetadata(id, {
                    publicMetadata: { userId: newUser._id }
                });
            }

            return res.status(200).json({ message: 'User created successfully', user: newUser });

        case 'user.updated':
            if (!id) {
                return res.status(400).json({ error: 'User ID is missing from the event data' });
            }
            const updatedUser = await updateUser(id, {
                firstName: first_name || "",
                lastName: last_name || "",
                username: username || "",
                photo: image_url || "",
            });

            return res.status(200).json({ message: 'User updated successfully', user: updatedUser });

        case 'user.deleted':
            if (!id) {
                return res.status(400).json({ error: 'User ID is missing from the event data' });
            }
            const deletedUser = await deleteUser(id);
            return res.status(200).json({ message: 'User deleted successfully', user: deletedUser });

        default:
            return res.status(404).json({ message: 'Event type not handled' });
    }
}

// PROTOTYPE — throwaway. Sends this role's sample Notifications to the
// current user through the real Knock Development environment.
import { eq, and } from "drizzle-orm";
import type { Route } from "./+types/api.prototype-notifications";
import { db } from "~/db";
import { users, teamMembers, TeamMemberRole } from "~/db/schema";
import { getCurrentUserId } from "~/lib/session";
import { sendPrototypeSamples } from "~/lib/prototype-knock.server";

export async function action({ request }: Route.ActionArgs) {
  const userId = await getCurrentUserId(request);
  if (!userId) throw new Response("Select a user from the DevUI panel", { status: 401 });
  const user = db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) throw new Response("No such user", { status: 404 });
  const isTeamAdmin = !!db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.userId, userId), eq(teamMembers.role, TeamMemberRole.Admin)))
    .get();
  const sent = await sendPrototypeSamples(
    { id: user.id, name: user.name, avatarUrl: user.avatarUrl ?? null },
    user.role,
    isTeamAdmin
  );
  return { sent };
}

// PROTOTYPE — throwaway. Lives on the prototype/notification-feed branch only.
// Answers "What does the Notification Feed look like and how does it behave?"
// Talks to the real Knock Development environment using the keys in `.env`.

import { Knock, signUserToken } from "@knocklabs/node";
import { UserRole } from "~/db/schema";

// Vite doesn't put non-VITE_ vars from `.env` into process.env on the server.
try {
  process.loadEnvFile(".env");
} catch {}

const knock = new Knock({ apiKey: process.env.KNOCK_API_KEY });

export interface PrototypeFeedAuth {
  publicKey: string;
  feedChannelId: string;
  userId: string;
  userToken: string;
}

// Prototype shortcut: swallows signing errors so a missing key shows as no
// Feed. The real build shouldn't, or a signing failure is only a blank Feed.
export async function getPrototypeFeedAuth(
  userId: number
): Promise<PrototypeFeedAuth | null> {
  const publicKey = process.env.KNOCK_PUBLIC_API_KEY;
  const feedChannelId = process.env.KNOCK_FEED_CHANNEL_ID;
  if (!publicKey || !feedChannelId) return null;
  try {
    const userToken = await signUserToken(String(userId), {
      signingKey: process.env.KNOCK_SIGNING_KEY,
      expiresInSeconds: 60 * 60,
    });
    return { publicKey, feedChannelId, userId: String(userId), userToken };
  } catch (e) {
    console.error("[prototype-knock] signUserToken failed", e);
    return null;
  }
}

// What each sample Notification carries in `data`. The headless variants
// render from these fields; the prebuilt variant renders Knock's blocks,
// which the `test-notification` workflow builds from `data.message`.
export interface SampleNotificationData {
  kind: string;
  category: "Refunds" | "Questions" | "Team" | "Courses";
  message: string; // plain text, used by the Knock template
  actor?: string; // the named person, bolded by headless variants
  subject?: string; // course or lesson, bolded by headless variants
  detail?: string; // e.g. decline reason
  url: string; // a page path in Cadence
}

const samples: Record<
  "admin" | "instructor" | "student" | "teamAdmin",
  SampleNotificationData[]
> = {
  admin: [
    {
      kind: "refund-request-opened",
      category: "Refunds",
      actor: "Emma Wilson",
      subject: "Introduction to TypeScript",
      message:
        "Emma Wilson asked for a refund on Introduction to TypeScript (Individual Purchase)",
      detail: "Individual Purchase",
      url: "/admin/refunds",
    },
    {
      kind: "refund-request-opened",
      category: "Refunds",
      actor: "Ava Nakamura",
      subject: "Design Systems with Tailwind",
      message:
        "Ava Nakamura asked for a refund on Design Systems with Tailwind (Team Licence)",
      detail: "Team Licence",
      url: "/admin/refunds",
    },
  ],
  instructor: [
    {
      kind: "question-asked",
      category: "Questions",
      actor: "Emma Wilson",
      subject: "Primitive Types",
      message:
        "Emma Wilson asked a Question on Primitive Types in Introduction to TypeScript",
      url: "/instructor/questions",
    },
    {
      kind: "question-asked",
      category: "Questions",
      actor: "James Park",
      subject: "Arrays and Tuples",
      message:
        "James Park asked a Question on Arrays and Tuples in Introduction to TypeScript",
      url: "/instructor/questions",
    },
    {
      kind: "course-status-changed",
      category: "Courses",
      subject: "Design Systems with Tailwind",
      message:
        "Design Systems with Tailwind was moved back to draft by a Platform Admin",
      url: "/instructor/3",
    },
  ],
  student: [
    {
      kind: "reply-to-question",
      category: "Questions",
      actor: "Sarah Chen",
      subject: "Primitive Types",
      message: "Sarah Chen replied to your Question on Primitive Types",
      url: "/courses/introduction-to-typescript/lessons/4",
    },
    {
      kind: "refund-request-approved",
      category: "Refunds",
      subject: "Building REST APIs with Node.js",
      message: "Your refund for Building REST APIs with Node.js was approved",
      url: "/settings",
    },
    {
      kind: "refund-request-declined",
      category: "Refunds",
      subject: "Practical Data Visualisation",
      detail:
        "You've completed more than half of the course, which is past the point our refund rules allow.",
      message:
        "Your refund request for Practical Data Visualisation was declined: You've completed more than half of the course, which is past the point our refund rules allow.",
      url: "/settings",
    },
  ],
  teamAdmin: [
    {
      kind: "seat-claimed",
      category: "Team",
      actor: "Noah Blackwood",
      subject: "Introduction to TypeScript",
      message: "Noah Blackwood claimed a Seat on Introduction to TypeScript",
      url: "/team",
    },
  ],
};

export function samplesFor(role: UserRole, isTeamAdmin: boolean) {
  if (role === UserRole.Admin) return samples.admin;
  if (role === UserRole.Instructor) return samples.instructor;
  return isTeamAdmin ? [...samples.teamAdmin, ...samples.student] : samples.student;
}

export async function sendPrototypeSamples(
  user: { id: number; name: string; avatarUrl: string | null },
  role: UserRole,
  isTeamAdmin: boolean
) {
  const list = samplesFor(role, isTeamAdmin);
  // Sequential so the Feed order is stable (newest = last in the list).
  for (const data of list) {
    await knock.workflows.trigger("test-notification", {
      recipients: [
        {
          id: String(user.id),
          name: user.name,
          ...(user.avatarUrl ? { avatar: user.avatarUrl } : {}),
        },
      ],
      data: { ...data },
    });
  }
  return list.length;
}

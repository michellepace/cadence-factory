// PROTOTYPE — throwaway. Lives on the prototype/notification-feed branch only.
//
// Question: what does the Notification Feed look like and how does it behave?
// Plan: three variants mounted in the real app sidebar (layout.app.tsx),
// switchable via `?variant=A|B|C`, all reading the real Knock Development feed.
//
//   A  Bell + popover (headless). Bell beside "Cadence"; badge = UNSEEN,
//      cleared on open; items stay unread until clicked or "Mark all read".
//   B  Nav item + side sheet (headless). "Notifications" row in the nav with
//      an UNREAD count that only drops as things are read; full-height sheet
//      with Unread / All tabs, grouped Today / Earlier, per-row read toggle.
//   C  Knock's prebuilt <NotificationFeedPopover>, lightly themed, to judge
//      whether the stock component fits Cadence's look.
//
// The pink bar at the bottom cycles variants (← →) and has prototype-only
// buttons: "Send samples" (this role's Notifications via Knock) and
// "Archive all" (to see the empty state).

import { useEffect, useRef, useState } from "react";
import { useFetcher, useNavigate } from "react-router";
import { Dialog, Popover } from "radix-ui";
import {
  KnockFeedProvider,
  KnockProvider,
  useKnockFeed,
} from "@knocklabs/react-core";
import {
  NotificationFeedPopover,
  NotificationIconButton,
} from "@knocklabs/react";
import "@knocklabs/react/dist/index.css";
import type { FeedItem } from "@knocklabs/client";
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Circle,
  GraduationCap,
  MessageSquare,
  Receipt,
  UsersRound,
  X,
} from "lucide-react";
import { cn, formatRelativeTime } from "~/lib/utils";
import {
  PrototypeSwitcher,
  usePrototypeVariant,
  type PrototypeVariant,
} from "~/components/prototype-switcher";

export const FEED_VARIANTS: PrototypeVariant[] = [
  { key: "A", name: "Bell + popover" },
  { key: "B", name: "Nav item + side sheet" },
  { key: "C", name: "Knock prebuilt" },
];

export interface PrototypeFeedAuth {
  publicKey: string;
  feedChannelId: string;
  userId: string;
  userToken: string;
}

// ---------------------------------------------------------------- providers

function useIsDark() {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const update = () => setIsDark(el.classList.contains("dark"));
    update();
    const obs = new MutationObserver(update);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return isDark;
}

export function PrototypeKnockProviders({
  auth,
  children,
}: {
  auth: PrototypeFeedAuth | null;
  children: React.ReactNode;
}) {
  const isDark = useIsDark();
  // FINDING: the layout loader re-signs the token on every navigation and
  // revalidation. Passing each new token to KnockProvider disposes the feed
  // client and leaves the store stale. Keep the first token per user. The real
  // build should refresh it via onUserTokenExpiring, not on navigation.
  const [stable, setStable] = useState(auth);
  if (auth?.userId !== stable?.userId) setStable(auth);
  auth = auth?.userId === stable?.userId ? stable : auth;
  if (!auth) return <>{children}</>;
  return (
    <KnockProvider
      key={auth.userId} // DevUI switch → fresh client, fresh token
      apiKey={auth.publicKey}
      user={{ id: auth.userId }}
      userToken={auth.userToken}
      identificationStrategy="skip" // only the server writes profiles
    >
      <KnockFeedProvider
        feedId={auth.feedChannelId}
        colorMode={isDark ? "dark" : "light"}
      >
        <FetchOnMount />
        {children}
      </KnockFeedProvider>
    </KnockProvider>
  );
}

function FetchOnMount() {
  const { feedClient } = useKnockFeed();
  useEffect(() => {
    feedClient.fetch();
  }, [feedClient]);
  return null;
}

function useFeed() {
  const { feedClient, useFeedStore } = useKnockFeed();
  const items = useFeedStore((s) => s.items);
  const metadata = useFeedStore((s) => s.metadata);
  const loading = useFeedStore((s) => s.loading);
  return { feedClient, items, metadata, loading };
}

// Safe to call outside providers (no auth → feed absent).
function useHasFeed() {
  try {
    useKnockFeed();
    return true;
  } catch {
    return false;
  }
}

// ------------------------------------------------------------ shared bits

interface SampleData {
  kind?: string;
  category?: string;
  message?: string;
  actor?: string;
  subject?: string;
  detail?: string;
  url?: string;
}

const data = (item: FeedItem) => (item.data ?? {}) as SampleData;

const categoryIcon: Record<string, React.ReactNode> = {
  Refunds: <Receipt className="size-4" />,
  Questions: <MessageSquare className="size-4" />,
  Team: <UsersRound className="size-4" />,
  Courses: <GraduationCap className="size-4" />,
};

// Bold the named person and the course/lesson within the plain message.
function NotificationText({ item }: { item: FeedItem }) {
  const d = data(item);
  const message = d.message ?? "";
  const bold = [d.actor, d.subject].filter(Boolean) as string[];
  if (bold.length === 0) return <>{message}</>;
  const parts = message.split(
    new RegExp(`(${bold.map((b) => b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`)
  );
  return (
    <>
      {parts.map((p, i) =>
        bold.includes(p) ? (
          <strong key={i} className="font-semibold text-foreground">
            {p}
          </strong>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
}

function EmptyFeed({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 text-center text-muted-foreground",
        compact ? "py-10" : "py-24"
      )}
    >
      <BellOff className="size-6 opacity-60" />
      <div className="text-sm font-medium text-foreground">
        You're all caught up
      </div>
      <div className="max-w-56 text-xs">
        Notifications about your courses, Questions and refunds will show up
        here.
      </div>
    </div>
  );
}

function CountBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-semibold leading-5 text-white",
        className
      )}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

// ------------------------------------------------- Variant A: bell + popover

function VariantABell() {
  const { feedClient, items, metadata } = useFeed();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next && metadata.unseen_count > 0) feedClient.markAllAsSeen();
  }

  function onClick(item: FeedItem) {
    if (!item.read_at) feedClient.markAsRead(item);
    setOpen(false);
    const url = data(item).url;
    if (url) navigate(url);
  }

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>
        <button
          title="Notifications"
          className="relative rounded-md p-1.5 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[state=open]:bg-sidebar-accent"
        >
          <Bell className="size-4" />
          <CountBadge
            count={metadata.unseen_count}
            className="absolute -right-1 -top-1"
          />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="right"
          align="start"
          sideOffset={12}
          className="z-50 flex max-h-[min(32rem,80vh)] w-96 flex-col overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg"
        >
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="text-sm font-semibold">Notifications</div>
            <button
              disabled={metadata.unread_count === 0}
              onClick={() => feedClient.markAllAsRead()}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              <CheckCheck className="size-3.5" /> Mark all read
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {items.length === 0 ? (
              <EmptyFeed compact />
            ) : (
              <ul className="divide-y">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      onClick={() => onClick(item)}
                      className={cn(
                        "flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-accent",
                        !item.read_at && "bg-primary/[0.03]"
                      )}
                    >
                      <span className="mt-0.5 text-muted-foreground">
                        {categoryIcon[data(item).category ?? ""] ?? (
                          <Bell className="size-4" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-muted-foreground">
                          <NotificationText item={item} />
                        </span>
                        <span
                          className="mt-1 block text-xs text-muted-foreground/70"
                          suppressHydrationWarning
                        >
                          {formatRelativeTime(item.inserted_at)}
                        </span>
                      </span>
                      {!item.read_at && (
                        <Circle className="mt-1.5 size-2 shrink-0 fill-blue-600 text-blue-600" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// -------------------------------------------- Variant B: nav item + sheet

function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

function VariantBNavItem() {
  const { feedClient, items, metadata } = useFeed();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"unread" | "all">("unread");
  const navigate = useNavigate();

  const shown = tab === "unread" ? items.filter((i) => !i.read_at) : items;
  const today = shown.filter((i) => isToday(i.inserted_at));
  const earlier = shown.filter((i) => !isToday(i.inserted_at));

  function onClick(item: FeedItem) {
    if (!item.read_at) feedClient.markAsRead(item);
    setOpen(false);
    const url = data(item).url;
    if (url) navigate(url);
  }

  function Row({ item }: { item: FeedItem }) {
    const d = data(item);
    return (
      <li className="group relative">
        <button
          onClick={() => onClick(item)}
          className={cn(
            "flex w-full gap-3 rounded-lg border px-4 py-3 text-left transition-colors hover:bg-accent",
            item.read_at ? "border-transparent" : "border-border bg-card shadow-xs"
          )}
        >
          <span
            className={cn(
              "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
              item.read_at
                ? "bg-muted text-muted-foreground"
                : "bg-primary text-primary-foreground"
            )}
          >
            {categoryIcon[d.category ?? ""] ?? <Bell className="size-4" />}
          </span>
          <span className="min-w-0 flex-1 pr-8">
            <span className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {d.category}
            </span>
            <span
              className={cn(
                "mt-0.5 block text-sm",
                item.read_at ? "text-muted-foreground" : "text-foreground"
              )}
            >
              <NotificationText item={item} />
            </span>
            <span
              className="mt-1 block text-xs text-muted-foreground/70"
              suppressHydrationWarning
            >
              {formatRelativeTime(item.inserted_at)}
            </span>
          </span>
        </button>
        <button
          title={item.read_at ? "Mark as unread" : "Mark as read"}
          onClick={() =>
            item.read_at ? feedClient.markAsUnread(item) : feedClient.markAsRead(item)
          }
          className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground group-hover:opacity-100"
        >
          {item.read_at ? <Circle className="size-4" /> : <Check className="size-4" />}
        </button>
      </li>
    );
  }

  function Group({ label, list }: { label: string; list: FeedItem[] }) {
    if (list.length === 0) return null;
    return (
      <section>
        <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </h3>
        <ul className="space-y-1.5">
          {list.map((i) => (
            <Row key={i.id} item={i} />
          ))}
        </ul>
      </section>
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
          <Bell className="size-4" />
          <span className="flex-1 text-left">Notifications</span>
          {metadata.unread_count > 0 && (
            <span className="rounded-full bg-primary px-2 text-xs font-semibold leading-5 text-primary-foreground">
              {metadata.unread_count}
            </span>
          )}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-[28rem] max-w-full flex-col border-l bg-background shadow-2xl">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <Dialog.Title className="text-base font-semibold">
              Notifications
            </Dialog.Title>
            <Dialog.Description className="sr-only">
              Your Notification Feed
            </Dialog.Description>
            <Dialog.Close className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
              <X className="size-4" />
            </Dialog.Close>
          </div>
          <div className="flex items-center justify-between border-b px-5 py-2">
            <div className="flex gap-1 rounded-md bg-muted p-0.5 text-sm">
              {(["unread", "all"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "rounded px-3 py-1 font-medium capitalize",
                    tab === t
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground"
                  )}
                >
                  {t}
                  {t === "unread" && metadata.unread_count > 0
                    ? ` (${metadata.unread_count})`
                    : ""}
                </button>
              ))}
            </div>
            <button
              disabled={metadata.unread_count === 0}
              onClick={() => feedClient.markAllAsRead()}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              <CheckCheck className="size-3.5" /> Mark all read
            </button>
          </div>
          <div className="flex-1 space-y-6 overflow-y-auto p-5">
            {shown.length === 0 ? (
              <EmptyFeed />
            ) : (
              <>
                <Group label="Today" list={today} />
                <Group label="Earlier" list={earlier} />
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ------------------------------------------------- Variant C: Knock prebuilt

function VariantCPrebuilt() {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  return (
    <>
      <NotificationIconButton
        ref={buttonRef}
        onClick={() => setOpen((o) => !o)}
      />
      <NotificationFeedPopover
        buttonRef={buttonRef}
        isVisible={open}
        onClose={() => setOpen(false)}
        placement="right-start"
        onNotificationClick={(item) => {
          const url = data(item).url;
          setOpen(false);
          if (url) navigate(url);
        }}
      />
    </>
  );
}

// ---------------------------------------------------------- mount points

// Rendered beside "Cadence" in the sidebar header.
export function PrototypeFeedHeaderSlot() {
  const variant = usePrototypeVariant(FEED_VARIANTS);
  if (!useHasFeed()) return null;
  if (variant.key === "A") return <VariantABell />;
  if (variant.key === "C") return <VariantCPrebuilt />;
  return null;
}

// Rendered at the top of the sidebar nav.
export function PrototypeFeedNavSlot() {
  const variant = usePrototypeVariant(FEED_VARIANTS);
  if (!useHasFeed()) return null;
  if (variant.key === "B") return <VariantBNavItem />;
  return null;
}

export function PrototypeFeedSwitcher() {
  const hasFeed = useHasFeed();
  return (
    <PrototypeSwitcher variants={FEED_VARIANTS}>
      {hasFeed ? <PrototypeFeedControls /> : (
        <span className="text-xs opacity-80">no Feed: pick a user in DevUI</span>
      )}
    </PrototypeSwitcher>
  );
}

function PrototypeFeedControls() {
  const fetcher = useFetcher<{ sent: number }>();
  const { feedClient, metadata, items } = useFeed();
  const busy = fetcher.state !== "idle";
  return (
    <>
      <fetcher.Form method="post" action="/api/prototype-notifications">
        <button
          disabled={busy}
          className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium hover:bg-white/25 disabled:opacity-50"
          title="Trigger this role's sample Notifications to you via Knock"
        >
          {busy ? "Sending…" : "Send samples"}
        </button>
      </fetcher.Form>
      <button
        onClick={() => feedClient.markAllAsArchived()}
        className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium hover:bg-white/25"
        title="Archive every Notification, to see the empty state"
      >
        Archive all
      </button>
      <span className="font-mono text-[11px] opacity-80" title="Feed state from Knock">
        {items.length} items · {metadata.unread_count} unread ·{" "}
        {metadata.unseen_count} unseen
      </span>
    </>
  );
}

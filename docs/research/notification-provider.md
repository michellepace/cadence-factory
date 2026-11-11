# Hosted notification provider for Cadence Notifications

**Date:** 2026-11-11
**Question:** Which hosted SaaS notification provider should Cadence use for in-app Notifications?

All pricing and free-tier facts were checked against the vendors' live pages on 2026-11-11. "STATED" marks something the vendor says on a primary source: docs, pricing page, API reference, SDK source, or npm metadata. "INFERRED" marks our own deduction.

## TL;DR

**Use Knock.** It is the only candidate that meets every ranked criterion and also lets the provider be the only store of the Notification Feed:

- **Retention and limits.** Feed retention is "Unlimited" on every plan, including Free ([pricing](https://knock.app/pricing), [data retention](https://docs.knock.app/manage-your-account/data-retention)).
- **Free tier.** It allows 10,000 messages/month with no credit card and no hard cap ([pricing](https://knock.app/pricing)).
- **Browser access.** The browser can read the feed directly with a public key plus an RS256 user token. Our server signs that token with `signUserToken`.
- **Headless hooks.** `@knocklabs/react-core` provides hooks, so we can build our own Tailwind/shadcn Feed UI.
- **Recipient sync.** Recipients are upserted inline on each trigger (`{ id: String(user.id), name, avatar }`).
- **Trigger behaviour.** Triggers run asynchronously and accept an `Idempotency-Key`.

**Close contender: Courier.** Its inbox also persists indefinitely, its free tier is 10k sends, and its browser auth is JWT-based. But it has no documented server-side "list a recipient's inbox" endpoint, its SDK doesn't refresh tokens, and its feed runs over an undocumented GraphQL endpoint.

**A second hands-on prototype would not clearly pay off.** Knock matches or beats Courier on every criterion. Only prototype Courier if the Knock prototype hits a blocker.

**Novu Cloud is out on the only-store requirement.** Its Free plan keeps the Inbox feed for just 30 days, and new runs stop with HTTP 402 at 10k.

## Summary comparison

| | **Knock** | **Courier** | **Novu Cloud** | **SuprSend** | **MagicBell** | **Liveblocks** |
|---|---|---|---|---|---|---|
| **1. Free tier, no card** | ✅ 10k msgs/mo, no card, no hard cap | ✅ 10k sends/mo; card moves you to paid; behaviour past 10k unstated | ⚠️ 10k runs/mo, no card; **HTTP 402 hard stop** past cap | ✅ 10k notifs/mo, no card, not stopped past cap | ⚠️ 1,000 deliveries/mo; card unknown | ⚠️ only **200 custom notifs/mo**, no card |
| **2. Own-Feed API + browser auth** | ✅ REST + JS client + headless hooks; RS256 user JWT | ✅ headless `courier-js` + `useCourier`; JWT from `/auth/issue-token` | ✅ `@novu/js` + headless hooks; HMAC-SHA256 `subscriberHash` | ✅ web SDK + `react-core` hooks; ES256 user JWT | ✅ REST + `magicbell-js` user client; HS256 user JWT | ✅ hooks; JWT from `identifyUser` |
| **3. DevUI switching, string ids** | ✅ string id; inline upsert on trigger; `authenticate()` re-inits on user change | ✅ string `user_id`; `signIn` signs the previous user out | ✅ string `subscriberId`; inline upsert on trigger | ✅ string `distinct_id`; inline upsert; `reset()` on switch | ✅ `external_id` string; separate `PUT /users` | ✅ string `userId` inline |
| **4. Email later** | ✅ email step + many providers | ✅ multi-channel template (counts as 1 send) | ✅ email step | ✅ (each email billed separately) | ✅ bring your own provider | ⚠️ webhooks only; you send the email |
| **5. SSR fit / moving parts** | ✅ SSR-safe imports; server can also list the feed with the secret key | ⚠️ client-only render; no server list endpoint | ✅ `browser` export condition, so the server build is inert | ⚠️ feed is browser-only via SDK; server REST exists | ✅ plain REST works from loaders | ⚠️ room/collab-centric model |
| **Only store / retention** | ✅ **feed kept indefinitely on all plans** | ✅ persists until archived/expired (no plan limit stated) | ❌ **30 days on Free**, 90 days paid | ❓ inbox retention not documented | ❓ not documented | ✅ until deleted |
| **Live updates** | ✅ WebSocket (Phoenix) | ✅ WebSocket | ✅ WebSocket | ✅ WebSocket (socket.io) | ✅ WebSocket (new-message only) | ✅ (inferred) |
| **Preferences (category × channel, browser API)** | ✅ categories × channel types; browser API | ✅ topics × channels; browser API (custom routing may be paid) | ✅ workflow × channel; browser API (no first-class category) | ⚠️ yes, but **Business plan only** | ✅ category × channel; browser API | ⚠️ webhook channels only |
| **Digests / batching** | ✅ batch step | ✅ Journeys digest/batch | ✅ digest (1-day max window on Free) | ⚠️ Business plan only | ❌ none | ✅ batching |
| **Test / sandbox** | dev env (opt-in), separate keys; dev usage counts; no in-app sandbox | Test env + key; test sends count | Dev + Prod envs; dev runs count | Sandbox/Staging/Prod workspaces; quota counting unknown | 1 project on Free; no test mode | Dev + Prod per project |

Engagespot, Pingram (formerly NotificationAPI) and Stream were screened and set aside. So were Inngest, Fyno, Notifuse, Customer.io, OneSignal, Ably, Pusher Beams and Firebase. See [Other candidates considered](#other-candidates-considered).

---

## Knock

**Company status.** STATED: the changelog shows releases through 2026-11-10 and no pricing, acquisition, or shutdown entries ([changelog](https://knock.app/changelog)). STATED: the "Developer" plan has been renamed "Free" ([plans](https://docs.knock.app/manage-your-account/knock-plans)). We found no primary-source date for the rename and no list-price change.

### Free tier
- STATED: Free costs $0/month for "up to 10,000" messages/month, with "no credit card required" ([pricing](https://knock.app/pricing)).
- STATED: there is no MAU or recipient cap for feeds. The "guide recipients" limit (500) applies only to the Guides product ([pricing](https://knock.app/pricing)).
- STATED: a billable message is "a single message delivered to a single user on a single channel". Failed or bounced messages aren't billed ([pricing](https://knock.app/pricing)).
- STATED, on going over the limit: "We don't hard cap your messages". Knock contacts you about setting up billing for the following month ([pricing](https://knock.app/pricing)).
- STATED: the next plan up, Starter, is $250/month for 50k messages, then $0.005 per message ([pricing](https://knock.app/pricing)).

### Retention and the only-store question
- STATED: feed retention is "Unlimited" on Free, Starter and Enterprise ("No limit, but can be configured"). Logs are kept 30 days on Free/Starter and 90 days on Enterprise ([pricing](https://knock.app/pricing)).
- STATED: "In-app feed notifications are available indefinitely". `FeedItem`s can still be fetched and updated after their logs expire ([data retention](https://docs.knock.app/manage-your-account/data-retention)).
- STATED: feed content is immutable once generated ([feeds overview](https://docs.knock.app/in-app-ui/feeds/overview)). INFERRED: renaming a course won't rewrite old Notifications.

### Browser auth
- STATED: the browser sends the environment's public key (`pk_…`) plus a **user token** when **enhanced security mode** is on. Without that mode, "a request with your public key can act as any user" ([security & authentication](https://docs.knock.app/in-app-ui/security-and-authentication)).
- STATED: the user token is a JWT signed **RS256** with the environment's private **signing key** (env var convention `KNOCK_SIGNING_KEY`). `sub` holds the user id; `iat`/`exp` and `grants` are optional ([security & authentication](https://docs.knock.app/in-app-ui/security-and-authentication)).
- STATED: the server helper is `signUserToken(userId: string, { signingKey?, expiresInSeconds? /* default 3600 */, grants? })` in `@knocklabs/node`. It uses `jose` with `RS256` ([tokenSigner.ts](https://github.com/knocklabs/knock-node/blob/main/src/lib/tokenSigner.ts), [README](https://github.com/knocklabs/knock-node/blob/main/README.md)).
  - `jose` is ESM-only. Cadence is `"type": "module"`, so INFERRED: that's fine.
- STATED: the client sends `Authorization: Bearer <pk>` and `X-Knock-User-Token: <jwt>` ([client api.ts](https://github.com/knocklabs/javascript/blob/main/packages/client/src/api.ts)).
- STATED: token refresh is handled by the `onUserTokenExpiring` and `timeBeforeExpirationInMs` hooks ([KnockProvider.tsx](https://github.com/knocklabs/javascript/blob/main/packages/react-core/src/modules/core/context/KnockProvider.tsx)).

### SDK packages
STATED, all from the [knocklabs/javascript monorepo](https://github.com/knocklabs/javascript/tree/main/packages) except the server SDK, which is [knock-node](https://github.com/knocklabs/knock-node):

| Package | Version | Role |
|---|---|---|
| `@knocklabs/node` | 1.41.1 | Server |
| `@knocklabs/client` | 0.23.1 | Plain JS client |
| `@knocklabs/react-core` | 0.17.1 | Headless hooks |
| `@knocklabs/react` | 0.15.1 | Prebuilt UI; `"use client"` |

- STATED: the headless hooks include `KnockProvider`, `useAuthenticatedKnockClient`, `useNotifications`, `useNotificationStore` (`{ items, metadata }`), `usePreferences` and `KnockFeedProvider` ([custom UI guide](https://docs.knock.app/in-app-ui/react/custom-notifications-ui)).
- STATED (source), SSR safety: the WebSocket only connects when `typeof window !== "undefined"`, and `BroadcastChannel` is guarded ([client api.ts](https://github.com/knocklabs/javascript/blob/main/packages/client/src/api.ts), [feed.ts](https://github.com/knocklabs/javascript/blob/main/packages/client/src/clients/feed/feed.ts)).
- INFERRED: importing the SDK during SSR is safe, but the feed only fetches inside `useEffect`. The SSR HTML therefore shows an empty Feed unless the loader fetches the first page server-side.
- Gotcha, STATED: the JS client defaults to `mode: "compact"`, which drops `activities` and nested `data` objects and keeps only one actor. The REST API defaults to `rich`. Pass `{ mode: "rich" }` if the UI needs nested data ([feed.ts](https://github.com/knocklabs/javascript/blob/main/packages/client/src/clients/feed/feed.ts), [list items](https://docs.knock.app/api-reference/users/feeds/list_items)).

### Feed API
- **List**, STATED: `GET /v1/users/{user_id}/feeds/{channel_id}` ([list items](https://docs.knock.app/api-reference/users/feeds/list_items)).
  - It is callable from the browser with the public key and user token, or from the server with the secret key (`client.users.feeds.listItems(userId, channelId)`, see [api.md](https://github.com/knocklabs/knock-node/blob/main/api.md)).
  - Cursor pagination uses `page_size` (default 50) with `after`/`before`. Filters include `status`, `archived`, `workflow_categories` and `tenant`.
- **Unread / unseen count**, STATED: the response `meta` includes `total_count`, `unread_count` and `unseen_count` ([list items](https://docs.knock.app/api-reference/users/feeds/list_items)). Knock recommends `unseen_count` for badges ([custom UI guide](https://docs.knock.app/in-app-ui/react/custom-notifications-ui)).
- **Mark one read**, STATED: `PUT /v1/messages/{id}/read`; `DELETE` on the same path marks it unread ([mark as read](https://docs.knock.app/api-reference/messages/mark_as_read)). There are batch endpoints at `POST /v1/messages/batch/{read|seen|…}`. The client method is `feed.markAsRead(item)` ([feed.ts](https://github.com/knocklabs/javascript/blob/main/packages/client/src/clients/feed/feed.ts)).
- **Mark all read**, STATED: the client method is `feed.markAllAsRead()`. It calls the async bulk endpoint `POST /v1/channels/{channel_id}/messages/bulk/read`, scoped to the current user ([bulk update](https://docs.knock.app/api-reference/channels/bulk/update_message_status), [messages client](https://github.com/knocklabs/javascript/blob/main/packages/client/src/clients/messages/index.ts)). Updates are applied optimistically in the client store.
- **Statuses**, STATED: `seen_at`, `read_at`, `interacted_at`, `link_clicked_at` and `archived_at` are independent ([message statuses](https://docs.knock.app/send-notifications/message-statuses)).

### Recipient identity and sync
- STATED: user ids are strings of ≤ 256 characters with no `/` or `#`. They can't be changed once set, and Knock recommends using your DB primary key ([users](https://docs.knock.app/concepts/users)). INFERRED: `String(user.id)` is fine.
- STATED, inline identify: pass full recipient objects (`{ id, name, email, avatar, … }`) as `recipients`/`actor` on trigger. They are upserted (deep-merged) before the workflow runs ([identifying recipients](https://docs.knock.app/managing-recipients/identifying-recipients), [triggering via API](https://docs.knock.app/send-notifications/triggering-workflows/api)).
- STATED, separate identify: `PUT /v1/users/{id}` (`users.update`), with a bulk form at `POST /v1/users/bulk/identify` ([identifying recipients](https://docs.knock.app/managing-recipients/identifying-recipients)).
- STATED: `name` and `avatar` are system attributes ([users](https://docs.knock.app/concepts/users)).
- STATED: `KnockProvider user={{ id, … }}` also identifies the user from the client by default (`identificationStrategy: "inline"`). Set it to `"skip"` to keep identity changes server-side only ([knock.ts](https://github.com/knocklabs/javascript/blob/main/packages/client/src/knock.ts)).
- STATED: `authenticate()` detects a changed user id or token and re-initialises feeds and sockets. `KnockProvider` has an `enabled` prop ([knock.ts](https://github.com/knocklabs/javascript/blob/main/packages/client/src/knock.ts)). INFERRED: this fits DevUI user switching.

### Trigger
- STATED: `POST /v1/workflows/{key}/trigger` returns a `workflow_run_id`, and "All workflow runs are executed asynchronously" ([trigger](https://docs.knock.app/api-reference/workflows/trigger)).
- STATED: up to 1,000 recipients per call ([triggering via API](https://docs.knock.app/send-notifications/triggering-workflows/api)).
- STATED: an `Idempotency-Key` header is accepted on trigger only, with a 24h replay window ([API reference](https://docs.knock.app/reference)).
- INFERRED: it is safe to fire and forget from an action, with a `.catch` and a short client timeout.

### Live updates, preferences, digests
- **Live updates**, STATED: a WebSocket (Phoenix channels). The `new-message` event carries badge counts and "might be throttled" ([API overview](https://docs.knock.app/in-app-ui/api-overview)). `useNotifications` calls `listenForUpdates()` automatically ([useNotifications.ts](https://github.com/knocklabs/javascript/blob/main/packages/react-core/src/modules/feed/hooks/useNotifications.ts)).
- **Preferences**, STATED: preference sets combine `categories` × `channel_types`, plus per-workflow settings, with environment defaults ([preferences overview](https://docs.knock.app/preferences/overview)).
  - Browser API: `knock.user.getPreferences()` / `setPreferences()` and the `usePreferences` hook ([custom preference center](https://docs.knock.app/preferences/custom-preference-center)).
- **Digests**, STATED: the batch step supports fixed, dynamic, relative and sliding windows up to 90 days, keyed by `batch_key` ([batch function](https://docs.knock.app/designing-workflows/batch-function)).

### Environments and testing
- STATED: an account starts with production only. Enabling environments adds a development environment, plus per-developer branches. Each environment has its own `pk_`/`sk_` keys and signing key, and changes are committed, then promoted ([environments](https://docs.knock.app/concepts/environments)).
- STATED: "usage may be accrued in any Knock environment", so dev messages count. The in-app channel **does not support sandbox mode** ([plans](https://docs.knock.app/manage-your-account/knock-plans)).
- STATED: there is no local emulator. The dashboard has a workflow test runner ([triggering workflows](https://docs.knock.app/send-notifications/triggering-workflows)).
- INFERRED: the cheapest smoke test is to trigger one workflow for one seeded user in the dev environment, then read it back with `users.feeds.listItems`. That costs one message out of the 10k.

### Email later
- STATED: email can be added later as a channel step. Supported providers include SES, Postmark, Resend, SendGrid, Mailgun and SMTP ([email overview](https://docs.knock.app/integrations/email/overview)).
- STATED: a built-in "Knock" test email provider sends 100 emails/month, only to account members ([Knock test provider](https://docs.knock.app/integrations/email/knock-test)).

---

## Courier

**Company status.** STATED: cloud only, in US and EU regions ([pricing.md](https://www.courier.com/pricing.md), "Last updated: 2026-11-01"). STATED: Journeys replaced Automations on 2026-03-17 ([changelog](https://www.courier.com/changelog/courier-journeys)). INFERRED: the tiers were re-priced in 2026 to the current per-send model; an older hidden table on the pricing page shows "Pro $0.005/notification". We found no acquisition or shutdown news.

### Free tier
- STATED: the Developer plan is free with 10,000 sends/month. Business is $0.005 per send, counting every send ([pricing](https://www.courier.com/pricing), [billing](https://www.courier.com/docs/workspaces/billing)).
- STATED: "One send is one template sent to one recipient". A multi-channel template counts as one send, and Inbox has no fee of its own ([billing](https://www.courier.com/docs/workspaces/billing)).
- STATED: "Adding a credit card to a Developer workspace moves it to Business". INFERRED: Developer needs no card.
- STATED: going past 10k "takes the Business plan". The docs don't say whether Developer is blocked or throttled at that point ([billing](https://www.courier.com/docs/workspaces/billing)).
- STATED: "Sends made with a Test key count the same as Production sends" ([billing](https://www.courier.com/docs/workspaces/billing)).

### Retention
- STATED: an inbox message stays in the feed "until it is archived or expires". Without `expiresAt` it "persists" ([how the inbox behaves](https://www.courier.com/docs/in-app/how-the-inbox-behaves)). No plan limit on inbox storage is mentioned.
- Message *logs* are kept 30 days on Developer/Business per [monitor overview](https://www.courier.com/docs/monitor/overview), but the pricing table shows 7 days for Developer. That conflict is unresolved.
- INFERRED: Courier could be the only store. However, the public REST reference has **no server-side "list a user's inbox" endpoint**; `GET /messages` returns delivery logs ([API reference](https://www.courier.com/docs/_llms/api-reference.txt)).

### Browser auth
- STATED: the server calls `POST /auth/issue-token` with the API key, `scope: "user_id:<id> inbox:read:messages inbox:write:events"` and `expires_in`. The browser then calls `signIn({ userId, jwt })` ([authenticate users](https://www.courier.com/docs/in-app/authenticate-users)).
- STATED: "The SDKs do not refresh tokens". An expired token silently shows an empty inbox ([authenticate users](https://www.courier.com/docs/in-app/authenticate-users)).
- STATED: the legacy HMAC client-key auth is gone ([v8 migration](https://www.courier.com/docs/sdk-libraries/courier-react-v8-migration-guide)).

### SDK packages
- STATED, all in the [courier-web monorepo](https://github.com/trycourier/courier-web):
  - `@trycourier/courier` 10.0.0 (Node)
  - `@trycourier/courier-js` 3.7.1 (headless browser client)
  - `@trycourier/courier-react` 9.3.5 (components plus the `useCourier` hook)
  - `@trycourier/courier-ui-inbox` (Web Components)
- STATED: `@trycourier/react-inbox` and `@trycourier/react-hooks` are deprecated.
- STATED: Inbox "render[s] client-side only" ([courier-react-web](https://www.courier.com/docs/sdk-libraries/courier-react-web)).

### Feed API
- STATED, client methods ([courier-js API](https://github.com/trycourier/courier-web/blob/main/api/courier-js.api.md)):
  - `inbox.getMessages({ paginationLimit, startCursor, filter: { status: 'read'|'unread', archived, tags } })`
  - `getUnreadMessageCount()`
  - `read(…)`, `unread(…)`, `readAll()`, `archive(…)`
- STATED: the hook equivalents are `useCourier().inbox.readMessage` and `readAllMessages` ([use-courier.tsx](https://github.com/trycourier/courier-web/blob/main/@trycourier/courier-react-components/src/hooks/use-courier.tsx)).
- STATED (source): the wire protocol is GraphQL at `https://inbox.courier.com/q` ([inbox-client.ts](https://github.com/trycourier/courier-web/blob/main/@trycourier/courier-js/src/client/inbox-client.ts)). INFERRED: this endpoint is not a documented public contract.

### Identity, send, and other features
- **Identity**, STATED: `user_id` is yours to choose ([recipients](https://www.courier.com/docs/recipients/overview)).
  - `to: { user_id, email }` overrides the stored profile for that one message only. It never changes the profile.
  - Profiles are upserted with `POST /profiles/:id` (merge).
  - INFERRED: name and avatar need a separate profile upsert. The avatar goes in the message `data`, because `InboxMessage` has no avatar field.
- **Send**, STATED: `POST /send` returns 202 with a `requestId` and runs asynchronously. `Idempotency-Key` replays last 25h by default ([send](https://www.courier.com/docs/api-reference/send/send-a-message), [API overview](https://www.courier.com/docs/reference/api-overview)).
- **Live updates**, STATED: a WebSocket opened with `listenForUpdates()` that syncs read and archive state ([how the inbox behaves](https://www.courier.com/docs/in-app/how-the-inbox-behaves)).
- **Preferences**, STATED: subscription topics × channels, with a browser API (`getUserPreferences` and others) and `<CourierPreferences>` ([preferences](https://www.courier.com/docs/recipients/preferences/overview)). Per-topic channel routing can return HTTP 402 when not available; the docs don't say which plan includes it.
- **Digests**, STATED: Journeys Digest and Batch nodes, plus topic digest schedules ([daily digest guide](https://www.courier.com/docs/guides/send-a-daily-digest)).
- **Environments**, STATED: Production and Test by default, with a separate `pk_` key for each. The Test key is what selects the test environment, and Inbox works in Test ([environments](https://www.courier.com/docs/workspaces/environments)).
- **Email later**, STATED: bring your own provider. The Test environment has a test provider that only delivers to the signup address ([environments](https://www.courier.com/docs/workspaces/environments)).

---

## Novu Cloud

**Company status.** STATED: a $30 Pro tier was added in March 2025, and Free was set at 10k events; accounts created before 2025-03-01 keep their old limits ([changelog](https://www.novu.co/changelog/new-tier-novu-pro.md)). STATED: the v0 packages reached end of support: `@novu/node` on 2025-03-20 (replaced by `@novu/api`) and `@novu/notification-center` on 2025-04-03 (replaced by `@novu/react` / `@novu/js`) ([npm @novu/node](https://registry.npmjs.org/@novu/node), [npm @novu/notification-center](https://registry.npmjs.org/@novu/notification-center)). We found no acquisition or shutdown news.

### Free tier and retention
- STATED: Free is $0 for 10,000 workflow runs/month, "No credit card required". It includes unlimited subscribers and 2 environments ([pricing](https://novu.co/pricing.md)).
- STATED, on going over the cap: "Free stops new workflow runs at its 10,000 included runs". Triggers are then rejected with **HTTP 402** ([billing](https://docs.novu.co/platform/account/billing.md)). Runs skipped by preferences and each digested event are still billed ([trigger concept](https://docs.novu.co/platform/concepts/trigger.md)).
- STATED: **Inbox feed retention is 30 days on Free**, 90 days on Pro/Team, custom on Enterprise. Activity feed retention is 1 day on Free ([limits](https://docs.novu.co/platform/developer/limits)).
- INFERRED: **this disqualifies Novu as the only store** under Cadence's preference, short of a custom Enterprise plan.

### Browser auth
- STATED: the client passes `applicationIdentifier` + `subscriberId` + `subscriberHash`, where `subscriberHash = HMAC-SHA256(secretKey, subscriberId)` in hex ([prepare for production](https://docs.novu.co/platform/inbox/prepare-for-production.md)).
- STATED: enforcement is switched on per environment under "Novu In-App" → "Security HMAC encryption" (same page).
- INFERRED: HMAC is mandatory for Cadence, because integer ids are guessable and the application identifier is public.

### SDK packages
- STATED: `@novu/api` 3.19.1 (server) ([npm](https://www.npmjs.com/package/@novu/api)), `@novu/js` 3.19.2 ([JS SDK](https://docs.novu.co/platform/sdks/javascript.md)), and `@novu/react` 3.19.2 ([React SDK](https://docs.novu.co/platform/sdks/react.md)).
- STATED: the headless hooks are `useNotifications`, `useCounts` and `usePreferences`, and headless use is allowed on Free ([headless mode](https://docs.novu.co/platform/inbox/headless-mode.md)).
- STATED (source), SSR: `@novu/react` serves its real build only under the `browser` export condition. On the server it resolves to a stub that renders nothing ([package.json](https://github.com/novuhq/novu/blob/next/packages/react/package.json), [server/index.tsx](https://github.com/novuhq/novu/blob/next/packages/react/src/server/index.tsx)).

### Feed API
- STATED, client methods ([JS SDK](https://docs.novu.co/platform/sdks/javascript.md)):
  - `novu.notifications.list(…)`, `count({ read: false })`, `read`, `readAll`
- STATED, server REST ([OpenAPI](https://api.novu.co/openapi.json)):
  - `GET /v2/subscribers/{id}/notifications` and `…/count`
  - `PATCH …/{nid}/read`
  - `POST …/notifications/read` (mark all read)

### Identity, trigger, and other features
- **Identity**, STATED: `subscriberId` is a string. `to: { subscriberId, firstName, avatar, … }` on trigger creates or updates the subscriber, and a separate `POST /v2/subscribers` upsert also exists ([trigger concept](https://docs.novu.co/platform/concepts/trigger.md), [subscribers](https://docs.novu.co/platform/concepts/subscribers.md)).
- **Trigger**, STATED: the request is queued and returns `acknowledged`. Real `Idempotency-Key` dedup is "not enabled for all organizations"; you have to contact support to get it ([idempotency](https://docs.novu.co/api-reference/idempotency.md)).
- **Live updates**, STATED: a WebSocket that pushes `unread_count_changed` and other events ([JS SDK](https://docs.novu.co/platform/sdks/javascript.md)).
- **Preferences**, STATED: workflow × channel, plus global settings. A browser API exists, but there is no first-class category; grouping is done with tags ([preferences](https://docs.novu.co/platform/concepts/preferences.md)).
- **Digests**, STATED: available, with a 1-day maximum window on Free ([limits](https://docs.novu.co/platform/developer/limits)).
- **Environments**, STATED: Development and Production, with separate keys. Dev runs count toward the same quota ([environments](https://docs.novu.co/platform/developer/environments.md), [billing](https://docs.novu.co/platform/account/billing.md)).
- **Self-hosting**, STATED: the core is MIT-licensed and can be self-hosted (MongoDB, Redis, S3 required) ([self-hosting](https://docs.novu.co/community/self-hosting-novu/overview.md)).
- **Email later**, STATED: add an email step and a provider integration ([email](https://docs.novu.co/platform/integrations/email.md)).

---

## SuprSend

**Company status.** STATED: the changelog shows steady releases through 2026-10-30 ([changelog](https://docs.suprsend.com/changelog)). We found no primary-source news of re-pricing, acquisition or shutdown.

### Free tier
- STATED: Free is $0 for 10k notifications/month, "No Credit Card required". It keeps 30-day logs, and the in-app feed carries SuprSend branding ([pricing](https://www.suprsend.com/pricing)).
- STATED, on going over the limit: "We do not stop processing and sending your notification requests" (same page).
- STATED: the plan cards list **User Preferences** and **Batching & Digest** under **Business** ($250/month) only (same page). The comparison table's checkmarks didn't render, so the plan cards are the evidence here.

### Retention
- NOT FOUND: we found no stated inbox-message retention period on any plan.
- STATED: inbox messages can be given an expiry on the template, after which they are deleted ([in-app inbox template](https://docs.suprsend.com/docs/in-app-inbox-template)).
- STATED: a server REST API exists: `GET /v1/message/` and `PATCH /v1/bulk/message/` ([list messages](https://docs.suprsend.com/reference/list-messages)).

### Browser auth
- STATED: the browser uses the workspace public key plus, in **Enhanced Security Mode**, a user JWT signed **ES256** with a signing key from the dashboard ([client authentication](https://docs.suprsend.com/docs/client-authentication)).
  - Payload: `{ entity_type: "subscriber", entity_id, iat, exp }`.
  - The client calls `identify(id, userToken, { refreshUserToken })`.

### SDK packages and feed API
- STATED, packages: `@suprsend/node-sdk` 1.15.1, `@suprsend/web-sdk` 5.4.0, `@suprsend/react-core` 2.4.0 (headless), and `@suprsend/react` 1.5.0 ([suprsend-web-sdk](https://github.com/suprsend/suprsend-web-sdk), [suprsend-react-core](https://github.com/suprsend/suprsend-react-core)).
- STATED: `@suprsend/react-inbox` is deprecated.
- STATED, feed client methods ([JS in-app feed](https://docs.suprsend.com/docs/js-inapp-feed)):
  - `feedClient.fetch()`, `fetchNextPage()`, `fetchCount()`
  - `markAsRead`, `markAllAsRead()`
- INFERRED: there is no direct "unread count" call. `badge` counts what is new since the bell was last opened, so an unread count needs a store with `read: false`.

### Identity, trigger, and other features
- **Identity**, STATED: `distinct_id` is a string. The trigger's recipient object upserts the user inline ([users](https://docs.suprsend.com/docs/users)).
  - A trigger fails for an unknown `distinct_id` that has no inline channels.
  - The web SDK needs `reset()` before `identify()` can switch to a different user; `SuprSendProvider` handles this ([main.ts](https://github.com/suprsend/suprsend-web-sdk/blob/main/src/main.ts)).
- **Trigger**, STATED: returns 202 Accepted and supports `$idempotency_key` with a 24h window ([trigger API](https://docs.suprsend.com/reference/trigger-workflow-api), [idempotency](https://docs.suprsend.com/reference/idempotent-requests)).
- **Live updates**, STATED: a socket.io WebSocket ([JS in-app feed](https://docs.suprsend.com/docs/js-inapp-feed)).
- **Preferences**, STATED: three levels (global channel, category, channel within category), with a browser API ([JS preferences](https://docs.suprsend.com/docs/js-preferences)). Preferences are a Business-plan feature.
- **Environments**, STATED: Sandbox, Staging and Production workspaces with separate keys. Test Mode only blocks email, SMS and WhatsApp, not the inbox ([workspaces](https://docs.suprsend.com/docs/workspaces), [test mode](https://docs.suprsend.com/docs/developer/test-mode)). Whether Staging usage counts against the quota is not stated.
- **Email later**, STATED: yes, but each email counts as a separate notification ([pricing](https://www.suprsend.com/pricing)).

---

## MagicBell

**Company status.** INFERRED: MagicBell is active; the SDK monorepo was pushed on 2026-11-10. STATED: the v1 API and the v1 JS/React packages are deprecated, and v2 uses JWT auth ([API docs](https://www.magicbell.com/docs/api), [deprecation discussion](https://github.com/orgs/magicbell/discussions/265)).

### Free tier and retention
- STATED: Builder is $0 for **1,000 deliveries/month**, with 1 project and unlimited users ([pricing](https://www.magicbell.com/pricing)).
  - Deliveries are counted per channel.
  - Beyond the limit, "each additional delivery will be charged". No Builder rate is given.
  - The pricing page doesn't say whether a card is needed.
- NOT FOUND: we found no stated retention period.

### Browser auth, packages, and feed API
- **Browser auth**, STATED: a user JWT signed **HS256** with the project secret key, with claims `user_external_id` and/or `user_email` plus `api_key` ([user authentication](https://www.magicbell.com/docs/api/authentication/user)).
- **Packages**, STATED: `magicbell-js` 1.8.0 (`/project-client`, `/user-client`, `/realtime`) and `@magicbell/react` 1.14.0 (prebuilt only, no hooks documented) ([magicbell-js](https://www.magicbell.com/docs/libraries/magicbell-js), [magicbell-react](https://www.magicbell.com/docs/libraries/magicbell-react)).
- **Feed API**, STATED, all under base `/v2` ([OpenAPI](https://www.magicbell.com/docs/api/openapi.json)):
  - `GET /notifications`
  - `GET /notifications/unread/count`
  - `POST /notifications/{id}/read`
  - `POST /notifications/read` (mark all read)

### Identity and other features
- **Identity**, STATED: string `external_id`, with a `PUT /users` upsert ([user](https://www.magicbell.com/docs/primitive/user)).
  - Broadcast recipients carry user fields, but whether they upsert the user is not stated.
  - There is no avatar field.
- **Notification create**, STATED: `POST /broadcasts` is processed asynchronously and goes `enqueued` → `processed` ([broadcast](https://www.magicbell.com/docs/primitive/broadcast)).
- **Live updates**, STATED: a WebSocket that sends new-notification events only ([realtime.ts](https://github.com/magicbell/magicbell-js/blob/main/packages/magicbell-js/src/realtime.ts)).
- **Preferences**, STATED: category × channel through `GET`/`PUT /channels/user_preferences` (OpenAPI).
- **Digests**, NOT FOUND.
- **Test story**, STATED: no test keys; "Create projects for staging/production environments" ([quick start](https://www.magicbell.com/docs/quick-start)), but Builder allows only 1 project.
- **Email later**, STATED: bring your own provider ([email](https://www.magicbell.com/docs/channels/email)).

---

## Other candidates considered

- **Liveblocks Notifications fits technically but is ruled out on volume.**
  - STATED: Free is $0, "No credit card required", but includes only **200 custom notifications/month**. A capped feature pauses until the next billing cycle ([pricing](https://liveblocks.io/pricing)).
  - STATED: notifications persist until deleted ([data storage](https://liveblocks.io/docs/platform/data-storage)).
  - STATED: the hooks cover list, unread count, mark read and mark all read ([liveblocks-react](https://liveblocks.io/docs/api-reference/liveblocks-react)).
  - Preferences only control webhook channels, and the product model is built around rooms and comments.
- **Pingram (formerly NotificationAPI) is set aside.**
  - STATED: notificationapi.com redirects to pingram.io, and the site now pitches "One API for email, SMS, and voice calls" ([pingram.io](https://www.pingram.io/)).
  - Its in-app docs URLs return 403 or redirect away, and the pricing page gives no in-app quota ([pricing](https://www.pingram.io/pricing)).
  - The in-app API still exists in its SDKs, but it is de-emphasised.
- **Engagespot is set aside on viability.**
  - Its marketing site and pricing page return a Framer "Site Not Found" 404. The last GitHub push was 2025-01-25 ([GitHub org](https://github.com/Engagespot)), and npm packages were last published in 2025-05.
  - An archived pricing page shows **7-day** in-app retention on Free ([Wayback 2026-08-28](https://web.archive.org/web/20260828130310/https://engagespot.co/pricing)).
- **Stream Activity Feeds is a partial fit.** It is a feed primitive with notification feeds, unread/seen counts and JWT user tokens ([notification feeds](https://getstream.io/activity-feeds/docs/node/notification-feeds/)). It has no workflows, preferences, or email, and the free plan caps usage at 5,000 activities/month with no overages ([pricing](https://getstream.io/activity-feeds/pricing/)).
- **Dropped:**
  - **Inngest:** Realtime is pub/sub with no persisted inbox ([realtime](https://www.inngest.com/docs/features/realtime)).
  - **Fyno:** no public pricing or free tier ([fyno.io](https://fyno.io/)).
  - **Notifuse:** an email platform whose "Notification Center" is a preference portal ([notifuse.com](https://www.notifuse.com/)).
  - **Customer.io:** no free plan ([pricing](https://customer.io/pricing)).
  - **OneSignal:** in-app messages are modals and banners, not a feed ([pricing](https://onesignal.com/pricing)).
  - **Ably:** pub/sub with no hosted inbox ([pricing](https://ably.com/pricing)).
  - **Pusher Beams:** push only ([Beams](https://pusher.com/beams/pricing/)).
  - **Firebase FCM:** delivery only, with no inbox state ([FCM](https://firebase.google.com/docs/cloud-messaging)).

---

## Implications for Cadence (assuming Knock)

### Knock can be the only store
STATED: feed items are kept indefinitely on Free ([data retention](https://docs.knock.app/manage-your-account/data-retention)), and both the server and the browser can list and update them. Cadence would keep no notifications table.

Consequences, all INFERRED:
- Every Feed read is a network call to Knock.
- Knock's content immutability means old Notifications keep the text they had when sent. Course or lesson renames won't show up in old Notifications.
- If Knock is down, the Feed is empty or errors. The UI should degrade quietly: show a hidden badge and an "unavailable" Feed state.

### Recipient identity with DevUI switching and seeded users
- **Id format.** Use `String(users.id)` everywhere: in `recipients[].id`, in `signUserToken(...)`, and in the provider's `userId`. Integer strings have no `/` or `#`, so they are valid Knock ids ([users](https://docs.knock.app/concepts/users)).
- **Identify on trigger.** Pass the full recipient object inline on every trigger: `{ id, name, avatar }`, plus `email` once email exists. The actor (for example, the Instructor who published a lesson) goes in `actor`. Knock upserts both before the run, so seeding needs no separate sync step ([identifying recipients](https://docs.knock.app/managing-recipients/identifying-recipients)). Optionally the seed script could bulk-identify all seeded users (`POST /v1/users/bulk/identify`) so their profiles exist before any trigger.
- **Avoid client-side identify.** Set `identificationStrategy: "skip"` on `KnockProvider` so profile writes happen only on the server.
- **DevUI switching.** The root or layout loader calls `signUserToken(String(user.id), { expiresInSeconds })` for the current session user and returns `{ knockPublicKey, userToken, userId, feedChannelId }`. When the DevUI panel switches users, the loader re-runs and the new `userId`/`userToken` reach `KnockProvider`, which re-authenticates and re-initialises the feed (STATED: [knock.ts](https://github.com/knocklabs/javascript/blob/main/packages/client/src/knock.ts)). When no user is in the session, render the provider with `enabled={false}`.
- **Dev vs prod environments, and shared dev environments.** Enable environments so that local dev uses Knock's *development* environment with its own keys, separate from production ([environments](https://docs.knock.app/concepts/environments)). INFERRED: seeded ids (1, 2, 3…) will collide if several developers or reseeds share one Knock dev environment. Old Notifications for "user 3" would then show up for a re-seeded "user 3". The options are:
  - accept this in dev;
  - prefix ids per developer (for example `KNOCK_USER_ID_PREFIX`);
  - use Knock branches per developer, which are STATED to exist ([environments](https://docs.knock.app/concepts/environments)).
- **Workflow config.** Workflows (one per Notification type, each with an in-app feed channel step) and the in-app feed channel are configured in the Knock dashboard, committed in dev, then promoted to prod. That configuration is outside the repo (INFERRED from [environments](https://docs.knock.app/concepts/environments)). Knock also has a CLI for managing workflows as code; we did not verify it here.

### Building the Feed UI and fitting SSR
- **Client side.** Use `@knocklabs/react-core` headless hooks (`useNotifications` + `useNotificationStore`) with our own shadcn components. Pass `{ mode: "rich" }` if Notifications carry nested `data` or batched activities.
- **Server side.** For a full Notifications page rendered on the server, call `users.feeds.listItems` with the secret key in a loader. Mark-read actions can be React Router actions calling `PUT /v1/messages/{id}/read`, or browser calls via the client. INFERRED: the browser-direct path is simpler (no Cadence route per action) and is what the hooks assume.
- **Badge.** Use `meta.unseen_count` for the badge and call `markAllAsSeen` when the Feed opens. Use `unread_count` for per-item emphasis. This follows Knock's guidance ([custom UI guide](https://docs.knock.app/in-app-ui/react/custom-notifications-ui)).
- **Live updates.** These come free with `useNotifications`. There is nothing extra to run.

### Best-effort triggers
Triggers run asynchronously on Knock's side ([trigger](https://docs.knock.app/api-reference/workflows/trigger)). INFERRED: in an action, call the wrapper with no `await` on the critical path, or with `await` inside `try/catch` and a short timeout plus `maxRetries: 0`/low. Log failures and never rethrow. Use an `Idempotency-Key` derived from the domain event, for example `lesson-published:<lessonId>`, so a retried action doesn't double-notify ([API reference](https://docs.knock.app/reference)). Whether `@knocklabs/node` exposes per-request `timeout`/`maxRetries` options is unverified; it is a Stainless-generated client, which typically does.

### Preferences
Knock supports per-category × per-channel-type preference sets, and a browser preferences API lets Students and Instructors manage them from a Cadence settings page ([preferences overview](https://docs.knock.app/preferences/overview), [custom preference center](https://docs.knock.app/preferences/custom-preference-center)). To get this, assign each workflow a category such as `course-updates` or `comments`.

### Secrets and env vars
Cadence currently reads `process.env` directly (for example `DISCORD_INVITE_URL` in `app/routes/courses.$slug.welcome.tsx`); there is no `.env` convention in the repo yet. Proposed variables:

| Variable | Kind | Where it lives |
|---|---|---|
| `KNOCK_API_KEY` | secret, `sk_…` | server only |
| `KNOCK_SIGNING_KEY` | private RS256 key | server only |
| `KNOCK_PUBLIC_API_KEY` | public, `pk_…` | safe to return from a loader |
| `KNOCK_FEED_CHANNEL_ID` | in-app channel id | config |

Each Knock environment has its own set of keys ([environments](https://docs.knock.app/concepts/environments)). **Turn on enhanced security mode in every environment**, including development. Otherwise anyone holding the public key can read any integer-id user's Feed ([security & authentication](https://docs.knock.app/in-app-ui/security-and-authentication)).

### Test-fake seam
Put a thin wrapper module, for example `app/lib/notifications.server.ts`, between Cadence and `@knocklabs/node`. It would expose domain-level functions only:
- `notify(event, { recipients, actor, data, idempotencyKey })`
- `getFeedAuth(userId)`, which returns the public key, user token and channel id
- optionally `listFeed(userId, cursor)`

Under that design:
- Route actions and loaders import only the wrapper.
- Vitest swaps in an in-memory fake, via `vi.mock` or by injecting the client. The fake records `notify` calls so tests can assert "a Notification was sent to Instructor 2" without network access.
- The browser side (`KnockProvider`) is not exercised in Vitest. Components can be tested with a fake `useNotificationStore`, or not at all.
- An opt-in smoke test, for example `KNOCK_SMOKE=1 npm run test -- notifications.smoke`, triggers one workflow for a dedicated smoke-test user id in the dev environment and polls `listItems` until it appears. It costs one message of the 10k/month, since in-app has no sandbox mode ([plans](https://docs.knock.app/manage-your-account/knock-plans)).

### Email later
Add an email channel step to an existing workflow, connect a provider (Resend, Postmark, SES, …), and include `email` in the inline recipient object. The trigger call doesn't change ([email overview](https://docs.knock.app/integrations/email/overview)). Each email delivery is a separate billable message ([pricing](https://knock.app/pricing)).

---

## Open questions / unverified

- **Knock:**
  - Requests-per-second for the trigger endpoint's rate-limit "tier 5". The tier table didn't render ([rate limits](https://docs.knock.app/api-reference/overview/rate-limits)).
  - The exact current import path for `signUserToken`: the root export (README) vs `@knocklabs/node/lib/tokenSigner` (older docs).
  - Whether `@knocklabs/react-core` itself carries `"use client"`. Only `@knocklabs/react` was confirmed.
  - Per-request timeout/retry options on `@knocklabs/node`.
  - Whether the browser can call the bulk mark-all endpoint with a user token. INFERRED yes, because the official client does.
  - A primary-source date for the Developer → Free rename.
- **Courier:**
  - Whether Developer is hard-blocked past 10k sends.
  - Developer log retention: 7 vs 30 days.
  - Which plans include custom routing, digest and batch.
  - Whether the Inbox GraphQL endpoint is a stable public contract.
- **Novu:**
  - What happens to messages after 30 days: hard delete or just hidden.
  - Team digest limit: 30 days (limits doc) vs 90 days (pricing table).
  - Whether a Free org can get `Idempotency-Key` enabled.
- **SuprSend:**
  - Inbox message retention on any plan.
  - Whether Staging/Sandbox usage counts against the quota.
  - Rate limits.
  - Exact plan gating; the comparison-table checkmarks didn't render.
- **MagicBell:**
  - Retention.
  - Credit-card requirement.
  - Overage behaviour on Builder.
  - Whether broadcast recipients upsert users.
- **Liveblocks:** an explicit statement that the inbox hooks are realtime.
- **Pingram, Engagespot:** current operating status and in-app pricing. The relevant pages are offline.

## Sources

**Knock**
- https://knock.app/pricing
- https://docs.knock.app/manage-your-account/knock-plans
- https://docs.knock.app/manage-your-account/data-retention
- https://knock.app/changelog
- https://docs.knock.app/in-app-ui/security-and-authentication
- https://docs.knock.app/in-app-ui/feeds/overview
- https://docs.knock.app/in-app-ui/api-overview
- https://docs.knock.app/in-app-ui/react/overview
- https://docs.knock.app/in-app-ui/react/custom-notifications-ui
- https://docs.knock.app/api-reference/users/feeds/list_items
- https://docs.knock.app/api-reference/messages/mark_as_read
- https://docs.knock.app/api-reference/channels/bulk/update_message_status
- https://docs.knock.app/api-reference/workflows/trigger
- https://docs.knock.app/api-reference/overview/rate-limits
- https://docs.knock.app/reference
- https://docs.knock.app/send-notifications/message-statuses
- https://docs.knock.app/send-notifications/triggering-workflows
- https://docs.knock.app/send-notifications/triggering-workflows/api
- https://docs.knock.app/concepts/users
- https://docs.knock.app/concepts/environments
- https://docs.knock.app/managing-recipients/identifying-recipients
- https://docs.knock.app/preferences/overview
- https://docs.knock.app/preferences/custom-preference-center
- https://docs.knock.app/designing-workflows/batch-function
- https://docs.knock.app/integrations/email/overview
- https://docs.knock.app/integrations/email/knock-test
- https://github.com/knocklabs/knock-node (README, `src/lib/tokenSigner.ts`, `api.md`, `tests/index.test.ts`)
- https://github.com/knocklabs/javascript (`packages/client`, `packages/react-core`, `packages/react`)

**Courier**
- https://www.courier.com/pricing
- https://www.courier.com/pricing.md
- https://www.courier.com/docs/workspaces/billing
- https://www.courier.com/docs/workspaces/environments
- https://www.courier.com/docs/monitor/overview
- https://www.courier.com/docs/in-app/how-the-inbox-behaves
- https://www.courier.com/docs/in-app/authenticate-users
- https://www.courier.com/docs/in-app/build-a-custom-inbox
- https://www.courier.com/docs/in-app/send-to-the-inbox
- https://www.courier.com/docs/sdk-libraries/courier-react-web
- https://www.courier.com/docs/sdk-libraries/courier-react-v8-migration-guide
- https://www.courier.com/docs/recipients/overview
- https://www.courier.com/docs/recipients/preferences/overview
- https://www.courier.com/docs/recipients/preferences/api
- https://www.courier.com/docs/api-reference/send/send-a-message
- https://www.courier.com/docs/api-reference/authentication/create-a-jwt
- https://www.courier.com/docs/reference/api-overview
- https://www.courier.com/docs/_llms/api-reference.txt
- https://www.courier.com/docs/guides/send-a-daily-digest
- https://www.courier.com/docs/journeys/nodes
- https://www.courier.com/changelog
- https://www.courier.com/changelog/courier-journeys
- https://github.com/trycourier/courier-web
- https://github.com/trycourier/courier-node
- https://github.com/trycourier/courier-nextjs-quickstart

**Novu**
- https://novu.co/pricing.md
- https://docs.novu.co/platform/account/billing.md
- https://docs.novu.co/platform/developer/limits
- https://docs.novu.co/platform/developer/environments.md
- https://docs.novu.co/platform/concepts/trigger.md
- https://docs.novu.co/platform/concepts/subscribers.md
- https://docs.novu.co/platform/concepts/preferences.md
- https://docs.novu.co/platform/inbox/prepare-for-production.md
- https://docs.novu.co/platform/inbox/headless-mode.md
- https://docs.novu.co/platform/inbox/migration-guide.md
- https://docs.novu.co/platform/sdks/javascript.md
- https://docs.novu.co/platform/sdks/react.md
- https://docs.novu.co/platform/sdks/server/typescript.md
- https://docs.novu.co/api-reference/idempotency.md
- https://docs.novu.co/platform/integrations/email.md
- https://docs.novu.co/community/self-hosting-novu/overview.md
- https://api.novu.co/openapi.json
- https://www.novu.co/changelog/new-tier-novu-pro.md
- https://registry.npmjs.org/@novu/node
- https://registry.npmjs.org/@novu/notification-center
- https://github.com/novuhq/novu (`packages/js`, `packages/react`)

**SuprSend**
- https://www.suprsend.com/pricing
- https://docs.suprsend.com/changelog
- https://docs.suprsend.com/docs/inbox-overview
- https://docs.suprsend.com/docs/in-app-inbox-template
- https://docs.suprsend.com/docs/client-authentication
- https://docs.suprsend.com/docs/js-inapp-feed
- https://docs.suprsend.com/docs/js-preferences
- https://docs.suprsend.com/docs/user-preferences
- https://docs.suprsend.com/docs/users
- https://docs.suprsend.com/docs/workspaces
- https://docs.suprsend.com/docs/developer/test-mode
- https://docs.suprsend.com/docs/batch
- https://docs.suprsend.com/docs/digest
- https://docs.suprsend.com/reference/trigger-workflow-api
- https://docs.suprsend.com/reference/idempotent-requests
- https://docs.suprsend.com/reference/list-messages
- https://github.com/suprsend/suprsend-web-sdk
- https://github.com/suprsend/suprsend-react-core
- https://github.com/suprsend/suprsend-node-sdk

**MagicBell**
- https://www.magicbell.com/pricing
- https://www.magicbell.com/docs/api
- https://www.magicbell.com/docs/api/openapi.json
- https://www.magicbell.com/docs/api/authentication/user
- https://www.magicbell.com/docs/primitive/user
- https://www.magicbell.com/docs/primitive/broadcast
- https://www.magicbell.com/docs/libraries/magicbell-js
- https://www.magicbell.com/docs/libraries/magicbell-react
- https://www.magicbell.com/docs/quick-start
- https://www.magicbell.com/docs/channels/email
- https://github.com/magicbell/magicbell-js
- https://github.com/orgs/magicbell/discussions/265

**Other candidates**
- https://liveblocks.io/pricing
- https://liveblocks.io/docs/platform/data-storage
- https://liveblocks.io/docs/api-reference/liveblocks-react
- https://liveblocks.io/docs/api-reference/liveblocks-node
- https://www.pingram.io/
- https://www.pingram.io/pricing
- https://www.pingram.io/docs/reference/node
- https://github.com/Engagespot
- https://web.archive.org/web/20260828130310/https://engagespot.co/pricing
- https://docs.engagespot.co/docs/features/in-app-inbox/authentication
- https://getstream.io/activity-feeds/pricing/
- https://getstream.io/activity-feeds/docs/node/notification-feeds/
- https://www.inngest.com/docs/features/realtime
- https://fyno.io/
- https://www.notifuse.com/
- https://customer.io/pricing
- https://onesignal.com/pricing
- https://ably.com/pricing
- https://pusher.com/beams/pricing/
- https://firebase.google.com/docs/cloud-messaging

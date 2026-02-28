# Event Chat Runtime Verification Checklist

## Scope
- Runtime verification only.
- No code changes.
- Target flow:
  1. Open `/app/e/:id`
  2. Send message
  3. Add member
  4. Verify second user can chat

## Preconditions
- Dev server is running and reachable in browser.
- You have at least 2 user accounts:
  - `User A` (event owner/member)
  - `User B` (to be added to event)
- You have one private event id available (example: `137`).
- Open browser DevTools for:
  - Console
  - Network (including WS)

---

## 1) Open `/app/e/:id`
- [ ] Log in as **User A**.
- [ ] Navigate to `/app/e/137` (replace `137` with your real event id).
- [ ] Confirm event page renders fully (header, tabs, right chat panel).
- [ ] Confirm chat input is focusable/clickable.

### Expected result
- Event page loads without freezing.
- No runtime red overlay.
- Chat panel is visible and interactive.

### If this fails, inspect
- **Console**:
  - `Maximum update depth exceeded`
  - `Script terminated by timeout`
  - Hook order/runtime errors
- **Network**:
  - Event fetch request status (200 expected)
- **Server logs**:
  - Route errors for event fetch

---

## 2) Send message (User A)
- [ ] In chat input, type `Hello from A`.
- [ ] Click **Send** (or press Enter).
- [ ] Confirm message appears in chat list immediately or shortly after.

### Expected result
- Message appears in the UI.
- No silent failure.
- If send fails, a visible toast/error appears.

### If this fails, inspect
- **Network > WS**:
  - WS connection exists for event chat endpoint
  - Outbound frame on send (payload with text)
  - Inbound message/ack or error payload
- **Console**:
  - Chat send logs/errors
- **Server logs**:
  - Chat subscribe/send handler errors
  - Access control rejections

---

## 3) Add member (User A adds User B)
- [ ] Open **Guests** sheet/widget on the same event.
- [ ] Search/select **User B** and add to event.
- [ ] Confirm User B appears in members list.

### Expected result
- Add member succeeds (no 404/500).
- Member list updates (immediately or after refresh) with User B.

### If this fails, inspect
- **Network**:
  - `POST /api/events/:eventId/members` status/body
  - `GET /api/events/:eventId/members` status/body
- **Console**:
  - UI errors from guests flow
- **Server logs**:
  - Access guard failures (`FORBIDDEN`)
  - Missing route errors (`Cannot POST /api/events/.../members`)

---

## 4) Verify second user can chat (User B)
- [ ] Open a second browser/profile/incognito.
- [ ] Log in as **User B**.
- [ ] Open the same event `/app/e/137`.
- [ ] In User B chat input, send `Hello from B`.
- [ ] Confirm User A sees B's message.
- [ ] Send reply from User A and confirm User B receives it.

### Expected result
- User B can access chat input and send messages.
- Messages are visible in both sessions (realtime or near-realtime).
- Chat is not locked for valid members.

### If this fails, inspect
- **Network > WS (both tabs)**:
  - Successful subscribe for same `eventId`
  - Incoming frames when other user sends
- **Console**:
  - `CHAT_LOCKED` or access-related errors
- **Server logs**:
  - Membership check path for chat access
  - Broadcast errors for event room

---

## Pass Criteria
- [ ] No runtime freeze while interacting for ~60 seconds.
- [ ] No `Maximum update depth exceeded` warning.
- [ ] User A can send chat messages.
- [ ] User B can be added and can chat in same event.
- [ ] Failures (if any) are visible and diagnosable via Console/Network/Server logs.

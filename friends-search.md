# Friends Search Runtime Verification

## Manual steps
1. Start app and server, sign in, open Profile modal, go to **Friends** tab.
2. Focus search input and type quickly: `t`, `to`, `tom`, `tom_`, `tom_b`.
3. Confirm requests are debounced (not one request per keystroke).
4. Search exact wildcard chars:
   - `tom_`
   - `%`
   - `tom%`
5. Click **Add** on a result and verify the friends list updates.

## Expected UI states
- Query length `< 2`: `Type at least 2 characters`.
- While searching: spinner.
- Matches found: user list with Add button.
- No matches: `No users found` copy.
- Error: inline error with `Retry`.

## Expected network behavior
- Requests only after ~300ms pause in typing.
- In-flight search requests are cancelled/ignored by query cancellation.
- Endpoint response shape: `{ users: [...] }`.

## If it fails, inspect
- Browser Network:
  - `GET /api/users/search?q=...`
  - request frequency (debounce)
  - aborted/cancelled previous requests
  - response body and status codes
- Browser Console:
  - dev line `[friends-search] q=...`
  - React warnings (`Maximum update depth exceeded`)
- Server logs:
  - `users-search failed` entries with `reqId`
  - `USERS_SEARCH_FAILED` or `USERS_SEARCH_RATE_LIMITED`

## Specific checks
- `tom_` should match `Tom_Bont` (underscore treated literally).
- Fast typing should not crash server process.
- Re-opening Profile modal should not trigger render loops.

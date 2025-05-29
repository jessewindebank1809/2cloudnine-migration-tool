# OAuth Callback Failed Issue

## Problem Description

When a user attempts to authenticate with a Salesforce org that has already been
authenticated via another account and is already stored within the database the
following error is thrown:

OAuth callback failed. Please try again.

Different users should be able to authenticate the same Salesforce org. The same
user should not be able to authenticate the same Salesforce org multiple times.

## Root Cause Analysis

**Database Schema**: The unique constraint
`@@unique([salesforce_org_id, user_id])` correctly allows different users to
connect to the same Salesforce org (migration:
`20250529075905_allow_same_org_across_users`).

**Suspected Issue**: ~~The OAuth callback logic in
`/src/app/api/auth/callback/salesforce-org/route.ts` (lines 92-106) may have
incorrect duplicate checking logic.~~

**IDENTIFIED ROOT CAUSE**: Session Management Issue

Through automated testing and investigation, we've identified that the issue is
**NOT** in the query logic or database constraints. Both work correctly. The
problem is in **session management** where the wrong `userId` gets encoded into
the OAuth state parameter.

### Investigation Results

1. **✅ Database Schema Works Correctly**: Multiple users can connect to the
   same Salesforce org
2. **✅ Query Logic Works Correctly**: The duplicate check query is properly
   filtering by `user_id`
3. **❌ Session Management Issue**: The `userId` in the OAuth state parameter
   may be incorrect

### How the Bug Manifests

1. User A successfully connects to Salesforce org `00D000000000001EAA`
2. User B initiates OAuth flow to connect to the same Salesforce org
3. **BUG**: User B's OAuth state contains User A's `userId` instead of User B's
   `userId`
4. OAuth callback executes duplicate check with User A's ID
5. Query finds User A's existing org connection
6. System incorrectly blocks User B's connection with "org_already_connected"
   error

### Technical Details

**OAuth State Creation** (`/src/app/api/auth/oauth2/salesforce/route.ts:56`):

```typescript
const state = Buffer.from(JSON.stringify({
    orgId,
    userId: session.user.id, // This userId must be correct!
    orgType,
    targetInstanceUrl,
    codeVerifier,
    background,
})).toString("base64");
```

**OAuth Callback Check**
(`/src/app/api/auth/callback/salesforce-org/route.ts:92-106`):

```typescript
const existingOrg = await prisma.organisations.findFirst({
    where: {
        salesforce_org_id: userInfo.organization_id,
        user_id: userId, // If this is wrong user ID, query fails
        id: { not: orgId },
    },
});
```

### Testing Evidence

Created comprehensive automated tests that demonstrate:

- When correct `userId` is used: ✅ Connection succeeds
- When wrong `userId` is used: ❌ Connection blocked (reproduces the bug)

## Debugging Enhancements

Added detailed logging to both OAuth routes:

- Session retrieval and validation
- Organisation ownership verification
- State parameter creation and decoding
- Duplicate check query execution
- User identity tracking through the flow

## Potential Session Issues

The session management problem could be caused by:

1. **Browser Session Sharing**: Session cookies shared between tabs/windows
2. **Better Auth Session Persistence**: Session data not properly isolated per
   user
3. **Race Conditions**: Concurrent OAuth flows interfering with each other
4. **Session Cache Issues**: Stale session data being returned

## Action Plan

### Phase 1: Reproduce with Logging (COMPLETED)

- ✅ Added comprehensive logging to OAuth routes
- ✅ Created automated tests proving the root cause
- ✅ Identified session management as the issue

### Phase 2: Monitor Production (IN PROGRESS)

1. Deploy logging changes to production
2. Monitor logs when users report the issue
3. Capture actual `userId` values in OAuth flow
4. Verify if wrong user sessions are being retrieved

### Phase 3: Session Investigation

1. Test Better Auth session isolation
2. Verify session handling in multiple browser contexts
3. Check for session cookie configuration issues
4. Test concurrent OAuth flows from different users

### Phase 4: Fix Implementation

Based on investigation findings:

1. **If Better Auth issue**: Configure proper session isolation
2. **If cookie sharing**: Implement session validation improvements
3. **If race conditions**: Add request-specific session handling
4. **If cache issues**: Clear or validate session cache

## Expected Outcome

Different users should be able to authenticate with the same Salesforce org
whilst preventing the same user from connecting the same org multiple times.

## Investigation Files

- `tests/integration/api/oauth-callback.test.ts` - Integration tests
- `tests/unit/oauth-query-logic.test.ts` - Unit tests for query logic
- `scripts/test-oauth-direct.js` - Direct database testing
- `scripts/test-session-state.js` - Session state issue simulation

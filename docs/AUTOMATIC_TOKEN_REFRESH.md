# Automatic Token Refresh

This document explains the automatic token refresh functionality implemented in
the TC9 Migration Tool.

## Overview

The application now automatically handles Salesforce authentication token
expiration by:

1. **Detecting token expiration errors** across all Salesforce API calls
2. **Automatically refreshing tokens** using the stored refresh token
3. **Retrying the original operation** after successful token refresh
4. **Providing clear error messages** when refresh tokens are also expired

## Implementation

### Core Components

1. **Token Refresh Helper** (`src/lib/salesforce/token-refresh-helper.ts`)
   - `withTokenRefresh()` - Wraps Salesforce operations with automatic retry
     logic
   - `isTokenError()` - Identifies token-related errors

2. **Enhanced SalesforceClient** (`src/lib/salesforce/client.ts`)
   - Improved `refreshAccessToken()` method with better error handling
   - Automatic database token updates
   - Integration with token refresh helper

3. **API Route Enhancement**
   (`src/app/api/salesforce/discover-objects/route.ts`)
   - Automatic retry logic for object discovery
   - Clear logging for debugging token refresh attempts

### Error Detection

The system detects the following token-related errors:

- `invalid_grant`
- `expired`
- `INVALID_SESSION_ID`
- `expired access/refresh token`
- `Connection failed: expired access/refresh token`
- `Authentication token has expired`

### Automatic Refresh Process

1. **API Call Made** - User initiates a Salesforce operation
2. **Token Expired** - Salesforce returns a token expiration error
3. **Refresh Attempt** - System automatically attempts to refresh the access
   token
4. **Retry Operation** - If refresh succeeds, the original operation is retried
5. **Success/Failure** - Operation completes or fails with appropriate error
   message

### When Manual Reconnection is Required

Automatic refresh will fail and require manual reconnection when:

- **Refresh token is expired** - User must re-authenticate
- **Organisation is disconnected** - Connection was manually removed
- **Invalid credentials** - Connected app configuration issues

## User Experience

### Before (Manual Process)

1. User encounters "Authentication token has expired" error
2. User must navigate to `/orgs` page
3. User must manually reconnect the organisation
4. User must return to their original task

### After (Automatic Process)

1. User encounters token expiration (transparent to user)
2. System automatically refreshes token in background
3. Original operation completes successfully
4. User continues with their task uninterrupted

### When Manual Action is Still Required

- Clear error message: "Refresh token expired. Please reconnect the
  organisation."
- Direct link to reconnection page
- Explanation of why reconnection is needed

## Benefits

1. **Improved User Experience** - Seamless operation without interruption
2. **Reduced Support Requests** - Fewer "token expired" issues
3. **Better Reliability** - Automatic recovery from common authentication issues
4. **Transparent Operation** - Users don't need to understand token mechanics

## Monitoring and Debugging

### Logs to Watch For

```
Token expired, attempting automatic refresh and retry...
Successfully refreshed access token for org: [orgId]
Token refresh successful, retrying [operation]...
```

### Error Scenarios

```
Token refresh failed for org: [orgId] [error details]
Refresh token expired. Please reconnect the organisation.
```

## Configuration

No additional configuration is required. The feature uses existing:

- Salesforce Connected App credentials
- Database-stored refresh tokens
- Existing error handling infrastructure

## Testing

To test the automatic refresh functionality:

1. **Simulate Token Expiration** - Wait for natural token expiration (typically
   2 hours)
2. **Verify Automatic Refresh** - Check logs for refresh attempts
3. **Confirm Operation Success** - Ensure original operation completes
4. **Test Refresh Token Expiration** - Verify proper error handling when refresh
   fails

## Future Enhancements

Potential improvements:

- **Proactive Token Refresh** - Refresh tokens before they expire
- **Background Token Monitoring** - Regular health checks
- **Token Expiration Notifications** - Warn users before manual reconnection
  needed
- **Bulk Operation Resilience** - Handle token refresh during long-running
  operations

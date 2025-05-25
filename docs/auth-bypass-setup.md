# Authentication Bypass for Development

This feature allows you to skip the Salesforce OAuth flow during development to
focus on building migration functionality.

## ⚠️ Important Security Notice

**This bypass should ONLY be used in development environments. Never enable this
in production!**

## Setup

1. Add these environment variables to your `.env.local` file:

```env
# Enable development auth bypass
AUTH_BYPASS="true"
NEXT_PUBLIC_AUTH_BYPASS="true"
```

2. Restart your development server:

```bash
npm run dev
```

3. Navigate to `/auth/signin` and you'll see a new "Skip OAuth (Development)"
   button.

## How It Works

When bypass is enabled:

- A "Skip OAuth (Development)" button appears on the sign-in page
- Clicking it creates a mock user session with the following details:
  - **ID**: `dev-user-1`
  - **Email**: `dev@example.com`
  - **Name**: `Development User`
- The session is stored in localStorage and lasts for 7 days
- All protected routes will accept this bypass session as valid

## Features

- **Automatic fallback**: If bypass is disabled, normal OAuth flow is used
- **Session management**: Bypass sessions are properly managed and can be signed
  out
- **Visual indicators**: Clear warnings show when bypass mode is active
- **Temporary storage**: Uses localStorage for simple session management

## To Disable

Simply remove or set to `false` in your `.env.local`:

```env
AUTH_BYPASS="false"
NEXT_PUBLIC_AUTH_BYPASS="false"
```

Or comment out the lines entirely.

## Usage

1. **Enable bypass** (as shown above)
2. **Visit signin page** at `http://localhost:3000/auth/signin`
3. **Click "Skip OAuth (Development)"** button
4. **You'll be redirected** to the home page as an authenticated user
5. **Build and test** your migration features without OAuth setup

## When to Use

- Setting up the project for the first time
- Working on migration logic without Salesforce access
- Testing UI components that require authentication
- Rapid prototyping and development
- When OAuth setup is not yet complete

## Production Safety

- Environment variables are checked on both server and client
- Feature is completely disabled when env vars are not set
- No bypass code runs in production builds
- Clear visual warnings prevent accidental use

## Troubleshooting

**Bypass button not showing:**

- Check that both environment variables are set to `"true"`
- Ensure you've restarted the development server
- Verify the variables are in `.env.local` (not `.env`)

**Session not persisting:**

- Check browser localStorage for `dev-bypass-session`
- Clear localStorage and try creating a new bypass session
- Ensure the session hasn't expired (7-day limit)

**Still redirected to signin:**

- Check browser console for any errors
- Verify the bypass session is being created successfully
- Try clearing all browser data and starting fresh

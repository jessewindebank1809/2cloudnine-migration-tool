# Authentication Setup

This application uses Salesforce OAuth for authentication with Better Auth
session management.

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
# Database
DATABASE_URL="postgresql://localhost:5432/tc9_migration_tool"

# Better Auth Configuration
BETTER_AUTH_SECRET="your-secret-key-here-replace-in-production"
BETTER_AUTH_URL="http://localhost:3000"

# Salesforce OAuth (for authentication)
SALESFORCE_CLIENT_ID="your_consumer_key_from_connected_app"
SALESFORCE_CLIENT_SECRET="your_consumer_secret_from_connected_app"

# Public environment variables (exposed to browser)
NEXT_PUBLIC_SALESFORCE_CLIENT_ID="your_consumer_key_from_connected_app"
```

## Database Setup

1. Make sure PostgreSQL is running
2. Create the database:
   ```sql
   CREATE DATABASE tc9_migration_tool;
   ```
3. Run the migration:
   ```bash
   npx prisma migrate dev
   ```

## Features

- **Salesforce OAuth Authentication**: Users sign in with their Salesforce
  credentials
- **Single Sign-On**: Seamless integration with existing Salesforce
  organisations
- **Session Management**: Secure session handling with manual token management
- **User-Specific Data**: Each user only sees their own organisations and
  migrations
- **Protected Routes**: Automatic redirection to sign-in for unauthenticated
  users

## Usage

1. Navigate to `/auth/signup` to create an account
2. Or go to `/auth/signin` to sign in with existing credentials
3. Once authenticated, users are redirected to `/dashboard`
4. All organisations and migrations are scoped to the authenticated user

## API Authentication

All API routes that handle user data require authentication:

- `GET /api/organisations` - Returns only the user's organisations
- `POST /api/organisations` - Creates organisations for the authenticated user
- `DELETE /api/organisations/[id]` - Only allows deletion of user's own
  organisations

The authentication is handled automatically by the Better Auth middleware.

# 2cloudnine Migration Tool - Claude Code Configuration

## Project Overview
A standalone Next.js web application for Salesforce data migration between 2cloudnine product objects. Built with TypeScript, React 19, and modern tooling.

## Development Commands
- **Start dev server**: `npm run dev`
- **Start with fresh env**: `npm run dev:fresh:env`
- **Build**: `npm run build`
- **Type check**: `npm run type-check`
- **Lint**: `npm run lint`
- **Tests**: `npm test`
- **Test coverage**: `npm run test:coverage`
- **E2E tests**: `npm run test:e2e`

## Database Commands
- **Generate Prisma client**: `npm run db:generate`
- **Push schema**: `npm run db:push`
- **Run migrations**: `npm run db:migrate`
- **Open Prisma Studio**: `npm run db:studio`

## Key Technologies
- **Frontend**: Next.js 15, React 19, TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Auth**: Salesforce OAuth with Better Auth
- **Styling**: Tailwind CSS, shadcn/ui
- **Testing**: Jest, Testing Library
- **Deployment**: Docker, Fly.io

## Project Structure
- `src/app/` - Next.js app router pages and API routes
- `src/components/` - React components (features, ui, layout)
- `src/lib/` - Core libraries (auth, database, salesforce, migration)
- `src/hooks/` - Custom React hooks
- `src/types/` - TypeScript type definitions
- `prisma/` - Database schema and migrations
- `tests/` - Unit, integration, and E2E tests

## Important Files
- **Database schema**: `prisma/schema.prisma`
- **Migration engine**: `src/lib/migration/migration-engine.ts`
- **Salesforce client**: `src/lib/salesforce/client.ts`
- **Auth configuration**: `src/lib/auth.ts`

## Environment Setup
Requires `.env` file with DATABASE_URL, Salesforce OAuth credentials, and Better Auth configuration.

## Testing
- **Unit tests**: `npm test` (Jest with Testing Library)
- **E2E tests**: `npm run test:e2e:puppeteer` (Comprehensive Puppeteer test suite)
- **Individual E2E tests**: `npm run test:e2e:auth`, `npm run test:e2e:migrations`, etc.
- **Test server**: `npm run test:e2e:server` (Starts dev server for E2E testing)
- **Debug mode**: `npm run test:e2e:puppeteer:debug` (Non-headless with console output)

## Quality Assurance
Always run `npm run lint` and `npm run type-check` after making changes.

## E2E Testing Architecture
Complete Puppeteer test suite in `tests/e2e/puppeteer/` covering:
- Authentication flows with Salesforce OAuth
- Migration workflow testing
- Organization management
- Template functionality
- Analytics dashboard
- Error handling scenarios
- Performance validation
- Cross-browser compatibility

Test environment configured with real Salesforce credentials for end-to-end validation.
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Project Overview

TC9 Migration Tool is a Next.js web application for migrating data between
2cloudnine product objects in Salesforce. It uses pre-built templates for common
migration scenarios. Hosted on fly.io

## Key Commands

### Development

```bash
npm run dev                # Start development server on port 3000
npm run dev:fresh:env      # Dev server with clean environment
npm run type-check         # TypeScript type checking
npm run lint              # Run ESLint
```

### Testing

```bash
npm test                   # Run all unit tests
npm test -- --watch       # Run tests in watch mode
npm test -- path/to/file  # Run specific test file
npm run test:coverage     # Generate test coverage report
npm run test:e2e:puppeteer # Run E2E tests
```

### Database

```bash
npm run db:generate       # Generate Prisma client after schema changes
npm run db:push          # Push schema changes to database
npm run db:migrate       # Run database migrations
npm run db:studio        # Open Prisma Studio for database inspection
```

### Deployment

```bash
npm run deploy:staging    # Deploy to staging (runs tests first)
npm run deploy:production # Deploy to production (runs tests first)
npm run deploy:quick     # Deploy without running tests
npm run logs:live        # Monitor live deployment logs
```

## Architecture Overview

### Core Architecture Pattern

The application follows a template-based migration architecture where:

1. **Migration Templates** define transformation rules and field mappings
2. **Validation Engine** ensures data integrity before migration
3. **ETL Pipeline** handles Extract, Transform, Load operations
4. **Session Manager** maintains secure Salesforce connections

### Key Components

#### Migration Engine (`src/lib/migration/`)

- **templates/core/**: Core interfaces and validation engine
- **templates/definitions/**: Pre-built migration templates (e.g., payroll,
  time)
- **utils/**: Utilities for external IDs, field mapping, etc.

#### Salesforce Integration (`src/lib/salesforce/`)

- **client.ts**: Wrapped jsforce client with rate limiting
- **session-manager.ts**: Manages multiple org connections securely
- **metadata.ts**: Handles Salesforce metadata operations

#### Authentication (`src/lib/auth/`)

- Uses Better Auth with Salesforce OAuth
- Supports both production and sandbox environments
- Encrypted session storage for access tokens

### Template System

Migration templates are TypeScript objects that define:

```typescript
{
  etlSteps: [ // Sequential migration steps
    {
      extractConfig, // SOQL queries for data extraction
      transformConfig, // Field mappings and transformations
      loadConfig, // Target object and operation type
      validationConfig, // Pre-migration validation rules
    },
  ];
}
```

### Validation Architecture

The ValidationEngine runs three types of checks:

1. **Dependency Checks**: Ensures related records exist in target
2. **Data Integrity Checks**: Validates data quality rules
3. **Picklist Validation**: Validates picklist values against target org

### API Routes Pattern

- `/api/auth/*`: Authentication endpoints
- `/api/organisations/*`: Salesforce org management
- `/api/migrations/*`: Migration operations
- `/api/sessions/*`: Session management

## Development Workflow

### Adding New Migration Templates

1. Create template in `src/lib/migration/templates/definitions/`
2. Register in `src/lib/migration/templates/registry.ts`
3. Add tests in `tests/unit/templates/`

### Modifying Validation Logic

- Core validation: `src/lib/migration/templates/core/validation-engine.ts`
- Add new validation types to `interfaces.ts`
- Update templates to include new validation configs

### Working with Salesforce APIs

- Always use `sessionManager.getClient()` for API calls
- Rate limiting is automatic via the wrapped client
- Handle both managed and unmanaged package scenarios

## Important Patterns

### External ID Handling

The system auto-detects external ID fields with fallback logic:

1. Check for `tc9_edc__External_ID_Data_Creation__c` (managed)
2. Check for `External_ID_Data_Creation__c` (unmanaged)
3. Fall back to `External_Id__c`

### Error Handling

- All Salesforce API errors are wrapped with context
- Migration errors include rollback capability
- Validation errors prevent migration from starting

### Performance Considerations

- Bulk API used for large data volumes
- Validation runs on sample data (max 1000 records)
- Progress tracking via Redis-backed job queue

## Deployment Notes

- Always let Github Actions deploy to Fly.io
- Github actions invokes deployments to Fly.io when deployments are success to
  staging/main
- Staging deployments triggered by pushes to `staging` branch
- Production requires explicit GitHub Action trigger
- Fly.io deployment uses Docker containers
- Environment variables managed via Fly secrets

## Github Repo

- Here is the repo link:
  https://github.com/jessewindebank1809/2cloudnine-migration-tool
- Always use the gh cli to interact with the repo
- Code should also follow this release cycle: staging > main

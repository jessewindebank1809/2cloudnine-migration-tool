# Performance Indexes Migration

This directory contains manual migration scripts for adding database indexes to improve query performance (Issue #33).

## Files

- `add_performance_indexes.sql` - Adds 11 indexes across 4 tables
- `rollback_performance_indexes.sql` - Removes all indexes if needed

## How to Apply

### Development
```bash
# Set DATABASE_URL environment variable
export DATABASE_URL="postgresql://user:password@localhost:5432/dbname"

# Generate and apply migration using Prisma
npx prisma migrate dev --name add_performance_indexes
```

### Production
```bash
# Apply indexes using CONCURRENTLY to avoid locking tables
psql $DATABASE_URL -f prisma/migrations/manual/add_performance_indexes.sql

# Or apply through Prisma after setting DATABASE_URL
npx prisma migrate deploy
```

## Indexes Added

1. **User table**
   - `role` - For admin permission checks

2. **migration_records table**
   - `session_id` - Primary lookup key
   - `object_type` - Filtering by object type
   - `(session_id, status)` - Common composite query
   - `created_at` - Time-based queries

3. **migration_sessions table**
   - `project_id` - Foreign key lookups
   - `status` - Status filtering
   - `created_at` - Sorting and time queries
   - `(project_id, status)` - Composite queries

4. **organisations table**
   - `user_id` - User-specific queries
   - `instance_url` - URL lookups

## Performance Impact

These indexes target the most frequently executed queries in the application:
- Expected improvement: 50-100x for indexed queries
- Reduces database CPU usage
- Improves page load times
- Better scalability as data grows

## Rollback

If needed, run the rollback script:
```bash
psql $DATABASE_URL -f prisma/migrations/manual/rollback_performance_indexes.sql
```
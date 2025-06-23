## Logs

- `/Users/jessewindebank/Documents/code/salesforce/tc9-migration-tool/migration-output.log` -
  API log output

## API Testing

### Validation Endpoint
- The curl command tests the `/api/migrations/validate` endpoint for migration
  tool validation
  - Validates migration readiness by checking for:
    - Missing dependencies
    - Invalid data
    - Missing external IDs
  - Example command checks migration of a payroll interpretation rule
  - Includes variations for parsing response using jq:
    - Get full response
    - Extract only error issues
    - Get validation summary
    - Retrieve specific issue fields

  curl -s http://localhost:3000/api/migrations/validate\
  -X POST\
  -H "Content-Type: application/json"\
  -d '{ "sourceOrgId":"e66651a1-6ee6-474d-8729-3da3daa59592",
  "targetOrgId":"878bd9a6-c1eb-4016-9d6a-e244a6c9f20a",
  "selectedRecords":["a14QE000003bHMjYAM"],
  "templateId":"payroll-interpretation-rules" }'

### Test Execution Endpoint
- Test endpoint for executing migrations without authentication:
```bash
curl -X POST http://localhost:3000/api/migrations/test-execute \
  -H "Content-Type: application/json" \
  -d '{"migrationId": "MIGRATION_ID_HERE"}' | jq
```

## Deployment

- `https://tc9-migration-tool.fly.dev` = prod
- `https://tc9-migration-tool-staging.fly.dev` = staging
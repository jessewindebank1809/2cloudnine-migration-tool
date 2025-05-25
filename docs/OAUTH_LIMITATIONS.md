# Salesforce OAuth Cross-Org Limitations

## The Problem

Salesforce Connected Apps are **org-specific**. A Connected App in one org
cannot authenticate users from another org.

## What Doesn't Work

```
❌ Scratch Org Connected App → Production Org Users
❌ Scratch Org Connected App → Sandbox Org Users  
❌ Production Connected App → Scratch Org Users
```

## Authentication Flow Reality

### Scenario 1: User from Production Org

```
User: "I want to connect my production org"
App: Redirects to login.salesforce.com/services/oauth2/authorize
Salesforce: "Unknown client_id" (because Connected App is in scratch org)
Result: ❌ FAIL
```

### Scenario 2: User from Sandbox Org

```
User: "I want to connect my sandbox org"
App: Redirects to test.salesforce.com/services/oauth2/authorize  
Salesforce: "Unknown client_id" (because Connected App is in scratch org)
Result: ❌ FAIL
```

### Scenario 3: User from Same Scratch Org

```
User: "I want to connect my scratch org" (same as app's org)
App: Redirects to site-site-6377-dev-ed.scratch.my.salesforce.com/services/oauth2/authorize
Salesforce: "Valid client_id" ✅
Result: ✅ SUCCESS
```

## Realistic Solutions

### Option 1: Multiple Connected Apps (Current Standard)

```
Production Org: Connected App A (client_id_prod)
Sandbox Org: Connected App B (client_id_sandbox)  
Scratch Org: Connected App C (client_id_scratch)
```

**Pros:**

- Works for all org types
- Standard approach

**Cons:**

- Requires setup in each client org
- Not truly "zero-install"

### Option 2: AppExchange App

```
Publish as managed package on AppExchange
Users install from AppExchange
Automatic Connected App creation
```

**Pros:**

- True cross-org support
- Professional distribution

**Cons:**

- Requires AppExchange approval
- More complex development

### Option 3: Production-Centric Approach

```
Create Connected App in Production Org
Use login.salesforce.com as primary endpoint
Limited sandbox/scratch support
```

**Pros:**

- Supports most production use cases

**Cons:**

- Limited sandbox support
- No scratch org support

## Recommended Approach for Development

For development and testing, use **Option 1** with dynamic Connected App
creation:

1. **Detect org type** from instance URL
2. **Guide user** through Connected App setup
3. **Store credentials** per org type
4. **Route OAuth** to correct endpoints

This maintains the "minimal setup" goal while working within Salesforce's
constraints.

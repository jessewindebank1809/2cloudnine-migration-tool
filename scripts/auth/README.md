# Authentication Test Scripts

This directory contains scripts to test authentication flows in the TC9
Migration Tool.

## Logout Flow Test

The `test-logout-flow.js` script uses Puppeteer to observe and test the logout
functionality.

### Prerequisites

1. Make sure your development server is running:
   ```bash
   npm run dev
   ```

2. Sign in to the application at `http://localhost:3000`

### Running the Test

```bash
# Make the script executable (first time only)
chmod +x scripts/auth/run-logout-test.sh

# Run the test
./scripts/auth/run-logout-test.sh
```

Or run directly with Node:

```bash
node scripts/auth/test-logout-flow.js
```

### What the Test Does

1. **Navigation**: Opens the home page and checks if you're authenticated
2. **State Check**: Examines cookies, localStorage, and sessionStorage before
   logout
3. **Logout Process**: Finds and clicks the logout button, monitors network
   requests
4. **Post-Logout Check**: Verifies cookies and storage are cleared
5. **Effectiveness Test**: Attempts to access protected pages to confirm logout
   worked
6. **Manual Inspection**: Keeps the browser open for you to manually inspect

### Expected Behaviour

- After clicking logout, you should be redirected to `/auth/signin`
- All authentication cookies should be cleared
- localStorage and sessionStorage should be cleared
- Attempting to access protected pages should redirect to signin

### Troubleshooting

If the test fails to find the logout button, make sure:

- You're signed in to the application
- The page has fully loaded
- The logout button (with LogOut icon) is visible in the header

The browser will remain open after the test for manual inspection. Press Ctrl+C
to close it.

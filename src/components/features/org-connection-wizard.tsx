'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type AuthMethod = 'oauth' | 'username' | 'sfdx'

interface OrgConnectionWizardProps {
  onComplete: (orgData: any) => void
}

export function OrgConnectionWizard({ onComplete }: OrgConnectionWizardProps) {
  const [authMethod, setAuthMethod] = useState<AuthMethod | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [credentials, setCredentials] = useState({
    username: '',
    password: '',
    securityToken: '',
    orgUrl: 'https://login.salesforce.com'
  })

  const handleUsernameAuth = async () => {
    setIsLoading(true)
    try {
      // Call API to create Connected App
      const response = await fetch('/api/salesforce/setup-connected-app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      })
      
      const result = await response.json()
      if (result.success) {
        // Save the generated consumer key/secret
        await saveOrgConnection(result)
        onComplete(result)
      }
    } catch (error) {
      console.error('Setup failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleOAuthFlow = async () => {
    // Traditional OAuth flow - redirect to Salesforce
    window.location.href = '/api/auth/salesforce'
  }

  const handleSFDXAuth = async () => {
    setIsLoading(true)
    try {
      // Use SFDX CLI for authentication
      const response = await fetch('/api/salesforce/sfdx-auth', {
        method: 'POST'
      })
      const result = await response.json()
      if (result.success) {
        onComplete(result)
      }
    } catch (error) {
      console.error('SFDX auth failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const saveOrgConnection = async (connectionData: any) => {
    // Save to database
    await fetch('/api/organisations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(connectionData)
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Connect Salesforce Organisation</CardTitle>
          <CardDescription>
            Choose how you&apos;d like to authenticate. We&apos;ll automatically set up everything needed for migrations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!authMethod ? (
            <div className="space-y-4">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => setAuthMethod('username')}
              >
                <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Username & Password (Quick Setup)
                <span className="ml-auto text-xs text-muted-foreground">Recommended</span>
              </Button>
              
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => setAuthMethod('oauth')}
              >
                <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                OAuth 2.0 (Existing Connected App)
              </Button>
              
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => setAuthMethod('sfdx')}
              >
                <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-11 11-11-11 3-3m2-2l7-7 7 7" />
                </svg>
                Salesforce CLI (SFDX)
              </Button>
            </div>
          ) : authMethod === 'username' ? (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Username</label>
                <input
                  type="email"
                  className="w-full mt-1 px-3 py-2 border rounded-md"
                  value={credentials.username}
                  onChange={(e) => setCredentials({...credentials, username: e.target.value})}
                  placeholder="user@company.com"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">Password</label>
                <input
                  type="password"
                  className="w-full mt-1 px-3 py-2 border rounded-md"
                  value={credentials.password}
                  onChange={(e) => setCredentials({...credentials, password: e.target.value})}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">Security Token (optional)</label>
                <input
                  type="text"
                  className="w-full mt-1 px-3 py-2 border rounded-md"
                  value={credentials.securityToken}
                  onChange={(e) => setCredentials({...credentials, securityToken: e.target.value})}
                  placeholder="Leave blank if IP is whitelisted"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">Instance</label>
                <select
                  className="w-full mt-1 px-3 py-2 border rounded-md"
                  value={credentials.orgUrl}
                  onChange={(e) => setCredentials({...credentials, orgUrl: e.target.value})}
                >
                  <option value="https://login.salesforce.com">Production / Developer</option>
                  <option value="https://test.salesforce.com">Sandbox</option>
                </select>
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setAuthMethod(null)}
                  disabled={isLoading}
                >
                  Back
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleUsernameAuth}
                  disabled={isLoading || !credentials.username || !credentials.password}
                >
                  {isLoading ? 'Setting up...' : 'Connect & Setup'}
                </Button>
              </div>
            </div>
          ) : authMethod === 'oauth' ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                You&apos;ll be redirected to Salesforce to authorise access. Make sure you have a Connected App already configured.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setAuthMethod(null)}>
                  Back
                </Button>
                <Button className="flex-1" onClick={handleOAuthFlow}>
                  Continue with Salesforce
                </Button>
              </div>
            </div>
          ) : authMethod === 'sfdx' ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Make sure you have Salesforce CLI installed. A browser window will open for authentication.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setAuthMethod(null)}>
                  Back
                </Button>
                <Button 
                  className="flex-1" 
                  onClick={handleSFDXAuth}
                  disabled={isLoading}
                >
                  {isLoading ? 'Authenticating...' : 'Authenticate with SFDX'}
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
      
      {authMethod === 'username' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">What happens next?</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="text-sm space-y-2 text-muted-foreground">
                              <li>1. We&apos;ll connect to your org using the provided credentials</li>
              <li>2. Automatically create a Connected App for ongoing OAuth access</li>
              <li>3. Set up necessary permissions and security settings</li>
              <li>4. Save the connection for future migrations</li>
            </ol>
            <p className="text-xs mt-4 text-muted-foreground">
              Your credentials are only used once for setup and are not stored.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 
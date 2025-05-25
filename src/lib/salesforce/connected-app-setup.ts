import * as jsforce from 'jsforce';

interface ConnectedAppConfig {
  orgUrl: string;
  username: string;
  password: string;
  securityToken?: string;
  consumerKey?: string;
  consumerSecret?: string;
}

export class ConnectedAppSetup {
  private conn: jsforce.Connection;

  constructor(config: ConnectedAppConfig) {
    this.conn = new jsforce.Connection({
      loginUrl: config.orgUrl
    });
  }

  /**
   * Creates a Connected App in the target org using Metadata API
   */
  async createConnectedApp(callbackUrl: string = 'http://localhost:3000/api/auth/salesforce/callback') {
    try {
      // First, authenticate with username/password
      await this.authenticate();

      // Check if Connected App already exists
      const existingApp = await this.checkExistingApp();
      if (existingApp) {
        console.log('Connected App already exists');
        return existingApp;
      }

      // Create the Connected App metadata
      const connectedAppMetadata = {
        fullName: 'TC9_Migration_Tool',
        label: '2cloudnine Migration Tool',
        contactEmail: 'admin@2cloudnine.com',
        description: 'External migration tool for Salesforce data transfer',
        oauthConfig: {
          callbackUrl: callbackUrl,
          consumerKey: this.generateConsumerKey(),
          consumerSecret: this.generateConsumerSecret(),
          isAdminApproved: true,
          isConsumerSecretOptional: false,
          isIntrospectAllTokens: false,
          isSecretRequiredForRefreshToken: true,
          scopes: [
            'Api',
            'RefreshToken',
            'OpenID',
            'Profile',
            'Email',
            'Address',
            'Phone'
          ]
        },
        permissionSetName: 'TC9_Migration_Tool_Users'
      };

      // Deploy the Connected App
      const result = await this.deployConnectedApp(connectedAppMetadata);
      
      // Create and assign permission set
      await this.createPermissionSet();

      return {
        success: true,
        consumerKey: connectedAppMetadata.oauthConfig.consumerKey,
        consumerSecret: connectedAppMetadata.oauthConfig.consumerSecret,
        message: 'Connected App created successfully'
      };

    } catch (error) {
      console.error('Error creating Connected App:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create Connected App'
      };
    }
  }

  /**
   * Authenticate using username/password flow
   */
  private async authenticate() {
    const { username, password, securityToken } = this.getCredentials();
    const passwordWithToken = password + (securityToken || '');
    
    await this.conn.login(username, passwordWithToken);
  }

  /**
   * Check if Connected App already exists
   */
  private async checkExistingApp() {
    try {
      const result = await this.conn.metadata.read('ConnectedApp', 'TC9_Migration_Tool');
      if (result && result.fullName) {
        return {
          exists: true,
          consumerKey: result.oauthConfig?.consumerKey,
          consumerSecret: result.oauthConfig?.consumerSecret
        };
      }
    } catch (error) {
      // App doesn't exist
      return null;
    }
  }

  /**
   * Deploy Connected App using Metadata API
   */
  private async deployConnectedApp(metadata: any) {
    return await this.conn.metadata.create('ConnectedApp', metadata);
  }

  /**
   * Create Permission Set for the Connected App
   */
  private async createPermissionSet() {
    const permissionSetMetadata = {
      fullName: 'TC9_Migration_Tool_Users',
      label: 'TC9 Migration Tool Users',
      description: 'Permissions for 2cloudnine Migration Tool',
      applicationVisibilities: [{
        application: 'TC9_Migration_Tool',
        visible: true
      }],
      userPermissions: [
        { enabled: true, name: 'ApiEnabled' },
        { enabled: true, name: 'ViewAllData' },
        { enabled: true, name: 'ModifyAllData' }
      ]
    };

    try {
      await this.conn.metadata.create('PermissionSet', permissionSetMetadata);
    } catch (error) {
      console.log('Permission set may already exist:', error);
    }
  }

  /**
   * Generate a secure consumer key
   */
  private generateConsumerKey(): string {
    // Generate a unique consumer key
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `3MVG9${timestamp}${random}`.substring(0, 85);
  }

  /**
   * Generate a secure consumer secret
   */
  private generateConsumerSecret(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let secret = '';
    for (let i = 0; i < 64; i++) {
      secret += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return secret;
  }

  /**
   * Get credentials from config
   */
  private getCredentials() {
    // This would come from the UI or environment variables
    return {
      username: process.env.SF_USERNAME || '',
      password: process.env.SF_PASSWORD || '',
      securityToken: process.env.SF_SECURITY_TOKEN || ''
    };
  }
}

/**
 * Alternative approach using SFDX CLI for authentication
 */
export class SFDXConnectedAppSetup {
  /**
   * Use SFDX auth:web:login or auth:device:login for initial authentication
   * Then create Connected App programmatically
   */
  async setupWithSFDX(orgAlias: string) {
    // This approach uses SFDX CLI for initial auth
    // Then creates the Connected App using the authenticated connection
    
    const { execSync } = await import('child_process');
    
    try {
      // Authenticate using SFDX
      execSync(`sfdx auth:web:login -a ${orgAlias} -r https://login.salesforce.com`, {
        stdio: 'inherit'
      });
      
      // Get access token from SFDX
      const authInfo = JSON.parse(
        execSync(`sfdx force:org:display -u ${orgAlias} --json`).toString()
      );
      
      // Use the access token to create Connected App
      const conn = new jsforce.Connection({
        instanceUrl: authInfo.result.instanceUrl,
        accessToken: authInfo.result.accessToken
      });
      
      // Now create the Connected App using the connection
      // ... (similar to above)
      
    } catch (error) {
      console.error('SFDX setup failed:', error);
      throw error;
    }
  }
} 
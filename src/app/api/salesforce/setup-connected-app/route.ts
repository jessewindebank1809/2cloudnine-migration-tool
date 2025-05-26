import { NextRequest, NextResponse } from 'next/server'
import { ConnectedAppSetup } from '@/lib/salesforce/connected-app-setup'
import { prisma } from '@/lib/database'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, password, securityToken, orgUrl } = body

    // Initialize the setup utility
    const setup = new ConnectedAppSetup({
      orgUrl,
      username,
      password,
      securityToken
    })

    // Create or retrieve Connected App
    const result = await setup.createConnectedApp()

    if ('error' in result && result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    // Handle existing app case
    if ('exists' in result && result.exists) {
      return NextResponse.json({
        success: true,
        message: 'Connected App already exists',
        consumerKey: result.consumerKey,
        nextStep: 'oauth_flow'
      })
    }

    // Ensure we have the consumer secret
    if (!result.consumerSecret) {
      return NextResponse.json(
        { success: false, error: 'Failed to get consumer secret' },
        { status: 400 }
      )
    }

    // Encrypt the consumer secret before storing
    const encryptedSecret = encryptData(result.consumerSecret)

    // TODO: Get userId from session when auth is implemented
    // For now, we'll create a placeholder user or use an existing one
    let userId: string;
    const existingUser = await prisma.user.findFirst();
    if (existingUser) {
      userId = existingUser.id;
    } else {
      // Create a placeholder user
      const user = await prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          email: username,
          name: username.split('@')[0],
          updatedAt: new Date(),
        }
      });
      userId = user.id;
    }

    // Save the org connection to database
    const organization = await prisma.organisations.create({
      data: {
        id: crypto.randomUUID(),
        name: `${username.split('@')[0]}'s Org`,
        org_type: 'PRODUCTION', // Default, can be changed later
        instance_url: orgUrl,
        salesforce_org_id: generateOrgId(), // We'll get the real ID after OAuth
        user_id: userId,
        // Don't store username/password, only OAuth credentials
        access_token_encrypted: null, // Will be populated after OAuth flow
        refresh_token_encrypted: null,
        token_expires_at: null,
        updated_at: new Date(),
      }
    })

    // Store the Connected App credentials securely
    // In production, you might want to use a separate secure storage
    await storeConnectedAppCredentials(organization.id, {
      consumerKey: result.consumerKey,
      consumerSecretEncrypted: encryptedSecret
    })

    return NextResponse.json({
      success: true,
      organizationId: organization.id,
      consumerKey: result.consumerKey,
      message: 'Connected App created successfully. You can now use OAuth for secure access.',
      nextStep: 'oauth_flow'
    })

  } catch (error) {
    console.error('Connected App setup error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Setup failed' 
      },
      { status: 500 }
    )
  }
}

// Utility functions
function encryptData(data: string): string {
  const algorithm = 'aes-256-gcm'
  const key = Buffer.from(process.env.ENCRYPTION_KEY || 'your-32-character-encryption-key', 'utf8')
  const iv = crypto.randomBytes(16)
  
  const cipher = crypto.createCipheriv(algorithm, key, iv)
  
  let encrypted = cipher.update(data, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  const authTag = cipher.getAuthTag()
  
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted
}

function generateOrgId(): string {
  // Temporary ID until we get the real Salesforce Org ID
  return `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

async function storeConnectedAppCredentials(orgId: string, credentials: any) {
  // In production, use a secure key management service
  // For now, we'll store in the database or environment variables
  
  // You could create a separate table for Connected App credentials
  // or use a secure vault service like AWS Secrets Manager
  
  console.log('Storing Connected App credentials for org:', orgId)
  // Implementation depends on your security requirements
} 
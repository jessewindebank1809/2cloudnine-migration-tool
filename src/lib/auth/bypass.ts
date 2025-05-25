// Client-side helper for development auth bypass

export const AUTH_BYPASS_ENABLED = process.env.NEXT_PUBLIC_AUTH_BYPASS === 'true'

export interface BypassSession {
  user: {
    id: string
    email: string
    name: string
    emailVerified: boolean
    image: string | null
    createdAt: Date
    updatedAt: Date
  }
  session: {
    id: string
    userId: string
    expiresAt: Date
    token: string
    ipAddress: string
    userAgent: string
  }
}

export const createBypassSession = async (): Promise<BypassSession | null> => {
  if (!AUTH_BYPASS_ENABLED) {
    console.warn('Auth bypass is not enabled')
    return null
  }

  try {
    console.log('Making request to /api/auth/bypass...')
    const response = await fetch('/api/auth/bypass', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    console.log('Response status:', response.status)
    console.log('Response ok:', response.ok)

    if (!response.ok) {
      throw new Error(`Failed to create bypass session: ${response.status}`)
    }

    const result = await response.json()
    console.log('API response result:', result)
    return result
  } catch (error) {
    console.error('Bypass session creation failed:', error)
    return null
  }
}

export const getBypassSession = (): BypassSession | null => {
  if (!AUTH_BYPASS_ENABLED) {
    return null
  }

  if (typeof window === 'undefined') {
    return null
  }

  try {
    // For development, we'll use localStorage for simplicity
    const sessionData = localStorage.getItem('dev-bypass-session')
    if (sessionData) {
      const parsed = JSON.parse(sessionData)
      // Check if session is expired
      if (new Date(parsed.session.expiresAt) > new Date()) {
        return parsed
      } else {
        localStorage.removeItem('dev-bypass-session')
      }
    }
  } catch (error) {
    console.error('Error reading bypass session:', error)
  }

  return null
}

export const setBypassSession = (session: BypassSession): void => {
  if (!AUTH_BYPASS_ENABLED) {
    return
  }

  if (typeof window === 'undefined') {
    return
  }

  try {
    localStorage.setItem('dev-bypass-session', JSON.stringify(session))
  } catch (error) {
    console.error('Error storing bypass session:', error)
  }
}

export const clearBypassSession = (): void => {
  if (typeof window === 'undefined') {
    return
  }

  try {
    localStorage.removeItem('dev-bypass-session')
  } catch (error) {
    console.error('Error clearing bypass session:', error)
  }
} 
import './setup';
import { POST } from '@/app/api/migrations/clone-pay-code/route';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session-helper';
import { CloningService } from '@/lib/migration/cloning-service';
import { usageTracker } from '@/lib/usage-tracker';

// Mock dependencies
jest.mock('next/server', () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    json: (data: any, init?: ResponseInit) => {
      return new Response(JSON.stringify(data), {
        ...init,
        headers: {
          'content-type': 'application/json',
          ...(init?.headers || {})
        }
      });
    }
  }
}));
jest.mock('@/lib/auth/session-helper');
jest.mock('@/lib/migration/cloning-service');
jest.mock('@/lib/usage-tracker');

describe('POST /api/migrations/clone-pay-code', () => {
  const mockAuthSession = {
    user: {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User'
    }
  };

  const mockRequest = (body: any) => {
    const request = new NextRequest('http://localhost:3000/api/migrations/clone-pay-code', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'cookie': 'better-auth.session_token=test-token'
      },
      body: JSON.stringify(body)
    });
    
    // Override json method to return our body
    request.json = jest.fn().mockResolvedValue(body);
    
    return request;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    (requireAuth as jest.Mock).mockResolvedValue(mockAuthSession);
    (usageTracker.trackEvent as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  describe('Successful cloning', () => {
    it('should successfully clone a pay code', async () => {
      const requestBody = {
        sourceOrgId: 'source-org-123',
        targetOrgId: 'target-org-456',
        payCodeId: 'a1234567890ABCDE'
      };

      const cloneResult = {
        success: true,
        recordId: 'b9876543210ZYXWV',
        externalId: 'a1234567890ABCDE',
        error: null
      };

      (CloningService.cloneRecord as jest.Mock).mockResolvedValue(cloneResult);

      const request = mockRequest(requestBody);
      const response = await POST(request);
      const data = await response.json();

      // Verify successful response
      expect(response.status).toBe(200);
      expect(data).toEqual({
        success: true,
        recordId: 'b9876543210ZYXWV',
        externalId: 'a1234567890ABCDE',
        message: 'Pay code cloned successfully'
      });

      // Verify CloningService was called correctly
      expect(CloningService.cloneRecord).toHaveBeenCalledWith({
        sourceOrgId: 'source-org-123',
        targetOrgId: 'target-org-456',
        sourceRecordId: 'a1234567890ABCDE',
        objectApiName: 'tc9_pr__Pay_Code__c'
      });

      // Verify usage tracking
      expect(usageTracker.trackEvent).toHaveBeenCalledWith({
        eventType: 'pay_code_cloned',
        userId: 'user-123',
        metadata: {
          sourceOrgId: 'source-org-123',
          targetOrgId: 'target-org-456',
          payCodeId: 'a1234567890ABCDE',
          success: true,
          error: null
        }
      });
    });

    it('should handle cloning with custom success message', async () => {
      const cloneResult = {
        success: true,
        recordId: 'b9876543210ZYXWV',
        externalId: 'a1234567890ABCDE',
        error: 'Record already exists in target org'
      };

      (CloningService.cloneRecord as jest.Mock).mockResolvedValue(cloneResult);

      const request = mockRequest({
        sourceOrgId: 'source-org-123',
        targetOrgId: 'target-org-456',
        payCodeId: 'a1234567890ABCDE'
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Record already exists in target org');
    });
  });

  describe('Authentication failures', () => {
    it('should return 500 when authentication fails', async () => {
      (requireAuth as jest.Mock).mockRejectedValue(new Error('Unauthorized'));

      const request = mockRequest({
        sourceOrgId: 'source-org-123',
        targetOrgId: 'target-org-456',
        payCodeId: 'a1234567890ABCDE'
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        error: 'Failed to clone pay code',
        details: 'Unauthorized'
      });
    });
  });

  describe('Missing parameters', () => {
    it('should return 400 when sourceOrgId is missing', async () => {
      const request = mockRequest({
        targetOrgId: 'target-org-456',
        payCodeId: 'a1234567890ABCDE'
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({
        error: 'Missing required parameters: sourceOrgId, targetOrgId, and payCodeId are required'
      });
    });

    it('should return 400 when targetOrgId is missing', async () => {
      const request = mockRequest({
        sourceOrgId: 'source-org-123',
        payCodeId: 'a1234567890ABCDE'
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({
        error: 'Missing required parameters: sourceOrgId, targetOrgId, and payCodeId are required'
      });
    });

    it('should return 400 when payCodeId is missing', async () => {
      const request = mockRequest({
        sourceOrgId: 'source-org-123',
        targetOrgId: 'target-org-456'
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({
        error: 'Missing required parameters: sourceOrgId, targetOrgId, and payCodeId are required'
      });
    });
  });

  describe('Cloning service errors', () => {
    it('should return 500 when cloning fails', async () => {
      const cloneResult = {
        success: false,
        recordId: null,
        externalId: null,
        error: 'Failed to create record in target org'
      };

      (CloningService.cloneRecord as jest.Mock).mockResolvedValue(cloneResult);

      const request = mockRequest({
        sourceOrgId: 'source-org-123',
        targetOrgId: 'target-org-456',
        payCodeId: 'a1234567890ABCDE'
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        success: false,
        error: 'Failed to create record in target org'
      });
    });

    it('should handle cloning service exceptions', async () => {
      (CloningService.cloneRecord as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      const request = mockRequest({
        sourceOrgId: 'source-org-123',
        targetOrgId: 'target-org-456',
        payCodeId: 'a1234567890ABCDE'
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        error: 'Failed to clone pay code',
        details: 'Network error'
      });
    });
  });

  describe('Session token expiration', () => {
    it('should return 401 with invalid_grant error', async () => {
      const cloneResult = {
        success: false,
        error: 'invalid_grant: authentication failure'
      };

      (CloningService.cloneRecord as jest.Mock).mockResolvedValue(cloneResult);

      const request = mockRequest({
        sourceOrgId: 'source-org-123',
        targetOrgId: 'target-org-456',
        payCodeId: 'a1234567890ABCDE'
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({
        error: 'Authentication token has expired. Please reconnect the organisation.',
        code: 'TOKEN_EXPIRED',
        reconnectUrl: '/orgs'
      });
    });

    it('should return 401 with expired token error', async () => {
      const cloneResult = {
        success: false,
        error: 'Token has expired'
      };

      (CloningService.cloneRecord as jest.Mock).mockResolvedValue(cloneResult);

      const request = mockRequest({
        sourceOrgId: 'source-org-123',
        targetOrgId: 'target-org-456',
        payCodeId: 'a1234567890ABCDE'
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({
        error: 'Authentication token has expired. Please reconnect the organisation.',
        code: 'TOKEN_EXPIRED',
        reconnectUrl: '/orgs'
      });
    });

    it('should return 401 with INVALID_SESSION_ID error', async () => {
      const cloneResult = {
        success: false,
        error: 'INVALID_SESSION_ID: Session expired or invalid'
      };

      (CloningService.cloneRecord as jest.Mock).mockResolvedValue(cloneResult);

      const request = mockRequest({
        sourceOrgId: 'source-org-123',
        targetOrgId: 'target-org-456',
        payCodeId: 'a1234567890ABCDE'
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({
        error: 'Authentication token has expired. Please reconnect the organisation.',
        code: 'TOKEN_EXPIRED',
        reconnectUrl: '/orgs'
      });
    });
  });

  describe('Usage tracking', () => {
    it('should continue processing even if usage tracking fails', async () => {
      const cloneResult = {
        success: true,
        recordId: 'b9876543210ZYXWV',
        externalId: 'a1234567890ABCDE'
      };

      (CloningService.cloneRecord as jest.Mock).mockResolvedValue(cloneResult);
      (usageTracker.trackEvent as jest.Mock).mockRejectedValue(
        new Error('Tracking service unavailable')
      );

      // console.error is already mocked in beforeEach
      const consoleSpy = console.error as jest.Mock;

      const request = mockRequest({
        sourceOrgId: 'source-org-123',
        targetOrgId: 'target-org-456',
        payCodeId: 'a1234567890ABCDE'
      });

      const response = await POST(request);
      const data = await response.json();

      // Should still return success
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Should log the error
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to track cloning event:',
        expect.any(Error)
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle invalid JSON in request', async () => {
      const request = new NextRequest('http://localhost:3000/api/migrations/clone-pay-code', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'cookie': 'better-auth.session_token=test-token'
        },
        body: 'invalid json'
      });
      
      // Override json method to throw error
      request.json = jest.fn().mockRejectedValue(new Error('Invalid JSON'));

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        error: 'Failed to clone pay code',
        details: 'Invalid JSON'
      });
    });

    it('should handle non-Error exceptions', async () => {
      (CloningService.cloneRecord as jest.Mock).mockRejectedValue('String error');

      const request = mockRequest({
        sourceOrgId: 'source-org-123',
        targetOrgId: 'target-org-456',
        payCodeId: 'a1234567890ABCDE'
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        error: 'Failed to clone pay code',
        details: 'Unknown error'
      });
    });
  });
});
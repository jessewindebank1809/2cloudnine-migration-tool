import { NextRequest, NextResponse } from 'next/server';
import { CloningService } from '@/lib/migration/cloning-service';
import { sessionManager } from '@/lib/salesforce/session-manager';
import { ExternalIdUtils } from '@/lib/migration/templates/utils/external-id-utils';
import { usageTracker } from '@/lib/usage-tracker';
import { requireAuth } from '@/lib/auth/session-helper';

// Import the route handlers directly
import { POST as clonePayCodeHandler } from '@/app/api/migrations/clone-pay-code/route';
import { POST as cloneLeaveRuleHandler } from '@/app/api/migrations/clone-leave-rule/route';

// Mock dependencies
jest.mock('@/lib/salesforce/session-manager');
jest.mock('@/lib/migration/templates/utils/external-id-utils');
jest.mock('@/lib/usage-tracker');
jest.mock('@/lib/auth/session-helper');

describe('Clone Workflow Integration Tests', () => {
  const mockSourceClient = {
    query: jest.fn(),
    describe: jest.fn(),
    sobject: jest.fn()
  };
  
  const mockTargetClient = {
    query: jest.fn(),
    describe: jest.fn(),
    sobject: jest.fn()
  };

  const mockAuthSession = {
    user: {
      id: 'test-user-id',
      email: 'test@example.com'
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup auth mocks
    (requireAuth as jest.Mock).mockResolvedValue(mockAuthSession);
    
    // Setup session manager mocks
    (sessionManager.getClient as jest.Mock).mockImplementation((orgId: string) => {
      if (orgId === 'source-org-123') return mockSourceClient;
      if (orgId === 'target-org-456') return mockTargetClient;
      throw new Error('Unknown org ID');
    });
    
    // Setup external ID detection mocks
    (ExternalIdUtils.detectExternalIdField as jest.Mock).mockImplementation((obj: string, client: any) => {
      if (client === mockSourceClient) return 'External_ID_Data_Creation__c';
      if (client === mockTargetClient) return 'tc9_edc__External_ID_Data_Creation__c';
      return 'External_ID_Data_Creation__c';
    });

    // Setup usage tracker mock
    (usageTracker.trackEvent as jest.Mock).mockResolvedValue(undefined);
  });

  describe('Pay Code Cloning', () => {
    let mockCreate: jest.Mock;
    
    const setupPayCodeMocks = (sourcePayCode: any, targetExists: boolean = false) => {
      // Source client mocks
      mockSourceClient.describe.mockResolvedValue({
        fields: [
          { name: 'Id', type: 'id', createable: false, updateable: false },
          { name: 'Name', type: 'string', createable: true, updateable: true },
          { name: 'Rate__c', type: 'double', createable: true, updateable: true },
          { name: 'Type__c', type: 'picklist', createable: true, updateable: true },
          { name: 'Active__c', type: 'boolean', createable: true, updateable: true },
          { name: 'Description__c', type: 'textarea', createable: true, updateable: true },
          { name: 'External_ID_Data_Creation__c', type: 'string', createable: true, updateable: true }
        ]
      });
      
      mockSourceClient.query.mockResolvedValue({
        records: [sourcePayCode]
      });
      
      // Target client mocks
      mockTargetClient.describe.mockResolvedValue({
        fields: [
          { name: 'Id', type: 'id', createable: false, updateable: false },
          { name: 'Name', type: 'string', createable: true, updateable: true },
          { name: 'tc9_pr__Rate__c', type: 'double', createable: true, updateable: true },
          { name: 'tc9_pr__Type__c', type: 'picklist', createable: true, updateable: true },
          { name: 'tc9_pr__Active__c', type: 'boolean', createable: true, updateable: true },
          { name: 'tc9_pr__Description__c', type: 'textarea', createable: true, updateable: true },
          { name: 'tc9_edc__External_ID_Data_Creation__c', type: 'string', createable: true, updateable: true }
        ]
      });
      
      // Mock target query - check if record exists
      if (targetExists) {
        mockTargetClient.query.mockResolvedValue({
          records: [{
            Id: 'existing-target-id',
            'tc9_edc__External_ID_Data_Creation__c': sourcePayCode.Id
          }]
        });
      } else {
        mockTargetClient.query.mockResolvedValue({ records: [] });
      }
      
      // Mock successful creation
      mockCreate = jest.fn().mockResolvedValue({
        success: true,
        id: 'new-target-id'
      });
      mockTargetClient.sobject.mockReturnValue({
        create: mockCreate
      });
    };

    it('should successfully clone a pay code through the API endpoint', async () => {
      const sourcePayCode = {
        Id: 'a1234567890ABCDE',
        Name: 'Standard Hours',
        External_ID_Data_Creation__c: 'a1234567890ABCDE',
        Rate__c: 25.50,
        Type__c: 'Standard',
        Active__c: true,
        Description__c: 'Standard hourly rate'
      };
      
      setupPayCodeMocks(sourcePayCode);
      
      // Create request
      const request = new NextRequest('http://localhost:3000/api/migrations/clone-pay-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceOrgId: 'source-org-123',
          targetOrgId: 'target-org-456',
          payCodeId: 'a1234567890ABCDE'
        })
      });
      
      // Execute the API call
      const response = await clonePayCodeHandler(request);
      const result = await response.json();
      
      // Verify successful response
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.recordId).toBe('new-target-id');
      expect(result.externalId).toBe('a1234567890ABCDE');
      expect(result.message).toBe('Pay code cloned successfully');
      
      // Verify the cloning service was called correctly
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        Name: 'Standard Hours',
        'tc9_pr__Rate__c': 25.50,
        'tc9_pr__Type__c': 'Standard',
        'tc9_pr__Active__c': true,
        'tc9_pr__Description__c': 'Standard hourly rate',
        'tc9_edc__External_ID_Data_Creation__c': 'a1234567890ABCDE'
      }));
      
      // Verify usage tracking
      expect(usageTracker.trackEvent).toHaveBeenCalledWith({
        eventType: 'pay_code_cloned',
        userId: 'test-user-id',
        metadata: {
          sourceOrgId: 'source-org-123',
          targetOrgId: 'target-org-456',
          payCodeId: 'a1234567890ABCDE',
          success: true,
          error: undefined
        }
      });
    });

    it('should handle cross-environment field mapping correctly', async () => {
      const sourcePayCode = {
        Id: 'a1234567890ABCDE',
        Name: 'Overtime',
        'tc9_edc__External_ID_Data_Creation__c': 'a1234567890ABCDE',
        'tc9_pr__Rate__c': 38.25,
        'tc9_pr__Type__c': 'Overtime',
        'tc9_pr__Active__c': true,
        'tc9_pr__Description__c': 'Overtime rate'
      };
      
      // Setup source as managed package
      mockSourceClient.describe.mockResolvedValue({
        fields: [
          { name: 'Id', type: 'id', createable: false, updateable: false },
          { name: 'Name', type: 'string', createable: true, updateable: true },
          { name: 'tc9_pr__Rate__c', type: 'double', createable: true, updateable: true },
          { name: 'tc9_pr__Type__c', type: 'picklist', createable: true, updateable: true },
          { name: 'tc9_pr__Active__c', type: 'boolean', createable: true, updateable: true },
          { name: 'tc9_pr__Description__c', type: 'textarea', createable: true, updateable: true },
          { name: 'tc9_edc__External_ID_Data_Creation__c', type: 'string', createable: true, updateable: true }
        ]
      });
      
      mockSourceClient.query.mockResolvedValue({
        records: [sourcePayCode]
      });
      
      // Setup target as unmanaged
      (ExternalIdUtils.detectExternalIdField as jest.Mock).mockImplementation((obj: string, client: any) => {
        if (client === mockTargetClient) return 'External_ID_Data_Creation__c';
        return 'tc9_edc__External_ID_Data_Creation__c';
      });
      
      mockTargetClient.describe.mockResolvedValue({
        fields: [
          { name: 'Id', type: 'id', createable: false, updateable: false },
          { name: 'Name', type: 'string', createable: true, updateable: true },
          { name: 'Rate__c', type: 'double', createable: true, updateable: true },
          { name: 'Type__c', type: 'picklist', createable: true, updateable: true },
          { name: 'Active__c', type: 'boolean', createable: true, updateable: true },
          { name: 'Description__c', type: 'textarea', createable: true, updateable: true },
          { name: 'External_ID_Data_Creation__c', type: 'string', createable: true, updateable: true }
        ]
      });
      
      mockTargetClient.query.mockResolvedValue({ records: [] });
      mockCreate = jest.fn().mockResolvedValue({
        success: true,
        id: 'new-target-id'
      });
      mockTargetClient.sobject.mockReturnValue({
        create: mockCreate
      });
      
      const request = new NextRequest('http://localhost:3000/api/migrations/clone-pay-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceOrgId: 'source-org-123',
          targetOrgId: 'target-org-456',
          payCodeId: 'a1234567890ABCDE'
        })
      });
      
      const response = await clonePayCodeHandler(request);
      const result = await response.json();
      
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      
      // Verify field mapping worked correctly (managed to unmanaged)
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        Name: 'Overtime',
        'Rate__c': 38.25,  // Mapped from tc9_pr__Rate__c
        'Type__c': 'Overtime',  // Mapped from tc9_pr__Type__c
        'Active__c': true,  // Mapped from tc9_pr__Active__c
        'Description__c': 'Overtime rate',  // Mapped from tc9_pr__Description__c
        'External_ID_Data_Creation__c': 'a1234567890ABCDE'  // Mapped external ID field
      }));
    });

    it('should skip cloning if record already exists in target', async () => {
      const sourcePayCode = {
        Id: 'a1234567890ABCDE',
        Name: 'Existing Pay Code',
        External_ID_Data_Creation__c: 'a1234567890ABCDE',
        Rate__c: 30.00,
        Type__c: 'Standard'
      };
      
      setupPayCodeMocks(sourcePayCode, true);
      
      const request = new NextRequest('http://localhost:3000/api/migrations/clone-pay-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceOrgId: 'source-org-123',
          targetOrgId: 'target-org-456',
          payCodeId: 'a1234567890ABCDE'
        })
      });
      
      const response = await clonePayCodeHandler(request);
      const result = await response.json();
      
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.recordId).toBe('existing-target-id');
      expect(result.message).toBe('Record already exists in target org');
      
      // Verify no creation was attempted
      expect(mockTargetClient.sobject).not.toHaveBeenCalled();
    });
  });

  describe('Leave Rule Cloning', () => {
    let mockCreate: jest.Mock;
    
    const setupLeaveRuleMocks = (sourceLeaveRule: any, targetExists: boolean = false) => {
      // Source client mocks
      mockSourceClient.describe.mockResolvedValue({
        fields: [
          { name: 'Id', type: 'id', createable: false, updateable: false },
          { name: 'Name', type: 'string', createable: true, updateable: true },
          { name: 'Leave_Type__c', type: 'picklist', createable: true, updateable: true },
          { name: 'Accrual_Rate__c', type: 'double', createable: true, updateable: true },
          { name: 'Maximum_Balance__c', type: 'double', createable: true, updateable: true },
          { name: 'Active__c', type: 'boolean', createable: true, updateable: true },
          { name: 'External_ID_Data_Creation__c', type: 'string', createable: true, updateable: true }
        ]
      });
      
      mockSourceClient.query.mockResolvedValue({
        records: [sourceLeaveRule]
      });
      
      // Target client mocks
      mockTargetClient.describe.mockResolvedValue({
        fields: [
          { name: 'Id', type: 'id', createable: false, updateable: false },
          { name: 'Name', type: 'string', createable: true, updateable: true },
          { name: 'tc9_pr__Leave_Type__c', type: 'picklist', createable: true, updateable: true },
          { name: 'tc9_pr__Accrual_Rate__c', type: 'double', createable: true, updateable: true },
          { name: 'tc9_pr__Maximum_Balance__c', type: 'double', createable: true, updateable: true },
          { name: 'tc9_pr__Active__c', type: 'boolean', createable: true, updateable: true },
          { name: 'tc9_edc__External_ID_Data_Creation__c', type: 'string', createable: true, updateable: true }
        ]
      });
      
      // Mock target query
      if (targetExists) {
        mockTargetClient.query.mockResolvedValue({
          records: [{
            Id: 'existing-leave-rule-id',
            'tc9_edc__External_ID_Data_Creation__c': sourceLeaveRule.Id
          }]
        });
      } else {
        mockTargetClient.query.mockResolvedValue({ records: [] });
      }
      
      // Mock successful creation
      mockCreate = jest.fn().mockResolvedValue({
        success: true,
        id: 'new-leave-rule-id'
      });
      mockTargetClient.sobject.mockReturnValue({
        create: mockCreate
      });
    };

    it('should successfully clone a leave rule through the API endpoint', async () => {
      const sourceLeaveRule = {
        Id: 'b9876543210ZYXWV',
        Name: 'Annual Leave',
        External_ID_Data_Creation__c: 'b9876543210ZYXWV',
        Leave_Type__c: 'Annual',
        Accrual_Rate__c: 1.67,
        Maximum_Balance__c: 200,
        Active__c: true
      };
      
      setupLeaveRuleMocks(sourceLeaveRule);
      
      const request = new NextRequest('http://localhost:3000/api/migrations/clone-leave-rule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceOrgId: 'source-org-123',
          targetOrgId: 'target-org-456',
          leaveRuleId: 'b9876543210ZYXWV'
        })
      });
      
      const response = await cloneLeaveRuleHandler(request);
      const result = await response.json();
      
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.recordId).toBe('new-leave-rule-id');
      expect(result.externalId).toBe('b9876543210ZYXWV');
      expect(result.message).toBe('Leave rule cloned successfully');
      
      // Verify field mapping
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        Name: 'Annual Leave',
        'tc9_pr__Leave_Type__c': 'Annual',
        'tc9_pr__Accrual_Rate__c': 1.67,
        'tc9_pr__Maximum_Balance__c': 200,
        'tc9_pr__Active__c': true,
        'tc9_edc__External_ID_Data_Creation__c': 'b9876543210ZYXWV'
      }));
      
      // Verify usage tracking
      expect(usageTracker.trackEvent).toHaveBeenCalledWith({
        eventType: 'leave_rule_cloned',
        userId: 'test-user-id',
        metadata: {
          sourceOrgId: 'source-org-123',
          targetOrgId: 'target-org-456',
          leaveRuleId: 'b9876543210ZYXWV',
          success: true,
          error: undefined
        }
      });
    });

    it('should handle complex leave rule with all fields populated', async () => {
      const complexLeaveRule = {
        Id: 'c5432109876ABCDE',
        Name: 'Sick Leave - Complex',
        External_ID_Data_Creation__c: 'c5432109876ABCDE',
        Leave_Type__c: 'Sick',
        Accrual_Rate__c: 0.83,
        Maximum_Balance__c: 120,
        Minimum_Balance__c: 0,
        Carry_Over_Limit__c: 40,
        Proration_Method__c: 'Daily',
        Waiting_Period_Days__c: 90,
        Active__c: true,
        Description__c: 'Sick leave policy with carryover and waiting period'
      };
      
      // Setup with additional fields
      mockSourceClient.describe.mockResolvedValue({
        fields: [
          { name: 'Id', type: 'id', createable: false, updateable: false },
          { name: 'Name', type: 'string', createable: true, updateable: true },
          { name: 'Leave_Type__c', type: 'picklist', createable: true, updateable: true },
          { name: 'Accrual_Rate__c', type: 'double', createable: true, updateable: true },
          { name: 'Maximum_Balance__c', type: 'double', createable: true, updateable: true },
          { name: 'Minimum_Balance__c', type: 'double', createable: true, updateable: true },
          { name: 'Carry_Over_Limit__c', type: 'double', createable: true, updateable: true },
          { name: 'Proration_Method__c', type: 'picklist', createable: true, updateable: true },
          { name: 'Waiting_Period_Days__c', type: 'double', createable: true, updateable: true },
          { name: 'Active__c', type: 'boolean', createable: true, updateable: true },
          { name: 'Description__c', type: 'textarea', createable: true, updateable: true },
          { name: 'External_ID_Data_Creation__c', type: 'string', createable: true, updateable: true }
        ]
      });
      
      mockSourceClient.query.mockResolvedValue({
        records: [complexLeaveRule]
      });
      
      mockTargetClient.describe.mockResolvedValue({
        fields: [
          { name: 'Id', type: 'id', createable: false, updateable: false },
          { name: 'Name', type: 'string', createable: true, updateable: true },
          { name: 'tc9_pr__Leave_Type__c', type: 'picklist', createable: true, updateable: true },
          { name: 'tc9_pr__Accrual_Rate__c', type: 'double', createable: true, updateable: true },
          { name: 'tc9_pr__Maximum_Balance__c', type: 'double', createable: true, updateable: true },
          { name: 'tc9_pr__Minimum_Balance__c', type: 'double', createable: true, updateable: true },
          { name: 'tc9_pr__Carry_Over_Limit__c', type: 'double', createable: true, updateable: true },
          { name: 'tc9_pr__Proration_Method__c', type: 'picklist', createable: true, updateable: true },
          { name: 'tc9_pr__Waiting_Period_Days__c', type: 'double', createable: true, updateable: true },
          { name: 'tc9_pr__Active__c', type: 'boolean', createable: true, updateable: true },
          { name: 'tc9_pr__Description__c', type: 'textarea', createable: true, updateable: true },
          { name: 'tc9_edc__External_ID_Data_Creation__c', type: 'string', createable: true, updateable: true }
        ]
      });
      
      mockTargetClient.query.mockResolvedValue({ records: [] });
      mockCreate = jest.fn().mockResolvedValue({
        success: true,
        id: 'new-complex-leave-id'
      });
      mockTargetClient.sobject.mockReturnValue({
        create: mockCreate
      });
      
      const request = new NextRequest('http://localhost:3000/api/migrations/clone-leave-rule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceOrgId: 'source-org-123',
          targetOrgId: 'target-org-456',
          leaveRuleId: 'c5432109876ABCDE'
        })
      });
      
      const response = await cloneLeaveRuleHandler(request);
      const result = await response.json();
      
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      
      // Verify all fields mapped correctly
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        Name: 'Sick Leave - Complex',
        'tc9_pr__Leave_Type__c': 'Sick',
        'tc9_pr__Accrual_Rate__c': 0.83,
        'tc9_pr__Maximum_Balance__c': 120,
        'tc9_pr__Minimum_Balance__c': 0,
        'tc9_pr__Carry_Over_Limit__c': 40,
        'tc9_pr__Proration_Method__c': 'Daily',
        'tc9_pr__Waiting_Period_Days__c': 90,
        'tc9_pr__Active__c': true,
        'tc9_pr__Description__c': 'Sick leave policy with carryover and waiting period',
        'tc9_edc__External_ID_Data_Creation__c': 'c5432109876ABCDE'
      }));
    });
  });

  describe('Error Handling', () => {
    it('should handle missing required parameters', async () => {
      const request = new NextRequest('http://localhost:3000/api/migrations/clone-pay-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceOrgId: 'source-org-123',
          // Missing targetOrgId and payCodeId
        })
      });
      
      const response = await clonePayCodeHandler(request);
      const result = await response.json();
      
      expect(response.status).toBe(400);
      expect(result.error).toContain('Missing required parameters');
    });

    it('should handle authentication token expiry', async () => {
      const sourcePayCode = {
        Id: 'a1234567890ABCDE',
        Name: 'Test Pay Code',
        External_ID_Data_Creation__c: 'a1234567890ABCDE'
      };
      
      mockSourceClient.describe.mockResolvedValue({
        fields: [
          { name: 'Id', type: 'id', createable: false, updateable: false },
          { name: 'Name', type: 'string', createable: true, updateable: true },
          { name: 'External_ID_Data_Creation__c', type: 'string', createable: true, updateable: true }
        ]
      });
      
      // Mock token expiry error
      mockSourceClient.query.mockRejectedValue(new Error('INVALID_SESSION_ID: Session expired or invalid'));
      
      const request = new NextRequest('http://localhost:3000/api/migrations/clone-pay-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceOrgId: 'source-org-123',
          targetOrgId: 'target-org-456',
          payCodeId: 'a1234567890ABCDE'
        })
      });
      
      const response = await clonePayCodeHandler(request);
      const result = await response.json();
      
      expect(response.status).toBe(401);
      expect(result.error).toContain('Authentication token has expired');
      expect(result.code).toBe('TOKEN_EXPIRED');
      expect(result.reconnectUrl).toBe('/orgs');
    });

    it('should handle source record not found', async () => {
      mockSourceClient.describe.mockResolvedValue({
        fields: [
          { name: 'Id', type: 'id', createable: false, updateable: false },
          { name: 'Name', type: 'string', createable: true, updateable: true }
        ]
      });
      
      mockSourceClient.query.mockResolvedValue({ records: [] });
      
      const request = new NextRequest('http://localhost:3000/api/migrations/clone-pay-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceOrgId: 'source-org-123',
          targetOrgId: 'target-org-456',
          payCodeId: 'invalid-id'
        })
      });
      
      const response = await clonePayCodeHandler(request);
      const result = await response.json();
      
      expect(response.status).toBe(500);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Source record invalid-id not found');
    });

    it('should handle Salesforce API errors gracefully', async () => {
      const sourcePayCode = {
        Id: 'a1234567890ABCDE',
        Name: 'Test Pay Code',
        External_ID_Data_Creation__c: 'a1234567890ABCDE',
        Rate__c: 25.50
      };
      
      mockSourceClient.describe.mockResolvedValue({
        fields: [
          { name: 'Id', type: 'id', createable: false, updateable: false },
          { name: 'Name', type: 'string', createable: true, updateable: true },
          { name: 'Rate__c', type: 'double', createable: true, updateable: true },
          { name: 'External_ID_Data_Creation__c', type: 'string', createable: true, updateable: true }
        ]
      });
      
      mockSourceClient.query.mockResolvedValue({
        records: [sourcePayCode]
      });
      
      mockTargetClient.describe.mockResolvedValue({
        fields: [
          { name: 'Id', type: 'id', createable: false, updateable: false },
          { name: 'Name', type: 'string', createable: true, updateable: true },
          { name: 'tc9_pr__Rate__c', type: 'double', createable: true, updateable: true },
          { name: 'tc9_edc__External_ID_Data_Creation__c', type: 'string', createable: true, updateable: true }
        ]
      });
      
      mockTargetClient.query.mockResolvedValue({ records: [] });
      
      // Mock creation failure
      mockTargetClient.sobject.mockReturnValue({
        create: jest.fn().mockRejectedValue(new Error('FIELD_CUSTOM_VALIDATION_EXCEPTION: Rate must be greater than 0'))
      });
      
      const request = new NextRequest('http://localhost:3000/api/migrations/clone-pay-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceOrgId: 'source-org-123',
          targetOrgId: 'target-org-456',
          payCodeId: 'a1234567890ABCDE'
        })
      });
      
      const response = await clonePayCodeHandler(request);
      const result = await response.json();
      
      expect(response.status).toBe(500);
      expect(result.success).toBe(false);
      expect(result.error).toContain('FIELD_CUSTOM_VALIDATION_EXCEPTION');
    });
  });

  describe('Field Mapping Validation', () => {
    let mockCreate: jest.Mock;
    
    it('should correctly map boolean fields', async () => {
      const sourceRecord = {
        Id: 'test-id',
        Name: 'Boolean Test',
        External_ID_Data_Creation__c: 'test-id',
        Active__c: true,
        Enabled__c: false,
        Is_Default__c: true
      };
      
      mockSourceClient.describe.mockResolvedValue({
        fields: [
          { name: 'Id', type: 'id', createable: false, updateable: false },
          { name: 'Name', type: 'string', createable: true, updateable: true },
          { name: 'Active__c', type: 'boolean', createable: true, updateable: true },
          { name: 'Enabled__c', type: 'boolean', createable: true, updateable: true },
          { name: 'Is_Default__c', type: 'boolean', createable: true, updateable: true },
          { name: 'External_ID_Data_Creation__c', type: 'string', createable: true, updateable: true }
        ]
      });
      
      mockSourceClient.query.mockResolvedValue({ records: [sourceRecord] });
      
      mockTargetClient.describe.mockResolvedValue({
        fields: [
          { name: 'Id', type: 'id', createable: false, updateable: false },
          { name: 'Name', type: 'string', createable: true, updateable: true },
          { name: 'tc9_pr__Active__c', type: 'boolean', createable: true, updateable: true },
          { name: 'tc9_pr__Enabled__c', type: 'boolean', createable: true, updateable: true },
          { name: 'tc9_pr__Is_Default__c', type: 'boolean', createable: true, updateable: true },
          { name: 'tc9_edc__External_ID_Data_Creation__c', type: 'string', createable: true, updateable: true }
        ]
      });
      
      mockTargetClient.query.mockResolvedValue({ records: [] });
      mockCreate = jest.fn().mockResolvedValue({ success: true, id: 'new-id' });
      mockTargetClient.sobject.mockReturnValue({
        create: mockCreate
      });
      
      const result = await CloningService.cloneRecord({
        sourceOrgId: 'source-org-123',
        targetOrgId: 'target-org-456',
        sourceRecordId: 'test-id',
        objectApiName: 'tc9_pr__Pay_Code__c'
      });
      
      expect(result.success).toBe(true);
      
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        'tc9_pr__Active__c': true,
        'tc9_pr__Enabled__c': false,
        'tc9_pr__Is_Default__c': true
      }));
    });

    it('should correctly map numeric fields with decimal values', async () => {
      const sourceRecord = {
        Id: 'numeric-test-id',
        Name: 'Numeric Test',
        External_ID_Data_Creation__c: 'numeric-test-id',
        Rate__c: 25.50,
        Minimum_Hours__c: 0.5,
        Maximum_Hours__c: 12.75,
        Percentage__c: 150.25
      };
      
      mockSourceClient.describe.mockResolvedValue({
        fields: [
          { name: 'Id', type: 'id', createable: false, updateable: false },
          { name: 'Name', type: 'string', createable: true, updateable: true },
          { name: 'Rate__c', type: 'double', createable: true, updateable: true },
          { name: 'Minimum_Hours__c', type: 'double', createable: true, updateable: true },
          { name: 'Maximum_Hours__c', type: 'double', createable: true, updateable: true },
          { name: 'Percentage__c', type: 'double', createable: true, updateable: true },
          { name: 'External_ID_Data_Creation__c', type: 'string', createable: true, updateable: true }
        ]
      });
      
      mockSourceClient.query.mockResolvedValue({ records: [sourceRecord] });
      
      mockTargetClient.describe.mockResolvedValue({
        fields: [
          { name: 'Id', type: 'id', createable: false, updateable: false },
          { name: 'Name', type: 'string', createable: true, updateable: true },
          { name: 'tc9_pr__Rate__c', type: 'double', createable: true, updateable: true },
          { name: 'tc9_pr__Minimum_Hours__c', type: 'double', createable: true, updateable: true },
          { name: 'tc9_pr__Maximum_Hours__c', type: 'double', createable: true, updateable: true },
          { name: 'tc9_pr__Percentage__c', type: 'double', createable: true, updateable: true },
          { name: 'tc9_edc__External_ID_Data_Creation__c', type: 'string', createable: true, updateable: true }
        ]
      });
      
      mockTargetClient.query.mockResolvedValue({ records: [] });
      mockCreate = jest.fn().mockResolvedValue({ success: true, id: 'new-id' });
      mockTargetClient.sobject.mockReturnValue({
        create: mockCreate
      });
      
      const result = await CloningService.cloneRecord({
        sourceOrgId: 'source-org-123',
        targetOrgId: 'target-org-456',
        sourceRecordId: 'numeric-test-id',
        objectApiName: 'tc9_pr__Pay_Code__c'
      });
      
      expect(result.success).toBe(true);
      
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        'tc9_pr__Rate__c': 25.50,
        'tc9_pr__Minimum_Hours__c': 0.5,
        'tc9_pr__Maximum_Hours__c': 12.75,
        'tc9_pr__Percentage__c': 150.25
      }));
    });

    it('should handle null and undefined values correctly', async () => {
      const sourceRecord = {
        Id: 'null-test-id',
        Name: 'Null Test',
        External_ID_Data_Creation__c: 'null-test-id',
        Rate__c: 25.50,
        Description__c: null,
        Notes__c: undefined,
        Active__c: true
      };
      
      mockSourceClient.describe.mockResolvedValue({
        fields: [
          { name: 'Id', type: 'id', createable: false, updateable: false },
          { name: 'Name', type: 'string', createable: true, updateable: true },
          { name: 'Rate__c', type: 'double', createable: true, updateable: true },
          { name: 'Description__c', type: 'textarea', createable: true, updateable: true },
          { name: 'Notes__c', type: 'textarea', createable: true, updateable: true },
          { name: 'Active__c', type: 'boolean', createable: true, updateable: true },
          { name: 'External_ID_Data_Creation__c', type: 'string', createable: true, updateable: true }
        ]
      });
      
      mockSourceClient.query.mockResolvedValue({ records: [sourceRecord] });
      
      mockTargetClient.describe.mockResolvedValue({
        fields: [
          { name: 'Id', type: 'id', createable: false, updateable: false },
          { name: 'Name', type: 'string', createable: true, updateable: true },
          { name: 'tc9_pr__Rate__c', type: 'double', createable: true, updateable: true },
          { name: 'tc9_pr__Description__c', type: 'textarea', createable: true, updateable: true },
          { name: 'tc9_pr__Notes__c', type: 'textarea', createable: true, updateable: true },
          { name: 'tc9_pr__Active__c', type: 'boolean', createable: true, updateable: true },
          { name: 'tc9_edc__External_ID_Data_Creation__c', type: 'string', createable: true, updateable: true }
        ]
      });
      
      mockTargetClient.query.mockResolvedValue({ records: [] });
      mockCreate = jest.fn().mockResolvedValue({ success: true, id: 'new-id' });
      mockTargetClient.sobject.mockReturnValue({
        create: mockCreate
      });
      
      const result = await CloningService.cloneRecord({
        sourceOrgId: 'source-org-123',
        targetOrgId: 'target-org-456',
        sourceRecordId: 'null-test-id',
        objectApiName: 'tc9_pr__Pay_Code__c'
      });
      
      expect(result.success).toBe(true);
      
      const createCall = mockTargetClient.sobject('tc9_pr__Pay_Code__c').create;
      const calledWith = createCall.mock.calls[0][0];
      
      // Should include non-null values
      expect(calledWith).toHaveProperty('Name', 'Null Test');
      expect(calledWith).toHaveProperty('tc9_pr__Rate__c', 25.50);
      expect(calledWith).toHaveProperty('tc9_pr__Active__c', true);
      
      // Should not include null or undefined values
      expect(calledWith).not.toHaveProperty('tc9_pr__Description__c');
      expect(calledWith).not.toHaveProperty('tc9_pr__Notes__c');
    });
  });

  describe('Usage Tracking', () => {
    let mockCreate: jest.Mock;
    
    it('should track successful cloning events with all metadata', async () => {
      const sourcePayCode = {
        Id: 'tracking-test-id',
        Name: 'Tracking Test',
        External_ID_Data_Creation__c: 'tracking-test-id',
        Rate__c: 30.00
      };
      
      mockSourceClient.describe.mockResolvedValue({
        fields: [
          { name: 'Id', type: 'id', createable: false, updateable: false },
          { name: 'Name', type: 'string', createable: true, updateable: true },
          { name: 'Rate__c', type: 'double', createable: true, updateable: true },
          { name: 'External_ID_Data_Creation__c', type: 'string', createable: true, updateable: true }
        ]
      });
      
      mockSourceClient.query.mockResolvedValue({ records: [sourcePayCode] });
      
      mockTargetClient.describe.mockResolvedValue({
        fields: [
          { name: 'Id', type: 'id', createable: false, updateable: false },
          { name: 'Name', type: 'string', createable: true, updateable: true },
          { name: 'tc9_pr__Rate__c', type: 'double', createable: true, updateable: true },
          { name: 'tc9_edc__External_ID_Data_Creation__c', type: 'string', createable: true, updateable: true }
        ]
      });
      
      mockTargetClient.query.mockResolvedValue({ records: [] });
      mockCreate = jest.fn().mockResolvedValue({ success: true, id: 'new-tracking-id' });
      mockTargetClient.sobject.mockReturnValue({
        create: mockCreate
      });
      
      const request = new NextRequest('http://localhost:3000/api/migrations/clone-pay-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceOrgId: 'source-org-123',
          targetOrgId: 'target-org-456',
          payCodeId: 'tracking-test-id'
        })
      });
      
      await clonePayCodeHandler(request);
      
      expect(usageTracker.trackEvent).toHaveBeenCalledWith({
        eventType: 'pay_code_cloned',
        userId: 'test-user-id',
        metadata: {
          sourceOrgId: 'source-org-123',
          targetOrgId: 'target-org-456',
          payCodeId: 'tracking-test-id',
          success: true,
          error: undefined
        }
      });
    });

    it('should track failed cloning events with error details', async () => {
      mockSourceClient.describe.mockResolvedValue({
        fields: [
          { name: 'Id', type: 'id', createable: false, updateable: false }
        ]
      });
      
      mockSourceClient.query.mockResolvedValue({ records: [] });
      
      const request = new NextRequest('http://localhost:3000/api/migrations/clone-pay-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceOrgId: 'source-org-123',
          targetOrgId: 'target-org-456',
          payCodeId: 'non-existent-id'
        })
      });
      
      await clonePayCodeHandler(request);
      
      expect(usageTracker.trackEvent).toHaveBeenCalledWith({
        eventType: 'pay_code_cloned',
        userId: 'test-user-id',
        metadata: {
          sourceOrgId: 'source-org-123',
          targetOrgId: 'target-org-456',
          payCodeId: 'non-existent-id',
          success: false,
          error: expect.stringContaining('Source record non-existent-id not found')
        }
      });
    });
  });
});
import { CloningService } from '@/lib/migration/cloning-service';
import { sessionManager } from '@/lib/salesforce/session-manager';
import { ExternalIdUtils } from '@/lib/migration/templates/utils/external-id-utils';

// Mock dependencies
jest.mock('@/lib/salesforce/session-manager');
jest.mock('@/lib/migration/templates/utils/external-id-utils');

describe('CloningService', () => {
  const mockSourceClient = {
    query: jest.fn(),
    describe: jest.fn(),
    sobject: jest.fn(),
    getObjectMetadata: jest.fn(),
    create: jest.fn()
  };
  
  const mockTargetClient = {
    query: jest.fn(),
    describe: jest.fn(),
    sobject: jest.fn(),
    getObjectMetadata: jest.fn(),
    create: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup session manager mocks
    (sessionManager.getClient as jest.Mock).mockImplementation((orgId: string) => {
      if (orgId === 'source-org-id') return mockSourceClient;
      if (orgId === 'target-org-id') return mockTargetClient;
      throw new Error('Unknown org ID');
    });
    
    // Setup external ID detection mocks
    (ExternalIdUtils.detectExternalIdField as jest.Mock).mockImplementation((obj: string, client: any) => {
      if (client === mockSourceClient) return 'External_ID_Data_Creation__c';
      if (client === mockTargetClient) return 'tc9_edc__External_ID_Data_Creation__c';
      return 'External_ID_Data_Creation__c';
    });
  });

  describe('cloneRecord', () => {
    it('should successfully clone a pay code from source to target', async () => {
      // Setup mock data
      const sourcePayCode = {
        Id: 'a1234567890ABCDE',
        Name: 'Regular Hours',
        External_ID_Data_Creation__c: 'a1234567890ABCDE',
        Rate__c: 25.50,
        Type__c: 'Standard',
        Active__c: true
      };
      
      const fieldMetadata = {
        fields: [
          { name: 'Id' },
          { name: 'Name' },
          { name: 'tc9_pr__Rate__c' },
          { name: 'tc9_pr__Type__c' },
          { name: 'tc9_pr__Active__c' },
          { name: 'tc9_edc__External_ID_Data_Creation__c' }
        ]
      };
      
      // Mock source client responses
      mockSourceClient.getObjectMetadata.mockResolvedValue({
        success: true,
        data: {
          fields: [
            { name: 'Id' },
            { name: 'Name' },
            { name: 'Rate__c' },
            { name: 'Type__c' },
            { name: 'Active__c' },
            { name: 'External_ID_Data_Creation__c' }
          ]
        }
      });
      
      mockSourceClient.query.mockResolvedValue({
        success: true,
        data: [sourcePayCode]
      });
      
      // Mock target client responses
      mockTargetClient.getObjectMetadata.mockResolvedValue({
        success: true,
        data: fieldMetadata
      });
      
      // Mock that record doesn't exist in target
      mockTargetClient.query.mockResolvedValue({
        success: true,
        data: []
      });
      
      // Mock successful creation
      mockTargetClient.create.mockResolvedValue({
        success: true,
        data: {
          success: true,
          id: 'b9876543210ZYXWV'
        }
      });
      
      // Execute clone
      const result = await CloningService.cloneRecord({
        sourceOrgId: 'source-org-id',
        targetOrgId: 'target-org-id',
        sourceRecordId: 'a1234567890ABCDE',
        objectApiName: 'tc9_pr__Pay_Code__c'
      });
      
      // Verify result
      expect(result.success).toBe(true);
      expect(result.recordId).toBe('b9876543210ZYXWV');
      expect(result.externalId).toBe('a1234567890ABCDE');
      
      // Verify target record creation was called with correct data
      expect(mockTargetClient.create).toHaveBeenCalledWith('tc9_pr__Pay_Code__c', expect.objectContaining({
        Name: 'Regular Hours',
        'tc9_pr__Rate__c': 25.50,
        'tc9_pr__Type__c': 'Standard',
        'tc9_pr__Active__c': true,
        'tc9_edc__External_ID_Data_Creation__c': 'a1234567890ABCDE'
      }));
    });

    it('should handle cross-environment field mapping (managed to unmanaged)', async () => {
      // Setup for managed source to unmanaged target
      const sourcePayCode = {
        Id: 'a1234567890ABCDE',
        Name: 'Overtime',
        'tc9_edc__External_ID_Data_Creation__c': 'a1234567890ABCDE',
        'tc9_pr__Rate__c': 38.25,
        'tc9_pr__Type__c': 'Overtime'
      };
      
      // Mock source as managed
      mockSourceClient.getObjectMetadata.mockResolvedValue({
        success: true,
        data: {
          fields: [
            { name: 'Id' },
            { name: 'Name' },
            { name: 'tc9_pr__Rate__c' },
            { name: 'tc9_pr__Type__c' },
            { name: 'tc9_edc__External_ID_Data_Creation__c' }
          ]
        }
      });
      
      mockSourceClient.query.mockResolvedValue({
        success: true,
        data: [sourcePayCode]
      });
      
      // Mock target as unmanaged
      (ExternalIdUtils.detectExternalIdField as jest.Mock).mockImplementation((obj: string, client: any) => {
        if (client === mockTargetClient) return 'External_ID_Data_Creation__c';
        return 'tc9_edc__External_ID_Data_Creation__c';
      });
      
      mockTargetClient.getObjectMetadata.mockResolvedValue({
        success: true,
        data: {
          fields: [
            { name: 'Id' },
            { name: 'Name' },
            { name: 'Rate__c' },
            { name: 'Type__c' },
            { name: 'External_ID_Data_Creation__c' }
          ]
        }
      });
      
      mockTargetClient.query.mockResolvedValue({ success: true, data: [] });
      mockTargetClient.create.mockResolvedValue({
        success: true,
        data: {
          success: true,
          id: 'b9876543210ZYXWV'
        }
      });
      
      // Execute clone
      const result = await CloningService.cloneRecord({
        sourceOrgId: 'source-org-id',
        targetOrgId: 'target-org-id',
        sourceRecordId: 'a1234567890ABCDE',
        objectApiName: 'tc9_pr__Pay_Code__c'
      });
      
      // Verify field mapping worked correctly
      expect(mockTargetClient.create).toHaveBeenCalledWith('tc9_pr__Pay_Code__c', expect.objectContaining({
        Name: 'Overtime',
        'Rate__c': 38.25,  // Mapped from tc9_pr__Rate__c to Rate__c
        'Type__c': 'Overtime',  // Mapped from tc9_pr__Type__c to Type__c
        'External_ID_Data_Creation__c': 'a1234567890ABCDE'
      }));
    });

    it('should skip cloning if record already exists in target', async () => {
      const existingRecord = {
        Id: 'b9876543210ZYXWV',
        'tc9_edc__External_ID_Data_Creation__c': 'a1234567890ABCDE'
      };
      
      // Mock that record exists in target
      mockTargetClient.query.mockResolvedValue({
        success: true,
        data: [existingRecord]
      });
      
      mockSourceClient.getObjectMetadata.mockResolvedValue({
        success: true,
        data: {
          fields: [{ name: 'Id' }, { name: 'Name' }]
        }
      });
      
      mockSourceClient.query.mockResolvedValue({
        success: true,
        data: [{ Id: 'a1234567890ABCDE', Name: 'Test' }]
      });
      
      // Execute clone
      const result = await CloningService.cloneRecord({
        sourceOrgId: 'source-org-id',
        targetOrgId: 'target-org-id',
        sourceRecordId: 'a1234567890ABCDE',
        objectApiName: 'tc9_pr__Pay_Code__c'
      });
      
      // Verify result
      expect(result.success).toBe(true);
      expect(result.recordId).toBe('b9876543210ZYXWV');
      expect(result.error).toBe('Record already exists in target org');
      
      // Verify no creation was attempted
      expect(mockTargetClient.create).not.toHaveBeenCalled();
    });

    it('should handle source record not found', async () => {
      mockSourceClient.getObjectMetadata.mockResolvedValue({
        success: true,
        data: {
          fields: [{ name: 'Id' }]
        }
      });
      
      mockSourceClient.query.mockResolvedValue({
        success: true,
        data: []
      });
      
      // Execute clone
      const result = await CloningService.cloneRecord({
        sourceOrgId: 'source-org-id',
        targetOrgId: 'target-org-id',
        sourceRecordId: 'invalid-id',
        objectApiName: 'tc9_pr__Pay_Code__c'
      });
      
      // Verify result
      expect(result.success).toBe(false);
      expect(result.error).toContain('Source record invalid-id not found');
    });
  });
});
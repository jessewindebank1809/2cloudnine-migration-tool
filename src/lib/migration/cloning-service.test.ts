import { CloningService } from './cloning-service';
import { sessionManager } from '@/lib/salesforce/session-manager';
import { ExternalIdUtils } from '@/lib/migration/templates/utils/external-id-utils';
import { Connection } from 'jsforce';

// Mock dependencies
jest.mock('@/lib/salesforce/session-manager');
jest.mock('@/lib/migration/templates/utils/external-id-utils');

describe('CloningService', () => {
  let mockSourceClient: any;
  let mockTargetClient: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock clients with all required methods
    mockSourceClient = {
      query: jest.fn(),
      describe: jest.fn(),
      sobject: jest.fn()
    };

    mockTargetClient = {
      query: jest.fn(),
      describe: jest.fn(),
      sobject: jest.fn()
    };

    // Setup default session manager mock
    (sessionManager.getClient as jest.Mock).mockImplementation((orgId: string) => {
      if (orgId === 'source-org-id') return Promise.resolve(mockSourceClient);
      if (orgId === 'target-org-id') return Promise.resolve(mockTargetClient);
      throw new Error('Unknown org ID');
    });
  });

  describe('Field Mapping Tests', () => {
    it('should handle managed to unmanaged package field mapping', async () => {
      // Setup managed source fields
      const managedSourceFields = [
        { name: 'Id', type: 'id' },
        { name: 'Name', type: 'string' },
        { name: 'tc9_pr__Rate__c', type: 'currency' },
        { name: 'tc9_pr__Type__c', type: 'string' },
        { name: 'tc9_pr__Active__c', type: 'boolean' },
        { name: 'tc9_edc__External_ID_Data_Creation__c', type: 'string' }
      ];

      // Setup unmanaged target fields
      const unmanagedTargetFields = [
        { name: 'Id', type: 'id' },
        { name: 'Name', type: 'string' },
        { name: 'Rate__c', type: 'currency' },
        { name: 'Type__c', type: 'string' },
        { name: 'Active__c', type: 'boolean' },
        { name: 'External_ID_Data_Creation__c', type: 'string' }
      ];

      // Setup source record with managed fields
      const sourceRecord = {
        Id: 'a1234567890ABCDE',
        Name: 'Overtime Pay',
        'tc9_pr__Rate__c': 45.50,
        'tc9_pr__Type__c': 'Overtime',
        'tc9_pr__Active__c': true
      };

      // Mock external ID detection
      (ExternalIdUtils.detectExternalIdField as jest.Mock)
        .mockResolvedValueOnce('tc9_edc__External_ID_Data_Creation__c') // source
        .mockResolvedValueOnce('External_ID_Data_Creation__c'); // target

      // Mock describe calls
      mockSourceClient.describe.mockResolvedValue({ fields: managedSourceFields });
      mockTargetClient.describe.mockResolvedValue({ fields: unmanagedTargetFields });

      // Mock query for source record
      mockSourceClient.query.mockResolvedValue({ records: [sourceRecord] });

      // Mock no existing record in target
      mockTargetClient.query.mockResolvedValue({ records: [] });

      // Mock successful creation
      mockTargetClient.sobject.mockReturnValue({
        create: jest.fn().mockResolvedValue({ success: true, id: 'b9876543210ZYXWV' })
      });

      // Execute clone
      const result = await CloningService.cloneRecord({
        sourceOrgId: 'source-org-id',
        targetOrgId: 'target-org-id',
        sourceRecordId: 'a1234567890ABCDE',
        objectApiName: 'tc9_pr__Pay_Code__c'
      });

      // Verify field mapping
      const createCall = mockTargetClient.sobject('tc9_pr__Pay_Code__c').create;
      const createdRecord = createCall.mock.calls[0][0];
      
      // External ID should be set to source record ID
      expect(createdRecord['External_ID_Data_Creation__c']).toBe('a1234567890ABCDE');
      
      // Verify mapped fields are present
      expect(createdRecord.Name).toBe('Overtime Pay');
      expect(createdRecord['Rate__c']).toBe(45.50);
      expect(createdRecord['Type__c']).toBe('Overtime');
      expect(createdRecord['Active__c']).toBe(true);

      expect(result.success).toBe(true);
    });

    it('should handle unmanaged to managed package field mapping', async () => {
      // Setup unmanaged source fields
      const unmanagedSourceFields = [
        { name: 'Id', type: 'id' },
        { name: 'Name', type: 'string' },
        { name: 'Rate__c', type: 'currency' },
        { name: 'Type__c', type: 'string' },
        { name: 'Active__c', type: 'boolean' },
        { name: 'External_ID_Data_Creation__c', type: 'string' }
      ];

      // Setup managed target fields
      const managedTargetFields = [
        { name: 'Id', type: 'id' },
        { name: 'Name', type: 'string' },
        { name: 'tc9_pr__Rate__c', type: 'currency' },
        { name: 'tc9_pr__Type__c', type: 'string' },
        { name: 'tc9_pr__Active__c', type: 'boolean' },
        { name: 'tc9_edc__External_ID_Data_Creation__c', type: 'string' }
      ];

      // Setup source record with unmanaged fields
      const sourceRecord = {
        Id: 'a1234567890ABCDE',
        Name: 'Regular Pay',
        'Rate__c': 25.00,
        'Type__c': 'Standard',
        'Active__c': true
      };

      // Mock external ID detection
      (ExternalIdUtils.detectExternalIdField as jest.Mock)
        .mockResolvedValueOnce('External_ID_Data_Creation__c') // source
        .mockResolvedValueOnce('tc9_edc__External_ID_Data_Creation__c'); // target

      // Mock describe calls
      mockSourceClient.describe.mockResolvedValue({ fields: unmanagedSourceFields });
      mockTargetClient.describe.mockResolvedValue({ fields: managedTargetFields });

      // Mock query for source record
      mockSourceClient.query.mockResolvedValue({ records: [sourceRecord] });

      // Mock no existing record in target
      mockTargetClient.query.mockResolvedValue({ records: [] });

      // Mock successful creation
      mockTargetClient.sobject.mockReturnValue({
        create: jest.fn().mockResolvedValue({ success: true, id: 'b9876543210ZYXWV' })
      });

      // Execute clone
      const result = await CloningService.cloneRecord({
        sourceOrgId: 'source-org-id',
        targetOrgId: 'target-org-id',
        sourceRecordId: 'a1234567890ABCDE',
        objectApiName: 'tc9_pr__Pay_Code__c'
      });

      // Verify field mapping
      const createCall = mockTargetClient.sobject('tc9_pr__Pay_Code__c').create;
      const createdRecord = createCall.mock.calls[0][0];
      
      // External ID should be set to source record ID
      expect(createdRecord['tc9_edc__External_ID_Data_Creation__c']).toBe('a1234567890ABCDE');
      
      // Verify mapped fields are present
      expect(createdRecord.Name).toBe('Regular Pay');
      expect(createdRecord['tc9_pr__Rate__c']).toBe(25.00);
      expect(createdRecord['tc9_pr__Type__c']).toBe('Standard');
      expect(createdRecord['tc9_pr__Active__c']).toBe(true);

      expect(result.success).toBe(true);
    });

    it('should skip system fields during mapping', async () => {
      const sourceFields = [
        { name: 'Id', type: 'id' },
        { name: 'Name', type: 'string' },
        { name: 'CreatedDate', type: 'datetime' },
        { name: 'LastModifiedDate', type: 'datetime' },
        { name: 'SystemModstamp', type: 'datetime' },
        { name: 'IsDeleted', type: 'boolean' },
        { name: 'tc9_pr__Active__c', type: 'boolean' }
      ];

      const sourceRecord = {
        Id: 'a1234567890ABCDE',
        Name: 'Test Record',
        CreatedDate: '2024-01-01T00:00:00.000Z',
        LastModifiedDate: '2024-01-02T00:00:00.000Z',
        SystemModstamp: '2024-01-02T00:00:00.000Z',
        IsDeleted: false,
        'tc9_pr__Active__c': true
      };

      // Mock external ID detection
      (ExternalIdUtils.detectExternalIdField as jest.Mock)
        .mockResolvedValue('tc9_edc__External_ID_Data_Creation__c');

      // Mock describe calls
      mockSourceClient.describe.mockResolvedValue({ fields: sourceFields });
      mockTargetClient.describe.mockResolvedValue({ fields: sourceFields });

      // Mock query for source record
      mockSourceClient.query.mockResolvedValue({ records: [sourceRecord] });

      // Mock no existing record in target
      mockTargetClient.query.mockResolvedValue({ records: [] });

      // Mock successful creation
      mockTargetClient.sobject.mockReturnValue({
        create: jest.fn().mockResolvedValue({ success: true, id: 'b9876543210ZYXWV' })
      });

      // Execute clone
      await CloningService.cloneRecord({
        sourceOrgId: 'source-org-id',
        targetOrgId: 'target-org-id',
        sourceRecordId: 'a1234567890ABCDE',
        objectApiName: 'tc9_pr__Pay_Code__c'
      });

      // Verify system fields were not included
      const createCall = mockTargetClient.sobject('tc9_pr__Pay_Code__c').create;
      const createdRecord = createCall.mock.calls[0][0];
      
      expect(createdRecord).not.toHaveProperty('CreatedDate');
      expect(createdRecord).not.toHaveProperty('LastModifiedDate');
      expect(createdRecord).not.toHaveProperty('SystemModstamp');
      expect(createdRecord).not.toHaveProperty('IsDeleted');
      expect(createdRecord).toHaveProperty('Name', 'Test Record');
      expect(createdRecord).toHaveProperty('tc9_pr__Active__c', true);
    });
  });

  describe('External ID Handling Tests', () => {
    it('should detect and use correct external ID field for managed package', async () => {
      const sourceRecord = {
        Id: 'a1234567890ABCDE',
        Name: 'Test Pay Code',
        'tc9_edc__External_ID_Data_Creation__c': 'EXT123'
      };

      // Mock external ID detection for managed package
      (ExternalIdUtils.detectExternalIdField as jest.Mock)
        .mockResolvedValueOnce('tc9_edc__External_ID_Data_Creation__c') // source
        .mockResolvedValueOnce('tc9_edc__External_ID_Data_Creation__c'); // target

      mockSourceClient.describe.mockResolvedValue({
        fields: [
          { name: 'Id' },
          { name: 'Name' },
          { name: 'tc9_edc__External_ID_Data_Creation__c' }
        ]
      });

      mockTargetClient.describe.mockResolvedValue({
        fields: [
          { name: 'Id' },
          { name: 'Name' },
          { name: 'tc9_edc__External_ID_Data_Creation__c' }
        ]
      });

      mockSourceClient.query.mockResolvedValue({ records: [sourceRecord] });
      mockTargetClient.query.mockResolvedValue({ records: [] });

      mockTargetClient.sobject.mockReturnValue({
        create: jest.fn().mockResolvedValue({ success: true, id: 'newId' })
      });

      const result = await CloningService.cloneRecord({
        sourceOrgId: 'source-org-id',
        targetOrgId: 'target-org-id',
        sourceRecordId: 'a1234567890ABCDE',
        objectApiName: 'tc9_pr__Pay_Code__c'
      });

      // Verify external ID was detected correctly
      expect(ExternalIdUtils.detectExternalIdField).toHaveBeenCalledWith('tc9_pr__Pay_Code__c', mockSourceClient);
      expect(ExternalIdUtils.detectExternalIdField).toHaveBeenCalledWith('tc9_pr__Pay_Code__c', mockTargetClient);

      // Verify target record has source record ID as external ID
      const createCall = mockTargetClient.sobject('tc9_pr__Pay_Code__c').create;
      expect(createCall).toHaveBeenCalledWith(expect.objectContaining({
        'tc9_edc__External_ID_Data_Creation__c': 'a1234567890ABCDE' // Source record ID
      }));
    });

    it('should handle external ID field detection failure', async () => {
      // Mock external ID detection failure
      (ExternalIdUtils.detectExternalIdField as jest.Mock)
        .mockRejectedValue(new Error('Failed to detect external ID field'));

      const result = await CloningService.cloneRecord({
        sourceOrgId: 'source-org-id',
        targetOrgId: 'target-org-id',
        sourceRecordId: 'a1234567890ABCDE',
        objectApiName: 'tc9_pr__Pay_Code__c'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to detect external ID field');
    });

    it('should query by external ID when provided non-Salesforce ID', async () => {
      const sourceRecord = {
        Id: 'a1234567890ABCDE',
        Name: 'Test Record',
        'External_ID_Data_Creation__c': 'CUSTOM_EXT_ID_123'
      };

      (ExternalIdUtils.detectExternalIdField as jest.Mock)
        .mockResolvedValue('External_ID_Data_Creation__c');

      mockSourceClient.describe.mockResolvedValue({
        fields: [
          { name: 'Id' },
          { name: 'Name' },
          { name: 'External_ID_Data_Creation__c' }
        ]
      });

      mockSourceClient.query.mockResolvedValue({ records: [sourceRecord] });
      mockTargetClient.describe.mockResolvedValue({
        fields: [
          { name: 'Id' },
          { name: 'Name' },
          { name: 'External_ID_Data_Creation__c' }
        ]
      });
      mockTargetClient.query.mockResolvedValue({ records: [] });

      mockTargetClient.sobject.mockReturnValue({
        create: jest.fn().mockResolvedValue({ success: true, id: 'newId' })
      });

      // Use external ID instead of Salesforce ID
      await CloningService.cloneRecord({
        sourceOrgId: 'source-org-id',
        targetOrgId: 'target-org-id',
        sourceRecordId: 'CUSTOM_EXT_ID_123',
        objectApiName: 'tc9_pr__Pay_Code__c'
      });

      // Verify query used external ID field
      expect(mockSourceClient.query).toHaveBeenCalledWith(
        expect.stringContaining("WHERE External_ID_Data_Creation__c = 'CUSTOM_EXT_ID_123'")
      );
    });
  });

  describe('Duplicate Record Detection Tests', () => {
    it('should detect existing record in target org and skip creation', async () => {
      const existingTargetRecord = {
        Id: 'b9876543210ZYXWV',
        'tc9_edc__External_ID_Data_Creation__c': 'a1234567890ABCDE'
      };

      const sourceRecord = {
        Id: 'a1234567890ABCDE',
        Name: 'Existing Record'
      };

      (ExternalIdUtils.detectExternalIdField as jest.Mock)
        .mockResolvedValue('tc9_edc__External_ID_Data_Creation__c');

      mockSourceClient.describe.mockResolvedValue({
        fields: [{ name: 'Id' }, { name: 'Name' }]
      });

      mockSourceClient.query.mockResolvedValue({ records: [sourceRecord] });

      // Mock existing record in target
      mockTargetClient.query.mockResolvedValue({ records: [existingTargetRecord] });

      const result = await CloningService.cloneRecord({
        sourceOrgId: 'source-org-id',
        targetOrgId: 'target-org-id',
        sourceRecordId: 'a1234567890ABCDE',
        objectApiName: 'tc9_pr__Pay_Code__c'
      });

      expect(result.success).toBe(true);
      expect(result.recordId).toBe('b9876543210ZYXWV');
      expect(result.error).toBe('Record already exists in target org');
      expect(mockTargetClient.sobject).not.toHaveBeenCalled();
    });

    it('should handle duplicate check query failure gracefully', async () => {
      const sourceRecord = {
        Id: 'a1234567890ABCDE',
        Name: 'Test Record'
      };

      (ExternalIdUtils.detectExternalIdField as jest.Mock)
        .mockResolvedValue('tc9_edc__External_ID_Data_Creation__c');

      mockSourceClient.describe.mockResolvedValue({
        fields: [{ name: 'Id' }, { name: 'Name' }]
      });

      mockSourceClient.query.mockResolvedValue({ records: [sourceRecord] });

      // Mock query failure for duplicate check
      mockTargetClient.query.mockRejectedValueOnce(new Error('Query failed'));
      mockTargetClient.describe.mockResolvedValue({
        fields: [{ name: 'Id' }, { name: 'Name' }]
      });

      mockTargetClient.sobject.mockReturnValue({
        create: jest.fn().mockResolvedValue({ success: true, id: 'newId' })
      });

      const result = await CloningService.cloneRecord({
        sourceOrgId: 'source-org-id',
        targetOrgId: 'target-org-id',
        sourceRecordId: 'a1234567890ABCDE',
        objectApiName: 'tc9_pr__Pay_Code__c'
      });

      // Should continue with creation despite duplicate check failure
      expect(result.success).toBe(true);
      expect(mockTargetClient.sobject).toHaveBeenCalled();
    });
  });

  describe('Error Handling Tests', () => {
    it('should handle source record not found', async () => {
      (ExternalIdUtils.detectExternalIdField as jest.Mock)
        .mockResolvedValue('External_ID_Data_Creation__c');

      mockSourceClient.describe.mockResolvedValue({
        fields: [{ name: 'Id' }]
      });

      // No records found
      mockSourceClient.query.mockResolvedValue({ records: [] });

      const result = await CloningService.cloneRecord({
        sourceOrgId: 'source-org-id',
        targetOrgId: 'target-org-id',
        sourceRecordId: 'invalid-id',
        objectApiName: 'tc9_pr__Pay_Code__c'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Source record invalid-id not found');
    });

    it('should handle session manager connection failure', async () => {
      (sessionManager.getClient as jest.Mock).mockRejectedValue(new Error('Connection failed'));

      const result = await CloningService.cloneRecord({
        sourceOrgId: 'source-org-id',
        targetOrgId: 'target-org-id',
        sourceRecordId: 'a1234567890ABCDE',
        objectApiName: 'tc9_pr__Pay_Code__c'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Connection failed');
    });

    it('should handle target record creation failure', async () => {
      const sourceRecord = {
        Id: 'a1234567890ABCDE',
        Name: 'Test Record'
      };

      (ExternalIdUtils.detectExternalIdField as jest.Mock)
        .mockResolvedValue('External_ID_Data_Creation__c');

      mockSourceClient.describe.mockResolvedValue({
        fields: [{ name: 'Id' }, { name: 'Name' }]
      });

      mockSourceClient.query.mockResolvedValue({ records: [sourceRecord] });

      mockTargetClient.describe.mockResolvedValue({
        fields: [{ name: 'Id' }, { name: 'Name' }]
      });

      mockTargetClient.query.mockResolvedValue({ records: [] });

      // Mock creation failure
      mockTargetClient.sobject.mockReturnValue({
        create: jest.fn().mockResolvedValue({ success: false })
      });

      const result = await CloningService.cloneRecord({
        sourceOrgId: 'source-org-id',
        targetOrgId: 'target-org-id',
        sourceRecordId: 'a1234567890ABCDE',
        objectApiName: 'tc9_pr__Pay_Code__c'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to create record in target org');
    });

    it('should handle describe metadata failure', async () => {
      (ExternalIdUtils.detectExternalIdField as jest.Mock)
        .mockResolvedValue('External_ID_Data_Creation__c');

      mockSourceClient.describe.mockRejectedValue(new Error('Describe failed'));

      const result = await CloningService.cloneRecord({
        sourceOrgId: 'source-org-id',
        targetOrgId: 'target-org-id',
        sourceRecordId: 'a1234567890ABCDE',
        objectApiName: 'tc9_pr__Pay_Code__c'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Describe failed');
    });
  });

  describe('Different Salesforce Object Types Tests', () => {
    it('should handle Pay Code object cloning', async () => {
      const payCodeRecord = {
        Id: 'a1234567890ABCDE',
        Name: 'Regular Hours',
        'tc9_pr__Code__c': 'REG',
        'tc9_pr__Rate__c': 25.00,
        'tc9_pr__Type__c': 'Standard',
        'tc9_pr__Active__c': true
      };

      (ExternalIdUtils.detectExternalIdField as jest.Mock)
        .mockResolvedValue('tc9_edc__External_ID_Data_Creation__c');

      mockSourceClient.describe.mockResolvedValue({
        fields: [
          { name: 'Id' },
          { name: 'Name' },
          { name: 'tc9_pr__Code__c' },
          { name: 'tc9_pr__Rate__c' },
          { name: 'tc9_pr__Type__c' },
          { name: 'tc9_pr__Active__c' }
        ]
      });

      mockSourceClient.query.mockResolvedValue({ records: [payCodeRecord] });

      mockTargetClient.describe.mockResolvedValue({
        fields: [
          { name: 'Id' },
          { name: 'Name' },
          { name: 'tc9_pr__Code__c' },
          { name: 'tc9_pr__Rate__c' },
          { name: 'tc9_pr__Type__c' },
          { name: 'tc9_pr__Active__c' },
          { name: 'tc9_edc__External_ID_Data_Creation__c' }
        ]
      });

      mockTargetClient.query.mockResolvedValue({ records: [] });

      mockTargetClient.sobject.mockReturnValue({
        create: jest.fn().mockResolvedValue({ success: true, id: 'newId' })
      });

      const result = await CloningService.cloneRecord({
        sourceOrgId: 'source-org-id',
        targetOrgId: 'target-org-id',
        sourceRecordId: 'a1234567890ABCDE',
        objectApiName: 'tc9_pr__Pay_Code__c'
      });

      expect(result.success).toBe(true);
      const createCall = mockTargetClient.sobject('tc9_pr__Pay_Code__c').create;
      expect(createCall).toHaveBeenCalledWith(expect.objectContaining({
        Name: 'Regular Hours',
        'tc9_pr__Code__c': 'REG',
        'tc9_pr__Rate__c': 25.00,
        'tc9_pr__Type__c': 'Standard',
        'tc9_pr__Active__c': true
      }));
    });

    it('should handle Leave Rule object cloning', async () => {
      const leaveRuleRecord = {
        Id: 'a5Y9r0000005siwEAA',
        Name: 'Annual Leave',
        'tc9_pr__Leave_Type__c': 'Annual',
        'tc9_pr__Accrual_Rate__c': 4.0,
        'tc9_pr__Maximum_Balance__c': 160,
        'tc9_pr__Active__c': true
      };

      (ExternalIdUtils.detectExternalIdField as jest.Mock)
        .mockResolvedValue('tc9_edc__External_ID_Data_Creation__c');

      mockSourceClient.describe.mockResolvedValue({
        fields: [
          { name: 'Id' },
          { name: 'Name' },
          { name: 'tc9_pr__Leave_Type__c' },
          { name: 'tc9_pr__Accrual_Rate__c' },
          { name: 'tc9_pr__Maximum_Balance__c' },
          { name: 'tc9_pr__Active__c' }
        ]
      });

      mockSourceClient.query.mockResolvedValue({ records: [leaveRuleRecord] });

      mockTargetClient.describe.mockResolvedValue({
        fields: [
          { name: 'Id' },
          { name: 'Name' },
          { name: 'tc9_pr__Leave_Type__c' },
          { name: 'tc9_pr__Accrual_Rate__c' },
          { name: 'tc9_pr__Maximum_Balance__c' },
          { name: 'tc9_pr__Active__c' },
          { name: 'tc9_edc__External_ID_Data_Creation__c' }
        ]
      });

      mockTargetClient.query.mockResolvedValue({ records: [] });

      mockTargetClient.sobject.mockReturnValue({
        create: jest.fn().mockResolvedValue({ success: true, id: 'newLeaveRuleId' })
      });

      const result = await CloningService.cloneRecord({
        sourceOrgId: 'source-org-id',
        targetOrgId: 'target-org-id',
        sourceRecordId: 'a5Y9r0000005siwEAA',
        objectApiName: 'tc9_pr__Leave_Rule__c'
      });

      expect(result.success).toBe(true);
      const createCall = mockTargetClient.sobject('tc9_pr__Leave_Rule__c').create;
      expect(createCall).toHaveBeenCalledWith(expect.objectContaining({
        Name: 'Annual Leave',
        'tc9_pr__Leave_Type__c': 'Annual',
        'tc9_pr__Accrual_Rate__c': 4.0,
        'tc9_pr__Maximum_Balance__c': 160,
        'tc9_pr__Active__c': true
      }));
    });

    it('should skip lookup fields during cloning', async () => {
      const recordWithLookup = {
        Id: 'a1234567890ABCDE',
        Name: 'Test Record',
        'tc9_pr__Parent_Code__c': 'a9876543210ZYXWV', // Lookup field
        'tc9_pr__Type__c': 'Standard'
      };

      (ExternalIdUtils.detectExternalIdField as jest.Mock)
        .mockResolvedValue('tc9_edc__External_ID_Data_Creation__c');

      mockSourceClient.describe.mockResolvedValue({
        fields: [
          { name: 'Id', type: 'id' },
          { name: 'Name', type: 'string' },
          { name: 'tc9_pr__Parent_Code__c', type: 'reference' },
          { name: 'tc9_pr__Type__c', type: 'string' }
        ]
      });

      mockSourceClient.query.mockResolvedValue({ records: [recordWithLookup] });

      mockTargetClient.describe.mockResolvedValue({
        fields: [
          { name: 'Id', type: 'id' },
          { name: 'Name', type: 'string' },
          { name: 'tc9_pr__Parent_Code__c', type: 'reference' },
          { name: 'tc9_pr__Type__c', type: 'string' },
          { name: 'tc9_edc__External_ID_Data_Creation__c', type: 'string' }
        ]
      });

      mockTargetClient.query.mockResolvedValue({ records: [] });

      mockTargetClient.sobject.mockReturnValue({
        create: jest.fn().mockResolvedValue({ success: true, id: 'newId' })
      });

      await CloningService.cloneRecord({
        sourceOrgId: 'source-org-id',
        targetOrgId: 'target-org-id',
        sourceRecordId: 'a1234567890ABCDE',
        objectApiName: 'tc9_pr__Pay_Code__c'
      });

      const createCall = mockTargetClient.sobject('tc9_pr__Pay_Code__c').create;
      const createdRecord = createCall.mock.calls[0][0];

      // Verify lookup field was skipped
      expect(createdRecord).not.toHaveProperty('tc9_pr__Parent_Code__c');
      expect(createdRecord).toHaveProperty('Name', 'Test Record');
      expect(createdRecord).toHaveProperty('tc9_pr__Type__c', 'Standard');
    });
  });

  describe('Special Field Name Mapping Tests', () => {
    it('should handle External_ID_Data_Creation__c field mapping correctly', async () => {
      const sourceRecord = {
        Id: 'a1234567890ABCDE',
        Name: 'Test',
        'External_ID_Data_Creation__c': 'EXT123'
      };

      (ExternalIdUtils.detectExternalIdField as jest.Mock)
        .mockResolvedValueOnce('External_ID_Data_Creation__c') // source unmanaged
        .mockResolvedValueOnce('tc9_edc__External_ID_Data_Creation__c'); // target managed

      mockSourceClient.describe.mockResolvedValue({
        fields: [
          { name: 'Id' },
          { name: 'Name' },
          { name: 'External_ID_Data_Creation__c' }
        ]
      });

      mockSourceClient.query.mockResolvedValue({ records: [sourceRecord] });

      mockTargetClient.describe.mockResolvedValue({
        fields: [
          { name: 'Id' },
          { name: 'Name' },
          { name: 'tc9_edc__External_ID_Data_Creation__c' }
        ]
      });

      mockTargetClient.query.mockResolvedValue({ records: [] });

      mockTargetClient.sobject.mockReturnValue({
        create: jest.fn().mockResolvedValue({ success: true, id: 'newId' })
      });

      await CloningService.cloneRecord({
        sourceOrgId: 'source-org-id',
        targetOrgId: 'target-org-id',
        sourceRecordId: 'a1234567890ABCDE',
        objectApiName: 'tc9_pr__Pay_Code__c'
      });

      const createCall = mockTargetClient.sobject('tc9_pr__Pay_Code__c').create;
      expect(createCall).toHaveBeenCalledWith(expect.objectContaining({
        'tc9_edc__External_ID_Data_Creation__c': 'a1234567890ABCDE' // Source record ID
      }));
    });

    it('should handle null values in source record', async () => {
      const sourceRecord = {
        Id: 'a1234567890ABCDE',
        Name: 'Test Record',
        'tc9_pr__Rate__c': null,
        'tc9_pr__Type__c': 'Standard',
        'tc9_pr__Description__c': undefined
      };

      (ExternalIdUtils.detectExternalIdField as jest.Mock)
        .mockResolvedValue('tc9_edc__External_ID_Data_Creation__c');

      mockSourceClient.describe.mockResolvedValue({
        fields: [
          { name: 'Id' },
          { name: 'Name' },
          { name: 'tc9_pr__Rate__c' },
          { name: 'tc9_pr__Type__c' },
          { name: 'tc9_pr__Description__c' }
        ]
      });

      mockSourceClient.query.mockResolvedValue({ records: [sourceRecord] });

      mockTargetClient.describe.mockResolvedValue({
        fields: [
          { name: 'Id' },
          { name: 'Name' },
          { name: 'tc9_pr__Rate__c' },
          { name: 'tc9_pr__Type__c' },
          { name: 'tc9_pr__Description__c' },
          { name: 'tc9_edc__External_ID_Data_Creation__c' }
        ]
      });

      mockTargetClient.query.mockResolvedValue({ records: [] });

      mockTargetClient.sobject.mockReturnValue({
        create: jest.fn().mockResolvedValue({ success: true, id: 'newId' })
      });

      await CloningService.cloneRecord({
        sourceOrgId: 'source-org-id',
        targetOrgId: 'target-org-id',
        sourceRecordId: 'a1234567890ABCDE',
        objectApiName: 'tc9_pr__Pay_Code__c'
      });

      const createCall = mockTargetClient.sobject('tc9_pr__Pay_Code__c').create;
      const createdRecord = createCall.mock.calls[0][0];

      // Verify null/undefined values were not included
      expect(createdRecord).not.toHaveProperty('tc9_pr__Rate__c');
      expect(createdRecord).not.toHaveProperty('tc9_pr__Description__c');
      expect(createdRecord).toHaveProperty('Name', 'Test Record');
      expect(createdRecord).toHaveProperty('tc9_pr__Type__c', 'Standard');
    });

    it('should skip relationship fields ending with __r', async () => {
      const sourceRecord = {
        Id: 'a1234567890ABCDE',
        Name: 'Test Record',
        'tc9_pr__Parent_Code__r': { Id: 'a9876543210ZYXWV', Name: 'Parent' }, // Relationship field
        'tc9_pr__Parent_Code__c': 'a9876543210ZYXWV', // Lookup field (starts with 'a', will be skipped)
        'tc9_pr__Type__c': 'Standard'
      };

      (ExternalIdUtils.detectExternalIdField as jest.Mock)
        .mockResolvedValue('tc9_edc__External_ID_Data_Creation__c');

      mockSourceClient.describe.mockResolvedValue({
        fields: [
          { name: 'Id', type: 'id' },
          { name: 'Name', type: 'string' },
          { name: 'tc9_pr__Parent_Code__c', type: 'reference' },
          { name: 'tc9_pr__Type__c', type: 'string' }
        ]
      });

      mockSourceClient.query.mockResolvedValue({ records: [sourceRecord] });

      mockTargetClient.describe.mockResolvedValue({
        fields: [
          { name: 'Id', type: 'id' },
          { name: 'Name', type: 'string' },
          { name: 'tc9_pr__Parent_Code__c', type: 'reference' },
          { name: 'tc9_pr__Type__c', type: 'string' },
          { name: 'tc9_edc__External_ID_Data_Creation__c', type: 'string' }
        ]
      });

      mockTargetClient.query.mockResolvedValue({ records: [] });

      mockTargetClient.sobject.mockReturnValue({
        create: jest.fn().mockResolvedValue({ success: true, id: 'newId' })
      });

      await CloningService.cloneRecord({
        sourceOrgId: 'source-org-id',
        targetOrgId: 'target-org-id',
        sourceRecordId: 'a1234567890ABCDE',
        objectApiName: 'tc9_pr__Pay_Code__c'
      });

      const createCall = mockTargetClient.sobject('tc9_pr__Pay_Code__c').create;
      const createdRecord = createCall.mock.calls[0][0];

      // Verify relationship field was skipped
      expect(createdRecord).not.toHaveProperty('tc9_pr__Parent_Code__r');
      // Verify lookup field was also skipped (as it's a reference to another record starting with 'a')
      expect(createdRecord).not.toHaveProperty('tc9_pr__Parent_Code__c');
    });
  });
});
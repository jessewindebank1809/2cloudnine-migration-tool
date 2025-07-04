import { describe, it, expect } from '@jest/globals';
import { payrateLoadingTemplate } from '../../../src/lib/migration/templates/definitions/payroll/payrate-loading.template';

describe('PayRate Loading Template', () => {
  it('should have the correct basic configuration', () => {
    expect(payrateLoadingTemplate.id).toBe('payroll-payrate-loading');
    expect(payrateLoadingTemplate.name).toBe('PayRate Loading');
    expect(payrateLoadingTemplate.category).toBe('payroll');
    expect(payrateLoadingTemplate.version).toBe('1.0.0');
  });

  describe('ETL Steps', () => {
    it('should have correct number of ETL steps', () => {
      expect(payrateLoadingTemplate.etlSteps).toHaveLength(1);
      const step = payrateLoadingTemplate.etlSteps[0];
      expect(step.stepName).toBe('payrateLoadingMaster');
      expect(step.stepOrder).toBe(1);
    });

    it('should have correct extract configuration', () => {
      const extractConfig = payrateLoadingTemplate.etlSteps[0].extractConfig;
      expect(extractConfig.objectApiName).toBe('tc9_et__PayRate_Loading__c');
      expect(extractConfig.batchSize).toBe(2000);
      expect(extractConfig.soqlQuery).toContain('SELECT Id, Name');
      expect(extractConfig.soqlQuery).toContain('tc9_et__PayRate_Loading__c');
    });

    it('should have comprehensive field mappings', () => {
      const fieldMappings = payrateLoadingTemplate.etlSteps[0].transformConfig.fieldMappings;
      
      // Check system fields
      expect(fieldMappings.find(m => m.sourceField === 'Id')).toBeDefined();
      expect(fieldMappings.find(m => m.sourceField === 'Name')).toBeDefined();
      expect(fieldMappings.find(m => m.sourceField === 'OwnerId')).toBeDefined();
      
      // Check custom fields
      const customFields = [
        'tc9_et__Agency_Client__c',
        'tc9_et__Approval_Date__c',
        'tc9_et__Award__c',
        'tc9_et__Business_Group__c',
        'tc9_et__Client__c',
        'tc9_et__Effective_Date__c',
        'tc9_et__End_Date__c',
        'tc9_et__Status__c',
        'tc9_et__Rate_Loading_Type__c',
        'tc9_et__Margin_Type__c',
        'tc9_et__Compliance_Type__c'
      ];
      
      customFields.forEach(field => {
        const mapping = fieldMappings.find(m => m.sourceField === field);
        expect(mapping).toBeDefined();
        expect(mapping?.targetField).toBe(field);
        expect(mapping?.transformationType).toBe('direct');
      });
    });

    it('should map all source fields correctly', () => {
      const fieldMappings = payrateLoadingTemplate.etlSteps[0].transformConfig.fieldMappings;
      const soqlQuery = payrateLoadingTemplate.etlSteps[0].extractConfig.soqlQuery;
      
      // Extract field names from SOQL query
      const fieldsInQuery = soqlQuery
        .match(/SELECT\s+([\s\S]+?)\s+FROM/i)?.[1]
        .split(',')
        .map(f => f.trim())
        .filter(f => f && !f.includes('{externalIdField}')) || [];
      
      // Check that all fields in query have mappings
      fieldsInQuery.forEach(field => {
        if (field !== 'CreatedDate' && field !== 'CreatedById' && 
            field !== 'LastModifiedDate' && field !== 'LastModifiedById' &&
            field !== 'SystemModstamp' && field !== 'LastActivityDate' &&
            field !== 'LastViewedDate' && field !== 'LastReferencedDate') {
          const mapping = fieldMappings.find(m => m.sourceField === field);
          expect(mapping).toBeDefined();
        }
      });
    });

    it('should have correct load configuration', () => {
      const loadConfig = payrateLoadingTemplate.etlSteps[0].loadConfig;
      expect(loadConfig.targetObject).toBe('tc9_et__PayRate_Loading__c');
      expect(loadConfig.operation).toBe('upsert');
      expect(loadConfig.externalIdField).toBe('{externalIdField}');
      expect(loadConfig.bulkApiConfig?.useBulkApi).toBe(true);
      expect(loadConfig.bulkApiConfig?.batchSize).toBe(10000);
    });
  });

  describe('Validation Configuration', () => {
    const validationConfig = payrateLoadingTemplate.etlSteps[0].validationConfig;

    it('should have data integrity checks', () => {
      expect(validationConfig).toBeDefined();
      expect(validationConfig?.dataIntegrityChecks).toHaveLength(3);
      
      const nameCheck = validationConfig?.dataIntegrityChecks.find(c => c.checkName === 'name-required');
      expect(nameCheck).toBeDefined();
      expect(nameCheck?.severity).toBe('error');
      
      const externalIdCheck = validationConfig?.dataIntegrityChecks.find(c => c.checkName === 'external-id-check');
      expect(externalIdCheck).toBeDefined();
      expect(externalIdCheck?.severity).toBe('warning');
      
      const dateCheck = validationConfig?.dataIntegrityChecks.find(c => c.checkName === 'effective-date-check');
      expect(dateCheck).toBeDefined();
      expect(dateCheck?.severity).toBe('error');
    });

    it('should have picklist validation checks', () => {
      const picklistChecks = validationConfig?.picklistValidationChecks;
      expect(picklistChecks).toHaveLength(4);
      
      const expectedPicklists = [
        'status-picklist',
        'rate-loading-type-picklist',
        'margin-type-picklist',
        'compliance-type-picklist'
      ];
      
      expectedPicklists.forEach(checkName => {
        const check = picklistChecks?.find(c => c.checkName === checkName);
        expect(check).toBeDefined();
        expect(check?.validateAgainstTarget).toBe(true);
        expect(check?.severity).toBe('warning');
      });
    });
  });

  describe('Metadata', () => {
    it('should have correct metadata configuration', () => {
      const metadata = payrateLoadingTemplate.metadata;
      expect(metadata.author).toBe('System');
      expect(metadata.supportedApiVersions).toContain('59.0');
      expect(metadata.supportedApiVersions).toContain('60.0');
      expect(metadata.supportedApiVersions).toContain('61.0');
      expect(metadata.requiredPermissions).toContain('tc9_et__PayRate_Loading__c.Create');
      expect(metadata.requiredPermissions).toContain('tc9_et__PayRate_Loading__c.Edit');
      expect(metadata.estimatedDuration).toBe(30);
      expect(metadata.complexity).toBe('moderate');
    });
  });

  describe('Execution Order', () => {
    it('should have correct execution order', () => {
      expect(payrateLoadingTemplate.executionOrder).toEqual(['payrateLoadingMaster']);
    });
  });
});
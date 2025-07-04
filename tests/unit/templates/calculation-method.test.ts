import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { calculationMethodTemplate, calculationMethodTemplateHooks } from '../../../src/lib/migration/templates/definitions/payroll/calculation-method.template';
import { Connection } from 'jsforce';

describe('calculationMethodTemplate', () => {
  describe('template structure', () => {
    it('should have the correct template properties', () => {
      expect(calculationMethodTemplate.id).toBe('payroll-calculation-method');
      expect(calculationMethodTemplate.name).toBe('Calculation Method');
      expect(calculationMethodTemplate.category).toBe('payroll');
      expect(calculationMethodTemplate.version).toBe('1.0.0');
    });

    it('should have one ETL step', () => {
      expect(calculationMethodTemplate.etlSteps).toHaveLength(1);
      expect(calculationMethodTemplate.etlSteps[0].stepName).toBe('calculationMethodMaster');
    });

    it('should have all fields in SOQL query', () => {
      const soqlQuery = calculationMethodTemplate.etlSteps[0].extractConfig.soqlQuery;
      
      // Standard fields
      expect(soqlQuery).toContain('Id');
      expect(soqlQuery).toContain('Name');
      expect(soqlQuery).toContain('OwnerId');
      expect(soqlQuery).toContain('CreatedDate');
      expect(soqlQuery).toContain('CreatedById');
      expect(soqlQuery).toContain('LastModifiedDate');
      expect(soqlQuery).toContain('LastModifiedById');
      expect(soqlQuery).toContain('SystemModstamp');
      
      // Custom fields
      expect(soqlQuery).toContain('tc9_et__Legacy_Id__c');
      expect(soqlQuery).toContain('tc9_et__Rebilling_Method__c');
      expect(soqlQuery).toContain('tc9_et__Usage__c');
      expect(soqlQuery).toContain('tc9_et__Accumulation_Period__c');
      expect(soqlQuery).toContain('tc9_et__Application_Scope__c');
      expect(soqlQuery).toContain('tc9_et__Basis__c');
      expect(soqlQuery).toContain('tc9_et__Method__c');
      expect(soqlQuery).toContain('tc9_et__Rounding_Direction__c');
      expect(soqlQuery).toContain('tc9_et__Type__c');
    });

    it('should have correct object API name', () => {
      expect(calculationMethodTemplate.etlSteps[0].extractConfig.objectApiName).toBe('tc9_et__Calculation_Method__c');
      expect(calculationMethodTemplate.etlSteps[0].loadConfig.targetObject).toBe('tc9_et__Calculation_Method__c');
    });
  });

  describe('field mappings', () => {
    const fieldMappings = calculationMethodTemplate.etlSteps[0].transformConfig.fieldMappings;

    it('should have all required field mappings', () => {
      const sourceFields = fieldMappings.map(fm => fm.sourceField);
      
      // Check some key fields
      expect(sourceFields).toContain('Id');
      expect(sourceFields).toContain('Name');
      expect(sourceFields).toContain('tc9_et__Rebilling_Method__c');
      expect(sourceFields).toContain('tc9_et__Usage__c');
      expect(sourceFields).toContain('tc9_et__Method__c');
      expect(sourceFields).toContain('tc9_et__Type__c');
    });

    it('should have 1:1 mapping for all fields except Id', () => {
      fieldMappings.forEach(mapping => {
        if (mapping.sourceField !== 'Id') {
          expect(mapping.sourceField).toBe(mapping.targetField);
        }
      });
    });

    it('should map Id to external ID field placeholder', () => {
      const idMapping = fieldMappings.find(fm => fm.sourceField === 'Id');
      expect(idMapping?.targetField).toBe('{externalIdField}');
      expect(idMapping?.isRequired).toBe(true);
    });

    it('should mark Name as required', () => {
      const nameMapping = fieldMappings.find(fm => fm.sourceField === 'Name');
      expect(nameMapping?.isRequired).toBe(true);
    });

    it('should use direct transformation for all fields', () => {
      fieldMappings.forEach(mapping => {
        expect(mapping.transformationType).toBe('direct');
      });
    });
  });

  describe('validation configuration', () => {
    const validationConfig = calculationMethodTemplate.etlSteps[0].validationConfig;

    it('should have data integrity checks', () => {
      expect(validationConfig).toBeDefined();
      expect(validationConfig?.dataIntegrityChecks).toHaveLength(2);
      
      const nameCheck = validationConfig?.dataIntegrityChecks.find(c => c.checkName === 'name-required');
      expect(nameCheck).toBeDefined();
      expect(nameCheck?.severity).toBe('error');
      
      const externalIdCheck = validationConfig?.dataIntegrityChecks.find(c => c.checkName === 'external-id-check');
      expect(externalIdCheck).toBeDefined();
      expect(externalIdCheck?.severity).toBe('warning');
    });

    it('should have picklist validation checks for all picklist fields', () => {
      const picklistChecks = validationConfig?.picklistValidationChecks;
      
      const expectedPicklists = [
        'rebilling-method-picklist',
        'usage-picklist',
        'accumulation-period-picklist',
        'application-scope-picklist',
        'basis-picklist',
        'behaviour-picklist',
        'method-picklist',
        'rounding-direction-picklist',
        'rounding-precision-picklist',
        'type-picklist'
      ];
      
      expectedPicklists.forEach(checkName => {
        const check = picklistChecks?.find(c => c.checkName === checkName);
        expect(check).toBeDefined();
        expect(check?.validateAgainstTarget).toBe(true);
        expect(check?.severity).toBe('warning');
      });
    });
  });

  describe('load configuration', () => {
    const loadConfig = calculationMethodTemplate.etlSteps[0].loadConfig;

    it('should use upsert operation with external ID', () => {
      expect(loadConfig.operation).toBe('upsert');
      expect(loadConfig.externalIdField).toBe('{externalIdField}');
    });

    it('should use bulk API with correct batch size', () => {
      expect(loadConfig.useBulkApi).toBe(true);
      expect(loadConfig.batchSize).toBe(200);
    });

    it('should have retry configuration', () => {
      expect(loadConfig.retryConfig.maxRetries).toBe(3);
      expect(loadConfig.retryConfig.retryWaitSeconds).toBe(5);
      expect(loadConfig.retryConfig.retryableErrors).toContain('UNABLE_TO_LOCK_ROW');
      expect(loadConfig.retryConfig.retryableErrors).toContain('REQUEST_LIMIT_EXCEEDED');
    });
  });

  describe('template metadata', () => {
    it('should have correct metadata', () => {
      const metadata = calculationMethodTemplate.metadata;
      
      expect(metadata.author).toBe('System');
      expect(metadata.supportedApiVersions).toContain('59.0');
      expect(metadata.supportedApiVersions).toContain('60.0');
      expect(metadata.supportedApiVersions).toContain('61.0');
      expect(metadata.requiredPermissions).toContain('tc9_et__Calculation_Method__c.Create');
      expect(metadata.requiredPermissions).toContain('tc9_et__Calculation_Method__c.Edit');
      expect(metadata.estimatedDuration).toBe(15);
      expect(metadata.complexity).toBe('moderate');
    });
  });

  describe('template hooks', () => {
    it('should export all required hooks', () => {
      expect(calculationMethodTemplateHooks.preMigration).toBeDefined();
      expect(calculationMethodTemplateHooks.postExtract).toBeDefined();
      expect(calculationMethodTemplateHooks.preLoad).toBeDefined();
      expect(calculationMethodTemplateHooks.postMigration).toBeDefined();
    });

    it('should have preMigration hook that handles external ID field', async () => {
      const mockContext = {
        targetOrgConnection: {},
        template: {
          etlSteps: [{
            extractConfig: { soqlQuery: 'SELECT {externalIdField} FROM Test' },
            transformConfig: { 
              fieldMappings: [{ targetField: '{externalIdField}' }] 
            },
            loadConfig: { externalIdField: '{externalIdField}' },
            validationConfig: {
              dataIntegrityChecks: [{
                validationQuery: 'SELECT {externalIdField} FROM Test'
              }]
            }
          }]
        }
      };

      // Mock the ExternalIdUtils to avoid actual API calls
      const result = await calculationMethodTemplateHooks.preMigration(mockContext);
      expect(result.success).toBe(true);
    });
  });
});
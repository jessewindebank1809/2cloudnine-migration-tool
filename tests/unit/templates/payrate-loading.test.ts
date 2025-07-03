import { describe, it, expect } from '@jest/globals';
import { payrateLoadingTemplate, type PayrateLoadingRecord } from '../../../src/lib/migration/templates/definitions/payroll/payrate-loading.template';

describe('PayRate Loading Template', () => {
  describe('Template Configuration', () => {
    it('should have correct basic configuration', () => {
      expect(payrateLoadingTemplate.id).toBe('payroll-payrate-loading');
      expect(payrateLoadingTemplate.name).toBe('PayRate Loading');
      expect(payrateLoadingTemplate.category).toBe('payroll');
      expect(payrateLoadingTemplate.version).toBe('1.0.0');
    });

    it('should have ETL steps configured', () => {
      expect(payrateLoadingTemplate.etlSteps).toHaveLength(4);
      
      const extractStep = payrateLoadingTemplate.etlSteps[0];
      expect(extractStep.operation).toBe('extract');
      expect(extractStep.sourceObject).toBe('tc9_et__PayRate_Loading__c');
      expect(extractStep.batchSize).toBe(2000);
      
      const transformStep = payrateLoadingTemplate.etlSteps[1];
      expect(transformStep.operation).toBe('transform');
      expect(transformStep.fieldMappings).toBeDefined();
      
      const validateStep = payrateLoadingTemplate.etlSteps[2];
      expect(validateStep.operation).toBe('validate');
      expect(validateStep.validations).toBeDefined();
      
      const loadStep = payrateLoadingTemplate.etlSteps[3];
      expect(loadStep.operation).toBe('load');
      expect(loadStep.targetObject).toBe('tc9_et__PayRate_Loading__c');
      expect(loadStep.mode).toBe('upsert');
      expect(loadStep.externalIdField).toBe('tc9_et__External_ID__c');
    });
  });

  describe('Field Mappings', () => {
    it('should map all fields correctly', () => {
      const transformStep = payrateLoadingTemplate.etlSteps.find(step => step.operation === 'transform');
      const fieldMappings = transformStep?.fieldMappings || [];
      
      // Check key field mappings
      expect(fieldMappings).toContainEqual({ sourceField: 'Id', targetField: 'tc9_et__External_ID__c' });
      expect(fieldMappings).toContainEqual({ sourceField: 'Name', targetField: 'Name' });
      expect(fieldMappings).toContainEqual({ sourceField: 'tc9_et__Rate_Loading_Type__c', targetField: 'tc9_et__Rate_Loading_Type__c' });
      expect(fieldMappings).toContainEqual({ sourceField: 'tc9_et__Rate_Loading_Code__c', targetField: 'tc9_et__Rate_Loading_Code__c' });
      expect(fieldMappings).toContainEqual({ sourceField: 'tc9_et__Percentage__c', targetField: 'tc9_et__Percentage__c' });
      expect(fieldMappings).toContainEqual({ sourceField: 'tc9_et__Multiplier__c', targetField: 'tc9_et__Multiplier__c' });
      expect(fieldMappings).toContainEqual({ sourceField: 'tc9_et__Margin_Type__c', targetField: 'tc9_et__Margin_Type__c' });
      expect(fieldMappings).toContainEqual({ sourceField: 'tc9_et__Priority__c', targetField: 'tc9_et__Priority__c' });
    });

    it('should have 1:1 mapping for all custom fields', () => {
      const transformStep = payrateLoadingTemplate.etlSteps.find(step => step.operation === 'transform');
      const fieldMappings = transformStep?.fieldMappings || [];
      
      // All mappings should be 1:1 (sourceField matches targetField for custom fields)
      const customFieldMappings = fieldMappings.filter(mapping => 
        mapping.sourceField.startsWith('tc9_et__') && 
        mapping.targetField.startsWith('tc9_et__')
      );
      
      customFieldMappings.forEach(mapping => {
        expect(mapping.sourceField).toBe(mapping.targetField);
      });
    });
  });

  describe('Validation Rules', () => {
    it('should have required field validation', () => {
      const validateStep = payrateLoadingTemplate.etlSteps.find(step => step.operation === 'validate');
      const validations = validateStep?.validations || [];
      
      const requiredValidation = validations.find(v => v.type === 'required' && v.field === 'tc9_et__Rate_Loading_Type__c');
      expect(requiredValidation).toBeDefined();
      expect(requiredValidation?.message).toBe('Rate Loading Type is required');
    });

    it('should have picklist validations', () => {
      const validateStep = payrateLoadingTemplate.etlSteps.find(step => step.operation === 'validate');
      const validations = validateStep?.validations || [];
      
      const rateLoadingTypeValidation = validations.find(v => 
        v.type === 'picklist' && v.field === 'tc9_et__Rate_Loading_Type__c'
      );
      expect(rateLoadingTypeValidation).toBeDefined();
      expect((rateLoadingTypeValidation as any)?.allowedValues).toEqual([
        'Casual', 'Leave', 'Penalty', 'Other', 'Public Holiday', 'Overtime', 'Expense'
      ]);
      
      const marginTypeValidation = validations.find(v => 
        v.type === 'picklist' && v.field === 'tc9_et__Margin_Type__c'
      );
      expect(marginTypeValidation).toBeDefined();
      expect((marginTypeValidation as any)?.allowedValues).toEqual(['Amount', 'Percentage']);
    });

    it('should have date range validation', () => {
      const validateStep = payrateLoadingTemplate.etlSteps.find(step => step.operation === 'validate');
      const validations = validateStep?.validations || [];
      
      const dateRangeValidation = validations.find(v => v.type === 'dateRange');
      expect(dateRangeValidation).toBeDefined();
      expect((dateRangeValidation as any)?.startDateField).toBe('tc9_et__Effective_Date__c');
      expect((dateRangeValidation as any)?.endDateField).toBe('tc9_et__End_Date__c');
      expect(dateRangeValidation?.message).toBe('Effective Date cannot be after End Date');
    });

    it('should have numeric range validations', () => {
      const validateStep = payrateLoadingTemplate.etlSteps.find(step => step.operation === 'validate');
      const validations = validateStep?.validations || [];
      
      const percentageValidation = validations.find(v => 
        v.type === 'range' && v.field === 'tc9_et__Percentage__c'
      );
      expect(percentageValidation).toBeDefined();
      expect((percentageValidation as any)?.min).toBe(0);
      expect((percentageValidation as any)?.max).toBe(100);
      
      const multiplierValidation = validations.find(v => 
        v.type === 'range' && v.field === 'tc9_et__Multiplier__c'
      );
      expect(multiplierValidation).toBeDefined();
      expect((multiplierValidation as any)?.min).toBe(0);
      
      const priorityValidation = validations.find(v => 
        v.type === 'range' && v.field === 'tc9_et__Priority__c'
      );
      expect(priorityValidation).toBeDefined();
      expect((priorityValidation as any)?.min).toBe(0);
    });
  });

  describe('Data Integrity Rules', () => {
    it('should have unique rate loading code validation', () => {
      const dataIntegrityRule = payrateLoadingTemplate.validationRules?.find(
        rule => rule.name === 'unique-rate-loading-code'
      );
      
      expect(dataIntegrityRule).toBeDefined();
      expect(dataIntegrityRule?.type).toBe('dataIntegrity');
      expect((dataIntegrityRule as any)?.fields).toEqual(['tc9_et__Rate_Loading_Code__c']);
      expect((dataIntegrityRule as any)?.checkType).toBe('uniqueness');
    });
  });

  describe('Execution Metrics', () => {
    it('should have execution metrics configured', () => {
      expect(payrateLoadingTemplate.executionMetrics).toBeDefined();
      expect(payrateLoadingTemplate.executionMetrics?.estimatedDuration).toBe(15);
      expect(payrateLoadingTemplate.executionMetrics?.resourceRequirements).toEqual({
        memory: 'medium',
        cpu: 'low'
      });
    });
  });

  describe('Type Definitions', () => {
    it('should correctly type PayrateLoadingRecord', () => {
      const validRecord: PayrateLoadingRecord = {
        Id: 'a0X1234567890ABC',
        Name: 'PRL-000001',
        tc9_et__Rate_Loading_Type__c: 'Casual',
        tc9_et__Rate_Loading_Code__c: 'CAS001',
        tc9_et__Percentage__c: 25.0,
        tc9_et__Multiplier__c: 1.25,
        tc9_et__Margin_Type__c: 'Percentage',
        tc9_et__Priority__c: 1,
        tc9_et__is_Active__c: true
      };
      
      // TypeScript should compile this without errors
      expect(validRecord.tc9_et__Rate_Loading_Type__c).toBe('Casual');
      expect(validRecord.tc9_et__Margin_Type__c).toBe('Percentage');
    });
  });
});
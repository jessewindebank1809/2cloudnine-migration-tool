import { SoqlQueryBuilder } from '@/lib/migration/templates/utils/soql-builder';

describe('SoqlQueryBuilder', () => {
  describe('Query Validation', () => {
    it('should validate a correct SOQL query', () => {
      const query = 'SELECT Id, Name FROM Account';
      const errors = SoqlQueryBuilder.validateQuery(query);
      
      expect(errors).toHaveLength(0);
    });

    it('should detect missing SELECT clause', () => {
      const query = 'FROM Account';
      const errors = SoqlQueryBuilder.validateQuery(query);
      
      expect(errors).toContain('Query must start with SELECT');
    });

    it('should detect missing FROM clause', () => {
      const query = 'SELECT Id, Name';
      const errors = SoqlQueryBuilder.validateQuery(query);
      
      expect(errors).toContain('Query must include FROM clause');
    });

    it('should detect unreplaced external ID placeholders', () => {
      const query = 'SELECT Id, {externalIdField} FROM Account';
      const errors = SoqlQueryBuilder.validateQuery(query);
      
      expect(errors).toContain('Query contains unreplaced external ID field placeholders');
    });

    it('should detect unbalanced parentheses', () => {
      const query = 'SELECT Id, (SELECT Name FROM Contacts FROM Account';
      const errors = SoqlQueryBuilder.validateQuery(query);
      
      expect(errors).toContain('Unbalanced parentheses in query');
    });
  });

  describe('Object Name Extraction', () => {
    it('should extract object name from simple query', () => {
      const query = 'SELECT Id, Name FROM Account';
      const objectName = SoqlQueryBuilder.extractObjectName(query);
      
      expect(objectName).toBe('Account');
    });

    it('should extract object name from complex query', () => {
      const query = 'SELECT Id, Name FROM Contact WHERE Email != null ORDER BY Name';
      const objectName = SoqlQueryBuilder.extractObjectName(query);
      
      expect(objectName).toBe('Contact');
    });

    it('should return null for invalid query', () => {
      const query = 'SELECT Id, Name';
      const objectName = SoqlQueryBuilder.extractObjectName(query);
      
      expect(objectName).toBeNull();
    });
  });

  describe('Field Name Extraction', () => {
    it('should extract field names from simple query', () => {
      const query = 'SELECT Id, Name, Email FROM Contact';
      const fields = SoqlQueryBuilder.extractFieldNames(query);
      
      expect(fields).toEqual(['Id', 'Name', 'Email']);
    });

    it('should handle subqueries in field list', () => {
      const query = 'SELECT Id, Name, (SELECT Id FROM Contacts) FROM Account';
      const fields = SoqlQueryBuilder.extractFieldNames(query);
      
      expect(fields).toContain('Id');
      expect(fields).toContain('Name');
      expect(fields.some(field => field.includes('SELECT Id'))).toBe(true);
    });

    it('should return empty array for invalid query', () => {
      const query = 'FROM Account';
      const fields = SoqlQueryBuilder.extractFieldNames(query);
      
      expect(fields).toEqual([]);
    });
  });

  describe('WHERE Clause Addition', () => {
    it('should add WHERE clause to query without existing WHERE', () => {
      const baseQuery = 'SELECT Id, Name FROM Account';
      const condition = 'Type = \'Customer\'';
      
      // Using reflection to access private method for testing
      const result = (SoqlQueryBuilder as any).addWhereClause(baseQuery, condition);
      
      expect(result).toBe('SELECT Id, Name FROM Account WHERE Type = \'Customer\'');
    });

    it('should add AND condition to query with existing WHERE', () => {
      const baseQuery = 'SELECT Id, Name FROM Account WHERE Type = \'Customer\'';
      const condition = 'Industry = \'Technology\'';
      
      // Using reflection to access private method for testing
      const result = (SoqlQueryBuilder as any).addWhereClause(baseQuery, condition);
      
      expect(result).toBe('SELECT Id, Name FROM Account WHERE Type = \'Customer\' AND Industry = \'Technology\'');
    });
  });

  describe('Utility Queries', () => {
    it('should build validation query', () => {
      const query = SoqlQueryBuilder.buildValidationQuery(
        'Account',
        'External_Id__c',
        ['EXT001', 'EXT002']
      );
      
      expect(query).toBe('SELECT Id, External_Id__c, Name FROM Account WHERE External_Id__c IN (\'EXT001\',\'EXT002\')');
    });

    it('should build count query', () => {
      const baseQuery = 'SELECT Id, Name FROM Account WHERE Type = \'Customer\'';
      const countQuery = SoqlQueryBuilder.buildCountQuery(baseQuery);
      
      expect(countQuery).toBe('SELECT COUNT() FROM Account WHERE Type = \'Customer\'');
    });

    it('should build record type query', () => {
      const query = SoqlQueryBuilder.buildRecordTypeQuery('Account');
      
      expect(query).toBe('SELECT Id, Name, DeveloperName FROM RecordType WHERE SObjectType = \'Account\' AND IsActive = true');
    });

    it('should build lookup cache query', () => {
      const query = SoqlQueryBuilder.buildLookupCacheQuery(
        'Account',
        'External_Id__c',
        'Id',
        ['Name', 'Type']
      );
      
      expect(query).toBe('SELECT External_Id__c, Id, Name, Type FROM Account WHERE External_Id__c != null');
    });
  });

  describe('String Escaping', () => {
    it('should escape single quotes', () => {
      const escaped = SoqlQueryBuilder.escapeString('O\'Reilly');
      expect(escaped).toBe('O\\\\\'Reilly');
    });

    it('should escape backslashes', () => {
      const escaped = SoqlQueryBuilder.escapeString('C:\\Users\\Test');
      expect(escaped).toBe('C:\\\\Users\\\\Test');
    });

    it('should handle empty strings', () => {
      const escaped = SoqlQueryBuilder.escapeString('');
      expect(escaped).toBe('');
    });
  });

  describe('IN Clause Building', () => {
    it('should build single IN clause for small value sets', () => {
      const clauses = SoqlQueryBuilder.buildInClause('Id', ['001', '002', '003']);
      
      expect(clauses).toHaveLength(1);
      expect(clauses[0]).toBe('Id IN (\'001\',\'002\',\'003\')');
    });

    it('should chunk large value sets', () => {
      const values = Array.from({ length: 2500 }, (_, i) => `value${i}`);
      const clauses = SoqlQueryBuilder.buildInClause('External_Id__c', values, 1000);
      
      expect(clauses).toHaveLength(3); // 1000 + 1000 + 500
      expect(clauses[0]).toContain('External_Id__c IN (');
      expect(clauses[1]).toContain('External_Id__c IN (');
      expect(clauses[2]).toContain('External_Id__c IN (');
    });
  });

  describe('Query Optimization', () => {
    it('should add LIMIT to query without existing LIMIT', () => {
      const query = 'SELECT Id, Name FROM Account';
      const optimized = SoqlQueryBuilder.optimizeForBatch(query, 200);
      
      expect(optimized).toBe('SELECT Id, Name FROM Account LIMIT 200');
    });

    it('should not modify query with existing LIMIT', () => {
      const query = 'SELECT Id, Name FROM Account LIMIT 100';
      const optimized = SoqlQueryBuilder.optimizeForBatch(query, 200);
      
      expect(optimized).toBe('SELECT Id, Name FROM Account LIMIT 100');
    });

    it('should not add LIMIT when batch size is 0', () => {
      const query = 'SELECT Id, Name FROM Account';
      const optimized = SoqlQueryBuilder.optimizeForBatch(query, 0);
      
      expect(optimized).toBe('SELECT Id, Name FROM Account');
    });
  });
}); 
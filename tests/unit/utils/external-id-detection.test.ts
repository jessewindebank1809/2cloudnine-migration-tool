import { ExternalIdUtils } from '@/lib/migration/templates/utils/external-id-utils';

// Mock org connection for testing
class MockOrgConnection {
  private packageInstalled: boolean;
  private fieldsExist: { [key: string]: boolean };
  private shouldThrowError: string | null;

  constructor(
    packageInstalled: boolean = false,
    fieldsExist: { [key: string]: boolean } = {},
    shouldThrowError: string | null = null
  ) {
    this.packageInstalled = packageInstalled;
    this.fieldsExist = fieldsExist;
    this.shouldThrowError = shouldThrowError;
  }

  // Mock the connection property that SalesforceClient has
  get connection() {
    return {
      request: this.request.bind(this),
      query: this.query.bind(this)
    };
  }

  // Mock the request method for tooling API calls
  async request(url: string): Promise<any> {
    if (this.shouldThrowError) {
      throw new Error(this.shouldThrowError);
    }

    // Handle tooling API queries for package detection
    if (url.includes('InstalledSubscriberPackage')) {
      if (this.packageInstalled) {
        return {
          size: 1,
          totalSize: 1,
          done: true,
          queryLocator: null,
          entityTypeName: "InstalledSubscriberPackage",
          records: [
            {
              attributes: {
                type: "InstalledSubscriberPackage", 
                url: "/services/data/v63.0/tooling/sobjects/InstalledSubscriberPackage/0A3QE0000001KSw0AM"
              },
              SubscriberPackageNamespace: "tc9_edc"
            }
          ]
        };
      } else {
        return {
          size: 0,
          totalSize: 0,
          done: true,
          queryLocator: null,
          entityTypeName: "InstalledSubscriberPackage",
          records: []
        };
      }
    }

    return { success: false, data: [] };
  }

  async query(soql: string): Promise<any> {
    if (this.shouldThrowError) {
      throw new Error(this.shouldThrowError);
    }

    // Handle ApexClass fallback query for package detection - return legacy format for SOQL queries
    if (soql.includes('ApexClass') && soql.includes('NamespacePrefix')) {
      return {
        success: true,
        data: this.packageInstalled ? [{ Id: '123', NamespacePrefix: 'tc9_edc' }] : []
      };
    }

    // Handle field existence queries - return legacy format for SOQL queries
    if (soql.includes('SELECT ') && soql.includes(' FROM ')) {
      // Extract field name from query like "SELECT fieldName FROM objectName LIMIT 1"
      const fieldMatch = soql.match(/SELECT\s+(\w+(?:__\w+)?(?:__c)?)\s+FROM/i);
      if (fieldMatch) {
        const fieldName = fieldMatch[1];
        const exists = this.fieldsExist[fieldName] || false;
        return {
          success: exists,
          data: exists ? [{}] : []
        };
      }
    }

    return { success: false, data: [] };
  }
}

describe('ExternalIdUtils - Revised Detection Logic', () => {
  describe('Package Detection', () => {
    it('should detect managed package when InstalledSubscriberPackage query succeeds', async () => {
      const mockOrg = new MockOrgConnection(true);
      
      const result = await ExternalIdUtils.detectEnvironmentExternalIdInfo(
        'tc9_et__Interpretation_Rule__c',
        mockOrg
      );

      expect(result.packageType).toBe('managed');
      expect(result.externalIdField).toBe('tc9_edc__External_ID_Data_Creation__c');
      expect(result.detectedFields).toEqual(['tc9_edc__External_ID_Data_Creation__c']);
      expect(result.fallbackUsed).toBe(false);
    });

    it('should detect managed package using fallback ApexClass query', async () => {
      // Mock scenario where InstalledSubscriberPackage fails but ApexClass succeeds
      let queryCount = 0;
      const mockOrg = {
        query: async (soql: string) => {
          queryCount++;
          if (soql.includes('InstalledSubscriberPackage')) {
            throw new Error('Permission denied');
          }
          if (soql.includes('ApexClass') && soql.includes('NamespacePrefix')) {
            return {
              success: true,
              data: [{ Id: '123', NamespacePrefix: 'tc9_edc' }]
            };
          }
          return { success: false, data: [] };
        }
      };
      
      const result = await ExternalIdUtils.detectEnvironmentExternalIdInfo(
        'tc9_et__Interpretation_Rule__c',
        mockOrg
      );

      expect(result.packageType).toBe('managed');
      expect(result.externalIdField).toBe('tc9_edc__External_ID_Data_Creation__c');
    });

    it('should handle package detection failure gracefully', async () => {
      const mockOrg = new MockOrgConnection(false, {
        'External_ID_Data_Creation__c': true
      });
      
      const result = await ExternalIdUtils.detectEnvironmentExternalIdInfo(
        'tc9_et__Interpretation_Rule__c',
        mockOrg
      );

      expect(result.packageType).toBe('unmanaged');
      expect(result.externalIdField).toBe('External_ID_Data_Creation__c');
    });
  });

  describe('Field Detection Logic', () => {
    it('should use unmanaged field when package not installed and field exists', async () => {
      const mockOrg = new MockOrgConnection(false, {
        'External_ID_Data_Creation__c': true
      });
      
      const result = await ExternalIdUtils.detectEnvironmentExternalIdInfo(
        'tc9_et__Interpretation_Rule__c',
        mockOrg
      );

      expect(result.packageType).toBe('unmanaged');
      expect(result.externalIdField).toBe('External_ID_Data_Creation__c');
      expect(result.detectedFields).toEqual(['External_ID_Data_Creation__c']);
      expect(result.fallbackUsed).toBe(false);
    });

    it('should use fallback field when package not installed and unmanaged field missing', async () => {
      const mockOrg = new MockOrgConnection(false, {
        'External_Id__c': true
      });
      
      const result = await ExternalIdUtils.detectEnvironmentExternalIdInfo(
        'tc9_et__Interpretation_Rule__c',
        mockOrg
      );

      expect(result.packageType).toBe('unmanaged');
      expect(result.externalIdField).toBe('External_Id__c');
      expect(result.detectedFields).toEqual(['External_Id__c']);
      expect(result.fallbackUsed).toBe(true);
    });

    it('should default to managed when no fields exist', async () => {
      const mockOrg = new MockOrgConnection(false, {});
      
      const result = await ExternalIdUtils.detectEnvironmentExternalIdInfo(
        'tc9_et__Interpretation_Rule__c',
        mockOrg
      );

      expect(result.packageType).toBe('managed');
      expect(result.externalIdField).toBe('tc9_edc__External_ID_Data_Creation__c');
      expect(result.detectedFields).toEqual([]);
      expect(result.fallbackUsed).toBe(true);
    });
  });

  describe('Cross-Environment Scenarios', () => {
    it('should correctly identify managed to managed scenario', async () => {
      const sourceInfo = {
        packageType: 'managed' as const,
        externalIdField: 'tc9_edc__External_ID_Data_Creation__c',
        detectedFields: ['tc9_edc__External_ID_Data_Creation__c'],
        fallbackUsed: false,
      };

      const targetInfo = {
        packageType: 'managed' as const,
        externalIdField: 'tc9_edc__External_ID_Data_Creation__c',
        detectedFields: ['tc9_edc__External_ID_Data_Creation__c'],
        fallbackUsed: false,
      };

      const config = await ExternalIdUtils.detectCrossEnvironmentMapping(sourceInfo, targetInfo);

      expect(config.strategy).toBe('auto-detect');
      expect(config.crossEnvironmentMapping).toBeUndefined();
      expect(config.sourceField).toBe('tc9_edc__External_ID_Data_Creation__c');
      expect(config.targetField).toBe('tc9_edc__External_ID_Data_Creation__c');
    });

    it('should correctly identify managed to unmanaged cross-environment scenario', async () => {
      const sourceInfo = {
        packageType: 'managed' as const,
        externalIdField: 'tc9_edc__External_ID_Data_Creation__c',
        detectedFields: ['tc9_edc__External_ID_Data_Creation__c'],
        fallbackUsed: false,
      };

      const targetInfo = {
        packageType: 'unmanaged' as const,
        externalIdField: 'External_ID_Data_Creation__c',
        detectedFields: ['External_ID_Data_Creation__c'],
        fallbackUsed: false,
      };

      const config = await ExternalIdUtils.detectCrossEnvironmentMapping(sourceInfo, targetInfo);

      expect(config.strategy).toBe('cross-environment');
      expect(config.crossEnvironmentMapping).toBeDefined();
      expect(config.crossEnvironmentMapping?.sourcePackageType).toBe('managed');
      expect(config.crossEnvironmentMapping?.targetPackageType).toBe('unmanaged');
      expect(config.sourceField).toBe('tc9_edc__External_ID_Data_Creation__c');
      expect(config.targetField).toBe('External_ID_Data_Creation__c');
    });

    it('should correctly identify unmanaged to managed cross-environment scenario', async () => {
      const sourceInfo = {
        packageType: 'unmanaged' as const,
        externalIdField: 'External_ID_Data_Creation__c',
        detectedFields: ['External_ID_Data_Creation__c'],
        fallbackUsed: false,
      };

      const targetInfo = {
        packageType: 'managed' as const,
        externalIdField: 'tc9_edc__External_ID_Data_Creation__c',
        detectedFields: ['tc9_edc__External_ID_Data_Creation__c'],
        fallbackUsed: false,
      };

      const config = await ExternalIdUtils.detectCrossEnvironmentMapping(sourceInfo, targetInfo);

      expect(config.strategy).toBe('cross-environment');
      expect(config.crossEnvironmentMapping).toBeDefined();
      expect(config.crossEnvironmentMapping?.sourcePackageType).toBe('unmanaged');
      expect(config.crossEnvironmentMapping?.targetPackageType).toBe('managed');
      expect(config.sourceField).toBe('External_ID_Data_Creation__c');
      expect(config.targetField).toBe('tc9_edc__External_ID_Data_Creation__c');
    });
  });

  describe('Error Handling', () => {
    it('should handle complete query failures gracefully', async () => {
      const mockOrg = new MockOrgConnection(false, {}, 'Complete database failure');
      
      const result = await ExternalIdUtils.detectEnvironmentExternalIdInfo(
        'tc9_et__Interpretation_Rule__c',
        mockOrg
      );

      expect(result.packageType).toBe('managed');
      expect(result.externalIdField).toBe('tc9_edc__External_ID_Data_Creation__c');
      expect(result.fallbackUsed).toBe(true);
    });

    it('should handle partial query failures', async () => {
      let queryCount = 0;
      const mockOrg = {
        query: async (soql: string) => {
          queryCount++;
          
          // Fail package detection queries
          if (soql.includes('InstalledSubscriberPackage') || soql.includes('ApexClass')) {
            throw new Error('Package query failed');
          }
          
          // Succeed for unmanaged field check
          if (soql.includes('External_ID_Data_Creation__c')) {
            return { success: true, data: [{}] };
          }
          
          return { success: false, data: [] };
        }
      };
      
      const result = await ExternalIdUtils.detectEnvironmentExternalIdInfo(
        'tc9_et__Interpretation_Rule__c',
        mockOrg
      );

      expect(result.packageType).toBe('unmanaged');
      expect(result.externalIdField).toBe('External_ID_Data_Creation__c');
    });
  });

  describe('Query Building', () => {
    it('should build cross-environment queries correctly', () => {
      const baseQuery = 'SELECT Id, Name, {externalIdField}, tc9_et__Pay_Code__r.{externalIdField} FROM tc9_et__Interpretation_Rule__c';
      
      const managedQuery = ExternalIdUtils.buildCrossEnvironmentQuery(
        baseQuery,
        'tc9_edc__External_ID_Data_Creation__c'
      );
      
      expect(managedQuery).toBe(
        'SELECT Id, Name, tc9_edc__External_ID_Data_Creation__c, tc9_et__Pay_Code__r.tc9_edc__External_ID_Data_Creation__c FROM tc9_et__Interpretation_Rule__c'
      );

      const unmanagedQuery = ExternalIdUtils.buildCrossEnvironmentQuery(
        baseQuery,
        'External_ID_Data_Creation__c'
      );
      
      expect(unmanagedQuery).toBe(
        'SELECT Id, Name, External_ID_Data_Creation__c, tc9_et__Pay_Code__r.External_ID_Data_Creation__c FROM tc9_et__Interpretation_Rule__c'
      );
    });
  });

  describe('Validation', () => {
    it('should validate cross-environment compatibility correctly', () => {
      const sourceInfo = {
        packageType: 'unmanaged' as const,
        externalIdField: 'External_ID_Data_Creation__c',
        detectedFields: ['External_ID_Data_Creation__c'],
        fallbackUsed: false,
      };

      const targetInfo = {
        packageType: 'managed' as const,
        externalIdField: 'tc9_edc__External_ID_Data_Creation__c',
        detectedFields: ['tc9_edc__External_ID_Data_Creation__c'],
        fallbackUsed: false,
      };

      const validation = ExternalIdUtils.validateCrossEnvironmentCompatibility(sourceInfo, targetInfo);

      expect(validation.crossEnvironmentDetected).toBe(true);
      expect(validation.sourceEnvironment).toEqual(sourceInfo);
      expect(validation.targetEnvironment).toEqual(targetInfo);
      expect(validation.recommendations.length).toBeGreaterThan(0);
      expect(validation.potentialIssues.some(issue => issue.severity === 'info')).toBe(true);
    });

    it('should detect when fallback fields are used', () => {
      const sourceInfo = {
        packageType: 'unmanaged' as const,
        externalIdField: 'External_Id__c',
        detectedFields: ['External_Id__c'],
        fallbackUsed: true,
      };

      const targetInfo = {
        packageType: 'managed' as const,
        externalIdField: 'tc9_edc__External_ID_Data_Creation__c',
        detectedFields: ['tc9_edc__External_ID_Data_Creation__c'],
        fallbackUsed: false,
      };

      const validation = ExternalIdUtils.validateCrossEnvironmentCompatibility(sourceInfo, targetInfo);

      expect(validation.potentialIssues.some(issue => 
        issue.severity === 'warning' && issue.message.includes('fallback external ID field')
      )).toBe(true);
    });
  });

  describe('Legacy Compatibility', () => {
    it('should maintain backward compatibility with detectExternalIdField method', async () => {
      const managedOrg = new MockOrgConnection(true);
      
      const detectedField = await ExternalIdUtils.detectExternalIdField(
        'tc9_et__Interpretation_Rule__c',
        managedOrg
      );

      expect(detectedField).toBe('tc9_edc__External_ID_Data_Creation__c');
    });

    it('should maintain backward compatibility with isManagedPackageOrg method', async () => {
      const managedOrg = new MockOrgConnection(true);
      const unmanagedOrg = new MockOrgConnection(false, { 'External_ID_Data_Creation__c': true });

      const isManagedTrue = await ExternalIdUtils.isManagedPackageOrg(
        'tc9_et__Interpretation_Rule__c',
        managedOrg
      );

      const isManagedFalse = await ExternalIdUtils.isManagedPackageOrg(
        'tc9_et__Interpretation_Rule__c',
        unmanagedOrg
      );

      expect(isManagedTrue).toBe(true);
      expect(isManagedFalse).toBe(false);
    });
  });

  describe('Tooling API Query Testing', () => {
    describe('isManagedPackageInstalled ApexClass query', () => {
      it('should construct correct ApexClass query for package detection', async () => {
        let capturedQuery = '';
        const mockOrg = {
          query: async (query: string) => {
            capturedQuery = query;
            return {
              success: true,
              data: [{ Id: '01pxx0000000001', NamespacePrefix: 'tc9_edc' }]
            };
          }
        };

        await ExternalIdUtils.isManagedPackageInstalled(mockOrg);

        // Verify the ApexClass query format
        expect(capturedQuery).toBe(
          `SELECT Id, NamespacePrefix FROM ApexClass WHERE NamespacePrefix = 'tc9_edc' LIMIT 1`
        );
      });

      it('should handle successful package detection response', async () => {
        const mockOrg = {
          query: async (query: string) => {
            if (query.includes('ApexClass') && query.includes('NamespacePrefix')) {
              return {
                success: true,
                data: [
                  { Id: '01pxx0000000001', NamespacePrefix: 'tc9_edc' },
                  { Id: '01pxx0000000002', NamespacePrefix: 'tc9_edc' }
                ]
              };
            }
            return { success: false, data: [] };
          }
        };

        const result = await ExternalIdUtils.isManagedPackageInstalled(mockOrg);
        expect(result).toBe(true);
      });

      it('should handle no package found response', async () => {
        const mockOrg = {
          query: async (query: string) => {
            if (query.includes('ApexClass') && query.includes('NamespacePrefix')) {
              return {
                success: true,
                data: [] // No packages found
              };
            }
            return { success: false, data: [] };
          }
        };

        const result = await ExternalIdUtils.isManagedPackageInstalled(mockOrg);
        expect(result).toBe(false);
      });

      it('should handle malformed or unsuccessful query response', async () => {
        const mockOrg = {
          query: async (query: string) => {
            if (query.includes('ApexClass') && query.includes('NamespacePrefix')) {
              return {
                success: false,
                data: null
              };
            }
            return { success: false, data: [] };
          }
        };

        const result = await ExternalIdUtils.isManagedPackageInstalled(mockOrg);
        expect(result).toBe(false);
      });

      it('should properly escape namespace in WHERE clause', async () => {
        let capturedQuery = '';
        const mockOrg = {
          query: async (query: string) => {
            capturedQuery = query;
            return { success: true, data: [] };
          }
        };

        await ExternalIdUtils.isManagedPackageInstalled(mockOrg);

        // Verify proper SQL string escaping with single quotes
        expect(capturedQuery).toContain("NamespacePrefix = 'tc9_edc'");
        expect(capturedQuery).not.toContain('NamespacePrefix = "tc9_edc"');
      });

      it('should handle query failures gracefully', async () => {
        const mockOrg = {
          query: async (query: string) => {
            throw new Error('Network timeout');
          }
        };

        const result = await ExternalIdUtils.isManagedPackageInstalled(mockOrg);
        expect(result).toBe(false);
      });

      it('should validate query response structure correctly', async () => {
        const testCases = [
          // Valid response with package
          {
            response: { success: true, data: [{ Id: '123', NamespacePrefix: 'tc9_edc' }] },
            expected: true
          },
          // Valid response without package
          {
            response: { success: true, data: [] },
            expected: false
          },
          // Real Salesforce API response format with package
          {
            response: {
              totalSize: 1,
              done: true,
              records: [
                {
                  attributes: {
                    type: "ApexClass",
                    url: "/services/data/v63.0/sobjects/ApexClass/01pxx0000000001"
                  },
                  Id: "01pxx0000000001",
                  NamespacePrefix: "tc9_edc"
                }
              ]
            },
            expected: true
          },
          // Real Salesforce API response format without package
          {
            response: {
              totalSize: 0,
              done: true,
              records: []
            },
            expected: false
          },
          // Missing data/records property
          {
            response: { success: true },
            expected: false
          },
          // Null data
          {
            response: { success: true, data: null },
            expected: false
          },
          // Null records
          {
            response: { records: null },
            expected: false
          },
          // Unsuccessful response
          {
            response: { success: false, data: [{ Id: '123' }] },
            expected: false
          }
        ];

        for (const testCase of testCases) {
          const mockOrg = {
            query: async () => testCase.response
          };

          const result = await ExternalIdUtils.isManagedPackageInstalled(mockOrg);
          expect(result).toBe(testCase.expected);
        }
      });
    });
  });
}); 
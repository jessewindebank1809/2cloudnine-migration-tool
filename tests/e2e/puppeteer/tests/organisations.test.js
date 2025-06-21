const AuthPage = require('../pages/auth-page');
const OrgsPage = require('../pages/orgs-page');
const TestConfig = require('../utils/test-config');
const TestData = require('../utils/test-data');

describe('Organisation Management Tests', () => {
  let authPage;
  let orgsPage;

  beforeAll(() => {
    TestConfig.validate();
  });

  beforeEach(async () => {
    authPage = new AuthPage(page);
    orgsPage = new OrgsPage(page);

    await authPage.navigate('/');
    await authPage.clickSignInWithSalesforce();
    await authPage.completeSalesforceOAuth(
      TestData.users.admin.username,
      TestData.users.admin.password
    );
  });

  afterEach(async () => {
    await authPage.logout();
  });

  describe('ORG_001: Multi-Organisation Connection', () => {
    test('should connect source Salesforce organisation', async () => {
      await orgsPage.navigateToOrgs();
      
      const initialOrgs = await orgsPage.getConnectedOrgs();
      
      await orgsPage.connectNewOrg();
      await orgsPage.clickConnectSalesforce();
      
      await authPage.completeSalesforceOAuth(
        TestData.users.admin.username,
        TestData.users.admin.password
      );

      const hasSuccessMessage = await orgsPage.hasSuccessMessage();
      expect(hasSuccessMessage).toBe(true);

      const finalOrgs = await orgsPage.getConnectedOrgs();
      expect(finalOrgs.length).toBeGreaterThan(initialOrgs.length);

      const isConnected = await orgsPage.verifyOrgConnection('Test Source Org');
      expect(isConnected).toBe(true);

      await orgsPage.takeScreenshot('org-connected');
    });

    test('should connect target Salesforce organisation', async () => {
      await orgsPage.navigateToOrgs();
      
      await orgsPage.connectNewOrg();
      await orgsPage.clickConnectSalesforce();
      
      await authPage.completeSalesforceOAuth(
        TestData.users.target.username,
        TestData.users.target.password
      );

      const isConnected = await orgsPage.verifyOrgConnection('Test Target Org');
      expect(isConnected).toBe(true);

      const orgs = await orgsPage.getConnectedOrgs();
      expect(orgs.length).toBeGreaterThan(0);
      
      const targetOrg = orgs.find(org => org.name === 'Test Target Org');
      expect(targetOrg).toBeTruthy();
      expect(targetOrg.status).toBe('Connected');
    });

    test('should display both organisations in connected list', async () => {
      await orgsPage.navigateToOrgs();
      
      await orgsPage.connectNewOrg();
      await orgsPage.clickConnectSalesforce();
      await authPage.completeSalesforceOAuth(
        TestData.users.admin.username,
        TestData.users.admin.password
      );

      await orgsPage.connectNewOrg();
      await orgsPage.clickConnectSalesforce();
      await authPage.completeSalesforceOAuth(
        TestData.users.target.username,
        TestData.users.target.password
      );

      const orgs = await orgsPage.getConnectedOrgs();
      expect(orgs.length).toBeGreaterThanOrEqual(2);

      const orgNames = orgs.map(org => org.name);
      expect(orgNames).toContain('Test Source Org');
      expect(orgNames).toContain('Test Target Org');

      const allConnected = orgs.every(org => org.status === 'Connected');
      expect(allConnected).toBe(true);
    });

    test('should prevent duplicate organisation connections', async () => {
      await orgsPage.navigateToOrgs();
      
      await orgsPage.connectNewOrg();
      await orgsPage.clickConnectSalesforce();
      await authPage.completeSalesforceOAuth(
        TestData.users.admin.username,
        TestData.users.admin.password
      );

      const orgsAfterFirst = await orgsPage.getConnectedOrgs();

      await orgsPage.connectNewOrg();
      await orgsPage.clickConnectSalesforce();
      await authPage.completeSalesforceOAuth(
        TestData.users.admin.username,
        TestData.users.admin.password
      );

      const orgsAfterSecond = await orgsPage.getConnectedOrgs();
      expect(orgsAfterSecond.length).toBe(orgsAfterFirst.length);
    });
  });

  describe('ORG_002: Organisation Schema Discovery', () => {
    beforeEach(async () => {
      await orgsPage.navigateToOrgs();
      await orgsPage.connectNewOrg();
      await orgsPage.clickConnectSalesforce();
      await authPage.completeSalesforceOAuth(
        TestData.users.admin.username,
        TestData.users.admin.password
      );
    });

    test('should discover and display Salesforce schema', async () => {
      const orgSelected = await orgsPage.selectOrg('Test Source Org');
      expect(orgSelected).toBe(true);

      await orgsPage.discoverSchema();
      
      const discoveryComplete = await orgsPage.waitForSchemaDiscovery();
      expect(discoveryComplete).toBe(true);

      const discoveredObjects = await orgsPage.getDiscoveredObjects();
      expect(discoveredObjects.length).toBeGreaterThan(0);

      const hasStandardObjects = discoveredObjects.some(obj => 
        ['Account', 'Contact', 'Opportunity'].includes(obj.name)
      );
      expect(hasStandardObjects).toBe(true);

      await orgsPage.takeScreenshot('schema-discovery');
    });

    test('should detect custom objects and fields', async () => {
      await orgsPage.selectOrg('Test Source Org');
      await orgsPage.discoverSchema();
      await orgsPage.waitForSchemaDiscovery();

      const discoveredObjects = await orgsPage.getDiscoveredObjects();
      
      const customObjects = discoveredObjects.filter(obj => 
        obj.name.endsWith('__c') || obj.type === 'Custom'
      );
      expect(customObjects.length).toBeGreaterThan(0);

      if (customObjects.length > 0) {
        const firstCustomObject = customObjects[0];
        const fields = await orgsPage.getObjectFields(firstCustomObject.name);
        
        expect(fields.length).toBeGreaterThan(0);
        
        const hasRequiredFields = fields.some(field => 
          field.required === 'true' || field.required === true
        );
        expect(hasRequiredFields).toBeTruthy();
      }
    });

    test('should identify relationships between objects', async () => {
      await orgsPage.selectOrg('Test Source Org');
      await orgsPage.discoverSchema();
      await orgsPage.waitForSchemaDiscovery();

      const discoveredObjects = await orgsPage.getDiscoveredObjects();
      
      const contactObject = discoveredObjects.find(obj => obj.name === 'Contact');
      if (contactObject) {
        const contactFields = await orgsPage.getObjectFields('Contact');
        
        const relationshipFields = contactFields.filter(field => 
          field.type === 'reference' || field.name.endsWith('Id')
        );
        expect(relationshipFields.length).toBeGreaterThan(0);
      }
    });

    test('should handle schema discovery errors gracefully', async () => {
      await orgsPage.selectOrg('Test Source Org');
      
      await page.setOfflineMode(true);
      await orgsPage.discoverSchema();
      
      const hasError = await orgsPage.hasErrorMessage();
      expect(hasError).toBe(true);
      
      await page.setOfflineMode(false);
      
      await orgsPage.discoverSchema();
      const discoveryComplete = await orgsPage.waitForSchemaDiscovery();
      expect(discoveryComplete).toBe(true);
    });

    test('should validate data types and constraints', async () => {
      await orgsPage.selectOrg('Test Source Org');
      await orgsPage.discoverSchema();
      await orgsPage.waitForSchemaDiscovery();

      const accountFields = await orgsPage.getObjectFields('Account');
      expect(accountFields.length).toBeGreaterThan(0);

      const expectedFieldTypes = ['text', 'picklist', 'reference', 'datetime', 'number'];
      const detectedTypes = accountFields.map(field => field.type);
      
      const hasExpectedTypes = expectedFieldTypes.some(type => 
        detectedTypes.includes(type)
      );
      expect(hasExpectedTypes).toBe(true);
    });
  });
});
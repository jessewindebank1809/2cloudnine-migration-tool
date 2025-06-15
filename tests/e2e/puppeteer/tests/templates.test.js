const AuthPage = require('../pages/auth-page');
const TemplatesPage = require('../pages/templates-page');
const MigrationsPage = require('../pages/migrations-page');
const TestConfig = require('../utils/test-config');
const TestData = require('../utils/test-data');

describe('Template Management Tests', () => {
  let authPage;
  let templatesPage;
  let migrationsPage;

  beforeAll(() => {
    TestConfig.validate();
  });

  beforeEach(async () => {
    authPage = new AuthPage(page);
    templatesPage = new TemplatesPage(page);
    migrationsPage = new MigrationsPage(page);

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

  describe('TEMP_001: Template Selection and Configuration', () => {
    test('should display available migration templates', async () => {
      await templatesPage.navigateToTemplates();
      
      const templates = await templatesPage.getAvailableTemplates();
      expect(templates.length).toBeGreaterThan(0);
      
      const hasPayrollTemplate = templates.some(t => 
        t.name.includes('Payroll') || t.category === 'Payroll'
      );
      expect(hasPayrollTemplate).toBe(true);

      await templatesPage.takeScreenshot('templates-list');
    });

    test('should browse templates by category', async () => {
      await templatesPage.navigateToTemplates();
      
      await templatesPage.filterByCategory('Payroll');
      
      const payrollTemplates = await templatesPage.getTemplatesByCategory('Payroll');
      expect(payrollTemplates.length).toBeGreaterThan(0);
      
      payrollTemplates.forEach(template => {
        expect(template.category).toBe('Payroll');
      });
    });

    test('should search templates by name', async () => {
      await templatesPage.navigateToTemplates();
      
      await templatesPage.searchTemplates('Product');
      
      const templates = await templatesPage.getAvailableTemplates();
      const productTemplates = templates.filter(t => 
        t.name.includes('Product') || t.description.includes('Product')
      );
      
      expect(productTemplates.length).toBeGreaterThan(0);
    });

    test('should select and configure template', async () => {
      await templatesPage.navigateToTemplates();
      
      const templateSelected = await templatesPage.selectTemplate('Payroll Migration Template');
      expect(templateSelected).toBe(true);
      
      const config = {
        'source-org': 'Test Source Org',
        'target-org': 'Test Target Org',
        'batch-size': '200',
        'include-inactive': 'true'
      };
      
      await templatesPage.configureTemplate(config);
      await templatesPage.saveTemplateConfiguration();
      
      const savedConfig = await templatesPage.getTemplateConfiguration();
      expect(savedConfig.length).toBeGreaterThan(0);

      await templatesPage.takeScreenshot('template-configured');
    });

    test('should display template preview', async () => {
      await templatesPage.navigateToTemplates();
      
      await templatesPage.selectTemplate('Payroll Migration Template');
      
      const preview = await templatesPage.getTemplatePreview();
      expect(preview).toBeTruthy();
      expect(preview.objects).toBeDefined();
      expect(preview.objects.length).toBeGreaterThan(0);
      
      const hasExpectedObjects = preview.objects.some(obj => 
        ['Employee__c', 'PayRate__c', 'Deduction__c'].includes(obj)
      );
      expect(hasExpectedObjects).toBe(true);
    });

    test('should validate template configuration options', async () => {
      await templatesPage.navigateToTemplates();
      
      await templatesPage.selectTemplate('Product Migration Template');
      
      const config = await templatesPage.getTemplateConfiguration();
      expect(config.length).toBeGreaterThan(0);
      
      const requiredParams = config.filter(param => param.type === 'required');
      expect(requiredParams.length).toBeGreaterThan(0);
      
      const invalidConfig = {
        'batch-size': 'invalid-number',
        'source-org': ''
      };
      
      await templatesPage.configureTemplate(invalidConfig);
      await templatesPage.saveTemplateConfiguration();
      
      const currentUrl = await templatesPage.getCurrentUrl();
      expect(currentUrl).toContain('/templates');
    });

    test('should apply template to migration project', async () => {
      await templatesPage.navigateToTemplates();
      
      await templatesPage.selectTemplate('Payroll Migration Template');
      
      const config = {
        'source-org': 'Test Source Org',
        'target-org': 'Test Target Org',
        'batch-size': '100'
      };
      
      await templatesPage.configureTemplate(config);
      await templatesPage.saveTemplateConfiguration();
      await templatesPage.applyTemplateToMigration();
      
      const currentUrl = await templatesPage.getCurrentUrl();
      expect(currentUrl).toContain('/migrations');
      
      const projects = await migrationsPage.getMigrationProjects();
      const templateProject = projects.find(p => 
        p.name.includes('Payroll') || p.name.includes('Template')
      );
      expect(templateProject).toBeTruthy();
    });

    test('should show template field mappings', async () => {
      await templatesPage.navigateToTemplates();
      
      await templatesPage.selectTemplate('Product Migration Template');
      
      const preview = await templatesPage.getTemplatePreview();
      expect(preview.mappings).toBeDefined();
      expect(preview.mappings.length).toBeGreaterThan(0);
      
      preview.mappings.forEach(mapping => {
        expect(mapping.source).toBeTruthy();
        expect(mapping.target).toBeTruthy();
      });
    });

    test('should display transformation rules', async () => {
      await templatesPage.navigateToTemplates();
      
      await templatesPage.selectTemplate('Payroll Migration Template');
      
      const preview = await templatesPage.getTemplatePreview();
      expect(preview.rules).toBeDefined();
      
      if (preview.rules.length > 0) {
        preview.rules.forEach(rule => {
          expect(rule).toBeTruthy();
          expect(typeof rule).toBe('string');
        });
      }
    });

    test('should verify template exists and is accessible', async () => {
      await templatesPage.navigateToTemplates();
      
      const payrollExists = await templatesPage.verifyTemplateExists('Payroll Migration Template');
      expect(payrollExists).toBe(true);
      
      const productExists = await templatesPage.verifyTemplateExists('Product Migration Template');
      expect(productExists).toBe(true);
      
      const nonExistentExists = await templatesPage.verifyTemplateExists('Non-Existent Template');
      expect(nonExistentExists).toBe(false);
    });
  });
});
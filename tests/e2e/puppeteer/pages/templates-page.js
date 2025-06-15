const BasePage = require('./base-page');

class TemplatesPage extends BasePage {
  constructor(page) {
    super(page);
    this.selectors = {
      templateList: '[data-testid="template-list"]',
      templateItem: '[data-testid="template-item"]',
      templateName: '[data-testid="template-name"]',
      templateCategory: '[data-testid="template-category"]',
      templateDescription: '[data-testid="template-description"]',
      selectTemplateButton: '[data-testid="select-template-button"]',
      configSection: '[data-testid="config-section"]',
      configOption: '[data-testid="config-option"]',
      parameterInput: '[data-testid="parameter-input"]',
      saveConfigButton: '[data-testid="save-config-button"]',
      applyTemplateButton: '[data-testid="apply-template-button"]',
      templatePreview: '[data-testid="template-preview"]',
      categoryFilter: '[data-testid="category-filter"]',
      searchInput: '[data-testid="template-search"]'
    };
  }

  async navigateToTemplates() {
    await this.navigate('/templates');
  }

  async getAvailableTemplates() {
    if (await this.isVisible(this.selectors.templateList)) {
      return this.page.$$eval(
        this.selectors.templateItem,
        items => items.map(item => ({
          name: item.querySelector('[data-testid="template-name"]')?.textContent?.trim(),
          category: item.querySelector('[data-testid="template-category"]')?.textContent?.trim(),
          description: item.querySelector('[data-testid="template-description"]')?.textContent?.trim()
        }))
      );
    }
    return [];
  }

  async selectTemplate(templateName) {
    const templates = await this.page.$$(this.selectors.templateItem);
    
    for (const template of templates) {
      const nameElement = await template.$('[data-testid="template-name"]');
      if (nameElement) {
        const name = await nameElement.evaluate(el => el.textContent.trim());
        if (name === templateName) {
          const selectButton = await template.$('[data-testid="select-template-button"]');
          if (selectButton) {
            await selectButton.click();
            await this.waitForSelector(this.selectors.configSection);
            return true;
          }
        }
      }
    }
    return false;
  }

  async configureTemplate(config) {
    for (const [parameter, value] of Object.entries(config)) {
      const inputSelector = `${this.selectors.parameterInput}[data-parameter="${parameter}"]`;
      if (await this.isVisible(inputSelector)) {
        await this.type(inputSelector, value);
      }
    }
  }

  async getTemplateConfiguration() {
    if (await this.isVisible(this.selectors.configSection)) {
      return this.page.$$eval(
        this.selectors.configOption,
        options => options.map(option => ({
          parameter: option.getAttribute('data-parameter'),
          value: option.querySelector('input')?.value || option.textContent.trim(),
          type: option.getAttribute('data-type')
        }))
      );
    }
    return [];
  }

  async saveTemplateConfiguration() {
    await this.click(this.selectors.saveConfigButton);
    await this.waitForSelector(this.selectors.applyTemplateButton);
  }

  async applyTemplateToMigration() {
    await this.click(this.selectors.applyTemplateButton);
    await this.waitForNavigation();
  }

  async getTemplatePreview() {
    if (await this.isVisible(this.selectors.templatePreview)) {
      return this.page.$eval(
        this.selectors.templatePreview,
        preview => ({
          objects: Array.from(preview.querySelectorAll('[data-testid="preview-object"]'))
            .map(obj => obj.textContent.trim()),
          mappings: Array.from(preview.querySelectorAll('[data-testid="preview-mapping"]'))
            .map(mapping => ({
              source: mapping.getAttribute('data-source'),
              target: mapping.getAttribute('data-target')
            })),
          rules: Array.from(preview.querySelectorAll('[data-testid="preview-rule"]'))
            .map(rule => rule.textContent.trim())
        })
      );
    }
    return null;
  }

  async filterByCategory(category) {
    await this.click(this.selectors.categoryFilter);
    await this.click(`[data-category="${category}"]`);
    await this.waitForSelector(this.selectors.templateList);
  }

  async searchTemplates(searchTerm) {
    await this.type(this.selectors.searchInput, searchTerm);
    await this.page.keyboard.press('Enter');
    await this.waitForSelector(this.selectors.templateList);
  }

  async verifyTemplateExists(templateName) {
    const templates = await this.getAvailableTemplates();
    return templates.some(template => template.name === templateName);
  }

  async getTemplatesByCategory(category) {
    const templates = await this.getAvailableTemplates();
    return templates.filter(template => template.category === category);
  }
}

module.exports = TemplatesPage;
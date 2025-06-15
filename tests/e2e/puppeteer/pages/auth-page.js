const BasePage = require('./base-page');
const TestHelpers = require('../utils/test-helpers');

class AuthPage extends BasePage {
  constructor(page) {
    super(page);
    this.selectors = {
      signInButton: '[data-testid="salesforce-signin-button"]',
      signInWithSalesforce: 'button:has-text("Continue with Salesforce")',
      logoutButton: '[data-testid="logout-button"]',
      userProfile: '[data-testid="user-profile"]',
      salesforceUsernameInput: '#username',
      salesforcePasswordInput: '#password',
      salesforceLoginButton: '#Login',
      allowButton: '#oaapprove'
    };
  }

  async navigateToSignIn() {
    await this.navigate('/auth/signin');
  }

  async clickSignInWithSalesforce() {
    await this.waitForSelector(this.selectors.signInWithSalesforce);
    await this.click(this.selectors.signInWithSalesforce);
  }

  async completeSalesforceOAuth(username, password) {
    const pages = await browser.pages();
    const oauthPage = pages.find(p => p.url().includes('salesforce.com'));
    
    if (oauthPage) {
      await oauthPage.bringToFront();
      
      await oauthPage.waitForSelector(this.selectors.salesforceUsernameInput);
      await oauthPage.type(this.selectors.salesforceUsernameInput, username);
      await oauthPage.type(this.selectors.salesforcePasswordInput, password);
      
      await Promise.all([
        oauthPage.waitForNavigation({ waitUntil: 'networkidle0' }),
        oauthPage.click(this.selectors.salesforceLoginButton)
      ]);

      const allowButtonExists = await oauthPage.isVisible(this.selectors.allowButton);
      if (allowButtonExists) {
        await Promise.all([
          oauthPage.waitForNavigation({ waitUntil: 'networkidle0' }),
          oauthPage.click(this.selectors.allowButton)
        ]);
      }

      await this.page.bringToFront();
      await this.page.waitForNavigation({ waitUntil: 'networkidle0' });
    }
  }

  async isUserLoggedIn() {
    return this.isVisible(this.selectors.userProfile);
  }

  async logout() {
    if (await this.isVisible(this.selectors.logoutButton)) {
      await this.click(this.selectors.logoutButton);
      await this.waitForNavigation();
    }
  }

  async verifySignInPage() {
    const url = await this.getCurrentUrl();
    return url.includes('/auth/signin');
  }

  async verifyHomePage() {
    const url = await this.getCurrentUrl();
    return url.includes('/home') || url === `${this.url}/`;
  }

  async getUserProfileText() {
    if (await this.isVisible(this.selectors.userProfile)) {
      return this.getText(this.selectors.userProfile);
    }
    return null;
  }
}

module.exports = AuthPage;
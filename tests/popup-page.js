/**
 * PopupPage is a test fixture that provides a page object for the extension's popup.
 * By simply declaring a {popup} argument to the test function, you get a page object that you can use to interact with.
 */
export class PopupPage {
  /**
   * PopupPage constructor.
   * @param {*} context - The Playwright BrowserContext.
   * @param {*} page - The Playwright Page.
   * @param {string} extensionId - The extension ID.
   */
  constructor(context, page, extensionId) {
    this.context = context;
    this.page = page;
    this.extensionId = extensionId;
    this.addButton = this.page.getByRole('button', { name: /Add/ });
    this.settingsButton = this.page.locator('#settings-button');
  }

  /**
   * Navigates to the extension's popup.
   */
  async openPopup() {
    await this.page.goto(`chrome-extension://${this.extensionId}/popup.html`);
  }

  /**
   * Creates a profile with either an IDP or a WebID.
   * @param {string} profileName - The profile name.
   * @param {string} idp - The IDP.
   * @param {string} webId - The WebID.
   */
  async createProfile(profileName, idp, webId) {
    await this.addButton.click();

    await this.page.locator('input[name="displayname"]').fill(profileName);
    if (idp) {
      await this.page.locator('input[name="idp"]').fill(idp);
    }
    else if (webId) {
      await this.page.locator('input[name="webid"]').fill(webId);
    }

    await this.page.getByRole('button', { name: 'Create' }).click();
  }

  /**
   * Opens the settings page by clicking on the settings icon button on the popup page.
   * @returns {Promise<*>} Returns a promise of the settings page.
   */
  async openSettings() {
    const pagePromise = this.context.waitForEvent('page');

    await this.settingsButton.click();

    const popup = await pagePromise;
    await popup.waitForLoadState();
    return popup;
  }

  /**
   * Opens the create profile dialog by clicking on the add button on the popup page.
   */
  async openNewProfile() {
    await this.addButton.click();
  }

  /**
   * Returns the identies list.
   * @returns {Promise<*>} Returns a promise of the identities list.
   */
  getIdentities() {
    return this.page.locator('#identity-list');
  }

  /**
   * Returns the identity-short element.
   * @returns {Promise<*>} Returns a promise of the identity-short element.
   */
  getIdentityShort() {
    return this.page.locator('#identity-short');
  }

  /**
   * Selects a profile with the given display name.
   * @param {string} name - The profile name.
   */
  async selectProfile(name) {
    await this.page.locator('#identity-list').getByRole('button', {
      name,
    }).click();
  }

  /**
   * Opens the edit profile dialog for the given profile name.
   * @param {string} name - The profile name.
   */
  async openEditProfileDialog(name) {
    const rowLocator = this.page.getByRole('listitem');
    const listItem = rowLocator.filter({hasText: name});
    const settingButton = listItem.locator('.edit-button');
    await settingButton.click();
  }

}

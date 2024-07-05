import {test, expect} from './fixtures';

const WEBID_ENDPOINT = 'https://example.com/PROFILEA/profile/card#me';

const WEBID_RESPONSE = `"@prefix foaf: <http://xmlns.com/foaf/0.1/>.\n" +
  "@prefix solid: <http://www.w3.org/ns/solid/terms#>.\n" +
  "\n" +
  "<>\n" +
  "    a foaf:PersonalProfileDocument;\n" +
  "    foaf:maker <${WEBID_ENDPOINT}>;\n" +
  "    foaf:primaryTopic <${WEBID_ENDPOINT}>.\n" +
  "\n" +
  "<${WEBID_ENDPOINT}>\n" +
  "    \n" +
  "    solid:oidcIssuer <https://example.com/>;\n" +
  "    a foaf:Person.\n"
`;

test('popup page has title', async ({page, popupPage}) => {
  await popupPage.openPopup();
  await expect(page).toHaveTitle(/Solid Identity Selector/);
});

test('popup page without profiles', async ({page, popupPage}) => {
  await popupPage.openPopup();
  await expect(page.locator('p').first()).toHaveText('You have not selected a profile yet.');
  const identities = page.locator('section#identities');

  await expect(identities.getByRole('list')).toBeEmpty();

  await expect(page.getByRole('button', {name: 'Add'})).toBeVisible();
});

test('add button opens add-new-profile dialog', async ({ page, popupPage}) => {
  await popupPage.openPopup();

  await popupPage.openNewProfile();

  await popupPage.page.waitForLoadState('domcontentloaded');

  await expect(page.getByRole('heading', {
    name: /Add new profile/,
  }),).toBeVisible();
});

test('add new profile page has all necessary input fields', async ({ page, popupPage}) => {
  await popupPage.openNewProfile();

  const displayName = page.locator('#displayname');
  await expect(displayName).toBeVisible();
  await expect(displayName).toBeEditable();
  await expect(displayName).toBeEmpty();
  const displayNamePlaceholder = await displayName.getAttribute('placeholder');
  expect(displayNamePlaceholder).toEqual('The name in the list');

  const idp = page.getByRole('textbox', {name: 'identity provider'});
  await expect(idp).toBeVisible();
  await expect(idp).toBeEditable();
  await expect(idp).toBeEmpty();
  const idpPlaceholder = await idp.getAttribute('placeholder');
  expect(idpPlaceholder).toEqual('Your identity provider');

  const webid = page.getByRole('textbox', {name: 'webid'});
  await expect(webid).toBeVisible();
  await expect(webid).toBeEditable();
  await expect(webid).toBeEmpty();
  const webidPlaceholder = await webid.getAttribute('placeholder');
  expect(webidPlaceholder).toEqual('Your WebID');
});

test('when create a profile, IDP and WebID fields are mutually exclusive', async ({ page, popupPage}) => {
  await popupPage.openNewProfile();

  const idp = page.getByRole('textbox', {name: 'identity provider'});
  await expect(idp).toBeEditable();

  const webid = page.getByRole('textbox', {name: 'webid'});
  await expect(webid).toBeEditable();

  await idp.fill('IDP');
  await expect(webid).toBeDisabled();

  await idp.clear();
  await expect(webid).toBeEditable();

  await webid.fill('WebID');
  await expect(idp).toBeDisabled();

  await webid.clear();
  await expect(idp).toBeEditable();
});

test('create profile validates empty fields', async ({ page, popupPage }) => {
  await popupPage.openNewProfile();

  const displayName = page.locator('input[name="displayname"]');
  await expect(displayName).toBeEmpty();
  const webid = page.locator('input[name="webid"]');
  await expect(webid).toBeEmpty();
  const idp = page.locator('input[name="idp"]');
  await expect(idp).toBeEmpty();

  await page.getByRole('button', {name: 'Create'}).click();

  await expect(displayName).toHaveClass('error');
  await expect(page.getByText('You must provide a display name')).toBeVisible();
  await expect(webid).toHaveClass('error');
  await expect(page.locator('input[name=webid] + .error-explanation')).toHaveText('Please provide either an Identity Provider or WebID.',);
  await expect(idp).toHaveClass('error');
  await expect(page.locator('input[name=idp] + .error-explanation')).toHaveText('Please provide either an Identity Provider or WebID.',);
});

test('creating a profile adds it to list of profiles', async ({ page, popupPage}) => {
  await popupPage.createProfile('A Profile', 'WebId A');

  // await page.waitForTimeout(1000);
  const identities = page.locator('section#identities');
  await expect(identities).toBeVisible();

  await expect(identities.getByRole('list')).not.toBeEmpty();
  await expect(identities.locator('.identity-row')).toHaveText('A' + 'A Profile',);
});

test('creating 2 profiles adds both to list of profiles', async ({page, popupPage}) => {
  await popupPage.createProfile('A Profile', 'WebId A');
  await popupPage.createProfile('B Profile', 'WebId B');

  const identities = page.locator('section#identities');
  await expect(identities).toBeVisible();

  await expect(identities.locator('.identity-row')).toHaveCount(2);
  await expect(identities.locator('.identity-row').first()).toHaveText('A' + 'A Profile',);
  await expect(identities.locator('.identity-row').last()).toHaveText('B' + 'B Profile',);
});

test('profile header shows name and avatar of active profile', async ({page, popupPage}) => {
  await popupPage.createProfile('A Profile', 'WebId A');
  await expect(page.locator('#identity-short')).toHaveText('A Profile');

  await page.reload();

  await popupPage.createProfile('B Profile', 'WebId B');
  await expect(page.locator('#identity-short')).toHaveText('B Profile');
});

test('switching profile activates correct one', async ({page, popupPage}) => {
  await expect(page.locator('#no-identities-prompt')).toBeVisible();

  await popupPage.createProfile('A Profile', 'WebId A');
  await popupPage.createProfile('B Profile', 'WebId B');

  const identities = popupPage.getIdentities();
  await expect(identities).toBeVisible();

  await expect(identities.locator('.identity-row')).toHaveCount(2);

  await popupPage.selectProfile('A Profile');

  await expect(identities.locator('.identity-row')).toHaveCount(2);

  await expect(popupPage.getIdentityShort()).toHaveText('A Profile');
  await expect(page.getByRole('heading', {name: 'A Profile'}),).toBeVisible();

  await identities.getByRole('button', {
    name: 'B Profile',
  }).click();

  await expect(popupPage.getIdentityShort()).toHaveText('B Profile');
  await expect(page.getByRole('heading', {name: 'B Profile'}),).toBeVisible();

});

test('Clicking the settings button next to a profile opens the edit profile dialog.', async ({ popupPage}) => {
  await popupPage.createProfile('A Profile', 'IDP A');

  await popupPage.openEditProfileDialog('A Profile');

  await expect(popupPage.page.getByRole('heading', {name: /Edit Profile/})).toBeVisible();
  await expect(popupPage.page.getByPlaceholder('The name in the list')).toHaveValue('A Profile');
  await expect(popupPage.page.getByPlaceholder('Your identity provider')).toHaveValue('IDP A');
  await expect(popupPage.page.getByPlaceholder('Your WebID')).toHaveValue('');
});

test('Clicking delete profile button shows confirmation dialog.', async ({ popupPage}) => {
  await popupPage.createProfile('A Profile', 'IDP A');

  await popupPage.openEditProfileDialog('A Profile');

  const confirmDialog = popupPage.page.locator('#confirm-dialog');
  await expect(confirmDialog).toBeHidden();

  await popupPage.page.getByRole('button', {
    name: 'Delete',
  }).click();

  await expect(confirmDialog).toBeVisible();
  await expect(popupPage.page.getByRole('heading', {
    name: 'Are you sure?',
  }),).toBeVisible();

  await expect(popupPage.page.getByRole('button', {
    name: 'Yes',
  }),).toBeVisible();
  await expect(popupPage.page.getByRole('button', {
    name: 'No',
  })).toBeVisible();
});

test('Dismissing confirmation dialog for deletion closes the dialog and does not remove the profile.', async ({popupPage}) => {
  await popupPage.createProfile('A Profile', 'IDP A');

  await popupPage.openEditProfileDialog('A Profile');

  await popupPage.page.getByRole('button', {
    name: 'Delete',
  }).click();

  await popupPage.page.getByRole('button', {
    name: 'No',
  }).click();

  const confirmDialog = popupPage.page.locator('#confirm-dialog');
  await expect(confirmDialog).toBeHidden();

  await expect(popupPage.page.getByRole('button', {
    name: 'A Profile',
  })).toBeVisible();
});

test('Confirming profile deletion removes the profile.', async ({page, popupPage}) => {
  await popupPage.createProfile('A Profile', 'IDP A');

  await popupPage.openEditProfileDialog('A Profile');

  await popupPage.page.getByRole('button', {
    name: 'Delete',
  }).click();

  await popupPage.page.getByRole('button', {
    name: 'Yes',
  }).click();

  const confirmDialog = popupPage.page.locator('#confirm-dialog');
  await expect(confirmDialog).toBeHidden();

  // profile was removed from main popup page
  const identities = page.locator('section#identities');
  await expect(identities.getByRole('list')).toBeEmpty();
  await expect(page.getByRole('heading', {name: 'A Profile'})).toBeHidden();
});

test('Editing profile changes its attributes on main page.', async ({page, popupPage}) => {
  await popupPage.createProfile('A Profile', 'IDP A');
  await popupPage.openEditProfileDialog('A Profile');

  await expect(page.locator('#avatar')).toHaveText('A');

  await page.getByPlaceholder('The name in the list').fill('X Profile Edited');
  await page.getByRole('button', {
    name: 'Save',
  }).click();

  await expect(page.getByRole('button', {
    name: 'X Profile Edited',
  })).toBeVisible();
  await expect(page.locator('#avatar')).toHaveText('X');

  // profile was edited on main popup page
  const identities = page.locator('section#identities');
  await expect(identities.locator('.identity-row').first()).toHaveText('X' + 'X Profile Edited',);
});

test('Profile colors can be changed.', async ({page, popupPage}) => {
  await popupPage.createProfile('A Profile', 'IDP A');

  await test.step('change color to red', async () => {
    await popupPage.openEditProfileDialog('A Profile');
    await page.locator('label:has(input[value="red"])').check();
    await page.getByRole('button', {
      name: 'Save',
    }).click();
  });
  await page.waitForTimeout(100);

  const mainAvatar = page.locator('#identity-header .avatar');
  const mainAvatarColor = await mainAvatar.evaluate((el) => window.getComputedStyle(el).getPropertyValue('background-color'));
  expect(mainAvatarColor).toEqual('rgb(255, 0, 0)');

  await test.step('change color to blue', async () => {
    await popupPage.openEditProfileDialog('A Profile');
    await page.locator('label:has(input[value="blue"])').check();
    await page.getByRole('button', {
      name: 'Save',
    }).click();
  });

  const newAvatarColor = await mainAvatar.evaluate((el) => window.getComputedStyle(el).getPropertyValue('background-color'));
  expect(newAvatarColor).toEqual('rgb(0, 0, 255)');
});

test('When editing a profile, IDP and WebID fields are mutually exclusive', async ({ page, popupPage }) => {
  await popupPage.createProfile('A Profile', 'IDP A');
  await popupPage.openEditProfileDialog('A Profile');

  const idp = page.locator('#idp');
  await expect(idp).toBeEditable();

  const webid = page.locator('#webid');
  await expect(webid).toBeDisabled();

  await idp.clear();
  await expect(webid).toBeEditable();

  await webid.fill('WebID');
  await expect(idp).toBeDisabled();

  await webid.clear();
  await expect(idp).toBeEditable();
});

test('Edits of IDP are persisted', async ({ page, popupPage }) => {
  await popupPage.createProfile('A Profile', 'IDP A');
  await popupPage.openEditProfileDialog('A Profile');

  const idp = page.locator('#idp');
  await expect(idp).toHaveValue('IDP A');

  await idp.fill('NEW IDP');

  await page.getByRole('button', {
    name: 'Save',
  }).click();

  await (page.getByRole('button', {
    name: 'A Profile',
  })).click();

  await expect(idp).toHaveValue('NEW IDP');
});

test('Edits of WebID are persisted', async ({ page, popupPage }) => {
  await popupPage.createProfile('A Profile', null, 'WEBID A');
  await popupPage.openEditProfileDialog('A Profile');

  const webid = page.locator('#webid');
  await expect(webid).toHaveValue('WEBID A');

  await webid.fill('NEW WEBID');

  await page.getByRole('button', {
    name: 'Save',
  }).click();

  await (page.getByRole('button', {
    name: 'A Profile',
  })).click();

  await expect(webid).toHaveValue('NEW WEBID');
});

test('popup starts with the error section hidden', async ({ page }) => {
  await expect(page.locator('#error-message-container')).toBeHidden();
});

test('shows no error message when able to retrieve IDP from WebID', async ({ popupPage, page, context }) => {
  await context.route(WEBID_ENDPOINT, async route => {
    await route.fulfill({ contentType: 'application/trig', body: WEBID_RESPONSE });
  });

  await popupPage.createProfile('A Profile', null, WEBID_ENDPOINT);

  const identities = page.locator('section#identities');

  await identities.getByRole('button', {
    name: 'A Profile',
  }).click();

  await expect(page.locator('#error-message-container')).toBeHidden();
});

test('shows error message when unable to retrieve IDP from WebID', async ({ popupPage, page, context }) => {
  await context.route(WEBID_ENDPOINT, async route => {
    await route.abort('failed');
  });

  const PROFILE_NAME = 'A Profile';
  await popupPage.createProfile(PROFILE_NAME, null, WEBID_ENDPOINT);

  const identities = page.locator('section#identities');

  await identities.getByRole('button', {
    name: PROFILE_NAME,
  }).click();

  await expect(page.locator('#error-message-container')).toBeVisible();
  await expect(page.locator('#error-message-container')).toHaveText(`Unable to retrieve IDP from WebID for ${PROFILE_NAME}.`);
});

test('error message disappears when clicking the close icon button', async ({ popupPage, page, context }) => {
  await context.route(WEBID_ENDPOINT, async route => {
    await route.abort('failed');
  });

  await popupPage.createProfile('A Profile', null, WEBID_ENDPOINT);

  const identities = page.locator('section#identities');

  await identities.getByRole('button', {
    name: 'A Profile',
  }).click();

  await expect(page.locator('#error-message-container')).toBeVisible();

  await page.getByLabel('close').click();

  await expect(page.locator('#error-message-container')).toBeHidden();
});

test('error message disappears when clicking a valid profile', async ({ popupPage, page, context }) => {
  await expect(page.locator('#no-identities-prompt')).toBeVisible();
  await context.route(WEBID_ENDPOINT, async route => {
    await route.abort('failed');
  });

  await popupPage.createProfile('A Profile', null, WEBID_ENDPOINT);
  await popupPage.createProfile('B Profile', 'IDP Profile', null);

  const identities = page.locator('section#identities');

  await identities.getByRole('button', {
    name: 'A Profile',
  }).click();

  await expect(page.locator('#error-message-container')).toBeVisible();

  await identities.getByRole('button', {
    name: 'B Profile',
  }).click();

  await expect(page.locator('#error-message-container')).toBeHidden();
});

test('error message disappears when clicking the add profile button', async ({ popupPage, page, context }) => {
  await context.route(WEBID_ENDPOINT, async route => {
    await route.abort('failed');
  });

  await popupPage.createProfile('A Profile', null, WEBID_ENDPOINT);

  const identities = page.locator('section#identities');

  await identities.getByRole('button', {
    name: 'A Profile',
  }).click();

  await expect(page.locator('#error-message-container')).toBeVisible();

  await identities.getByRole('button', {
    name: 'Add',
  }).click();

  await expect(page.locator('#error-message-container')).toBeHidden();
});

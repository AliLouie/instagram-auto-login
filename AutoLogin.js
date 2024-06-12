const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Instagram login URL
const loginUrl = 'https://www.instagram.com/accounts/login/';

// account credentials
const accounts = [
  { username: 'Username', password: 'Pass', proxyIP: '0.0.0.0', proxyPort: 'Port', proxyUser: 'User', proxyPass: 'Pass' },
  // Add more accounts as needed
];

// Function to log in to Instagram and retrieve session ID cookie
async function loginAndGetSessionId(username, password, proxyIP, proxyPort, proxyUser, proxyPass) {
  console.log("Connecting to:", username, password, proxyIP, proxyPort, proxyUser, proxyPass)
  const browser = await chromium.launch({ headless: false,
    proxy: { // if you want disable proxy just comment these codes
      server: `http://${proxyIP}:${proxyPort}`,
      username: `${proxyUser}`,
      password: `${proxyPass}`
  },
  });
  const context = await browser.newContext({
    userDataDir: path.join(__dirname, `user-data-${username}`),
  });
  const page = await context.newPage();

  // Navigate to the login page
  await page.goto(loginUrl, { waitUntil: 'networkidle', timeout: 0 });
  await page.getByLabel('Phone number, username, or email').fill(username);
  await page.getByLabel('Password').fill(password);

  // Submit the login form
  const loginButton = await page.$('button[type="submit"]');
  await Promise.all([
    loginButton.click(),
    new Promise((resolve) => {
      page.once('load', () => {
        const url = page.url();
        if (url === 'https://www.instagram.com/') {
          console.log('insta loaded');
          resolve();
        } else if (url.includes('https://www.instagram.com/challenge/action/')) {
          const dynamicPart = url.split('https://www.instagram.com/challenge/action/')[1];
          console.log('Challenge loaded with dynamic part:', dynamicPart);
          resolve();
        } else {
          console.log(`Unexpected URL: ${url}`);
          resolve();
        }
      });
    }),
  ]);

  // Get the session ID cookie
  const cookies = await context.cookies();
  const sessionIdCookie = cookies.find((cookie) => cookie.name === 'sessionid');

  return { browser, context, sessionIdCookie };
}

// Function to keep accounts signed in and retrieve session ID cookies
async function keepSignedIn() {
  const sessionIds = [];
  const browserInstances = [];

  for (const account of accounts) {
    const { username, password, proxyIP, proxyPort, proxyUser, proxyPass } = account;

    const { browser, context, sessionIdCookie } = await loginAndGetSessionId(username, password, proxyIP, proxyPort, proxyUser, proxyPass);
    if (sessionIdCookie) {
      sessionIds.push({ username, sessionId: sessionIdCookie.value });
      browserInstances.push({ username, browser, context });
      console.log(`Logged in to ${account.username} and retrieved session ID`);
    } else {
      console.log(`Failed to log in to ${account.username}.`);
    }
  }

  fs.writeFileSync('session_ids.json', JSON.stringify(sessionIds, null, 2));
  console.log('Session IDs saved to session_ids.json');

  console.log('Accounts are logged in and browsers are open.');

  return browserInstances;
}

(async () => {
  const browserInstances = await keepSignedIn();

  // Keep the script running (you can add additional logic here if needed)
  console.log('Script running...');
})();
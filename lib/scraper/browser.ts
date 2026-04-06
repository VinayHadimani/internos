import { chromium, Browser, BrowserContext } from 'playwright';

let browser: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });
  }
  return browser;
}

export async function createContext(): Promise<BrowserContext> {
  const browser = await getBrowser();
  return await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'en-IN',
  });
}

export async function scrapeUrl(url: string, waitFor?: string): Promise<string> {
  const context = await createContext();
  const page = await context.newPage();

  try {
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    if (waitFor) {
      await page.waitForSelector(waitFor, { timeout: 10000 });
    } else {
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    }

    const html = await page.content();
    return html;
  } finally {
    await context.close();
  }
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

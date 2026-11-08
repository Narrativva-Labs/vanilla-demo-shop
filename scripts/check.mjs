// Author: František Bujnovský. Run against the unconfigured demo.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { messages } from '../js/i18n.js';
const require = createRequire(import.meta.url);
const { chromium, devices } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:8765/';
const origin = new URL(base).origin;
assert(['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname), 'Use a local server');
await mkdir('output/playwright', { recursive: true });
const browser = await chromium.launch();
const report = [];
const commerce = new Set(['view_item_list','select_item','view_item','add_to_cart','view_cart','remove_from_cart','begin_checkout','add_shipping_info','add_payment_info','purchase']);
try {
  const scenarios = [
    ...['desktop', 'Pixel 7', '360px', 'blocked-storage'].map(mode => ({ mode, language: 'cs' })),
    ...['desktop', 'Pixel 7'].map(mode => ({ mode, language: 'en' })),
    ...['desktop', 'Pixel 7', 'blocked-storage'].map(mode => ({ mode, language: 'cs', mixed: true }))
  ];
  for (const scenario of scenarios) {
    const { mode, mixed = false } = scenario;
    let language = scenario.language;
    let ui = messages[language];
    const label = `${mode}-${language}${mixed ? '-switch' : ''}`;
    const languageBase = () => new URL(language === 'en' ? 'en/' : './', base).href;
    const context = await browser.newContext(mode === 'Pixel 7' ? devices['Pixel 7'] : { viewport: { width: mode === 'desktop' ? 1280 : 360, height: 900 } });
    // The data layer is checked on its own: GTM and Vanilla stay off here, so any outgoing request is a shop bug.
    const entries = [], requests = [], errors = [], snapshots = [];
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      requests.push({ url: url.href, method: route.request().method() });
      if (url.origin !== origin && url.hostname !== 'cdn.jsdelivr.net') {
        errors.push('Unexpected request: ' + url.href);
        return route.abort();
      }
      if (url.origin === origin && url.pathname.endsWith('/js/config.js'))
        return route.fulfill({ contentType: 'text/javascript', body: "window.SHOP_CONFIG = Object.freeze({ GTM_ID: '', VANILLA_SRC: '' });" });
      return route.continue();
    });
    await context.exposeBinding('recordLayer', ({ page }, url, entry) => entries.push({ page, url, entry }));
    await context.addInitScript(({ blocked }) => {
      if (blocked) Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } });
      const layer = [];
      layer.push = function (...items) {
        items.forEach(entry => window.recordLayer(location.href, JSON.parse(JSON.stringify(entry))));
        return Array.prototype.push.apply(this, items);
      };
      window.dataLayer = layer;
    }, { blocked: mode === 'blocked-storage' });
    const page = await context.newPage();
    context.on('page', tab => tab.on('pageerror', error => errors.push(error.message)));
    page.on('pageerror', error => errors.push(error.message));
    // gtm.* entries come from Tag Manager itself, not from the shop.
    const events = () => entries.filter(e => e.page === page && e.entry.event && !String(e.entry.event).startsWith('gtm.')).map(e => e.entry.event);
    async function snap(label) {
      await page.waitForFunction(() => document.querySelector('#content')?.children.length > 0);
      const layer = await page.evaluate(() => JSON.parse(JSON.stringify(window.dataLayer)));
      snapshots.push({ label, url: page.url(), dataLayer: layer });
      assert(await page.locator('.demo').isVisible());
      assert.equal(await page.locator('html').getAttribute('lang'), language);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), mode + ': horizontal overflow on ' + label);
      const types = { home: 'homepage', product: 'product', search: 'category', cart: 'cart', shipping: 'checkout', payment: 'checkout', summary: 'checkout', thanks: 'confirmation', lead: 'contact', 'lead-thanks': 'confirmation' };
      const kind = await page.locator('body').getAttribute('data-page');
      assert.deepEqual(layer[0], { page_type: types[kind], language });
      assert.deepEqual(layer[1], { event: 'page_view' });
      for (let i = 0; i < layer.length; i++) if (commerce.has(layer[i].event)) assert.deepEqual(layer[i - 1], { ecommerce: null });
    }
    async function clickNav(locator, path) {
      await Promise.all([page.waitForURL(url => url.pathname.endsWith(path)), locator.click()]);
    }
    async function runSearch(term) {
      if (!await page.locator('#query').isVisible()) await page.locator('#search-toggle').click();
      await page.locator('#query').fill(term);
      await clickNav(page.locator('#search-form button'), 'hledat.html');
    }
    await page.goto(languageBase());
    await snap('home');
    await page.getByText(ui.cookies.consentModal.title, { exact: true }).waitFor({ state: 'visible' });
    await page.locator('#cc-main [data-role="necessary"]').click();
    await page.waitForFunction(() => dataLayer.some(x => x[0] === 'consent' && x[1] === 'update'));
    assert.deepEqual(await page.evaluate(() => [...dataLayer.find(x => x[0] === 'consent')]), ['consent', 'default', { ad_storage:'denied', analytics_storage:'denied', ad_user_data:'denied', ad_personalization:'denied' }]);
    await page.getByRole('button', { name: ui.cookieSettings, exact: true }).click();
    await page.locator('#cc-main .pm [data-role="all"]').click();
    await page.waitForFunction(() => dataLayer.some(x => x[1] === 'update' && x[2]?.analytics_storage === 'granted' && x[2]?.ad_user_data === 'granted'));
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `output/playwright/${label}-home.png`, fullPage: true });
    if (mode === 'Pixel 7') {
      const rect = await page.locator('.product .fruit').first().boundingBox();
      assert(rect && rect.y >= 0 && rect.y + rect.height <= page.viewportSize().height, 'First fruit must fit in the first Pixel 7 screen');
    }
    if (mode !== 'desktop') {
      assert.equal(await page.locator('#search-toggle').getAttribute('aria-expanded'), 'false');
      assert(!await page.locator('#query').isVisible());
      const menu = await page.locator('header nav a').evaluateAll(links => links.map(link => link.getBoundingClientRect().y));
      assert(menu.every(y => Math.abs(y - menu[0]) < 2), 'Mobile menu must stay on one row');
      await page.locator('#search-toggle').click();
      assert(await page.locator('#query').isVisible());
      await page.locator('#query').press('Escape');
      assert(!await page.locator('#query').isVisible());
    }
    // A real middle-click opens the product in a second tab.
    const popupPromise = context.waitForEvent('page');
    await page.locator('.product').first().click({ button: 'middle' });
    const popup = await popupPromise;
    await popup.waitForLoadState();
    await popup.waitForFunction(() => dataLayer.some(x => x.event === 'view_item'));
    assert.equal(await popup.locator('h1').textContent(), ui.products.jablko.name);
    await popup.close();
    await clickNav(page.locator('.product').first(), 'produkt.html');
    await snap('apple');
    await page.getByRole('button', { name: ui.add, exact: true }).click();
    await page.getByRole('button', { name: ui.add, exact: true }).click();
    await snap('apple added twice');
    await clickNav(page.getByRole('link', { name: ui.goCart }), 'kosik.html');
    await snap('cart');
    await page.getByRole('button', { name: ui.remove }).click();
    await snap('cart removed');
    const searchTerm = language === 'en' ? 'banana' : 'banán';
    await runSearch(searchTerm);
    await snap('search');
    await clickNav(page.locator('.product'), 'produkt.html');
    await snap('banana');
    await page.goBack();
    await snap('search back');
    await clickNav(page.locator('.product'), 'produkt.html');
    await snap('banana return');
    await page.getByRole('button', { name: ui.add, exact: true }).click();
    if (mixed) {
      const oldURL = new URL(page.url());
      const oldItem = await page.evaluate(() => dataLayer.find(x => x.event === 'add_to_cart').ecommerce.items[0]);
      const countBefore = await page.locator('#cart-count').textContent();
      language = 'en'; ui = messages.en;
      await Promise.all([
        page.waitForURL(url => url.pathname.endsWith('/en/produkt.html')),
        page.locator('#language-en').click()
      ]);
      await snap('language switched with fruit in cart');
      assert.equal(new URL(page.url()).search, oldURL.search, 'Language switch must preserve all query parameters');
      assert.equal(await page.locator('#cart-count').textContent(), countBefore);
      assert.equal(await page.locator('h1').textContent(), 'Banana');
      assert.deepEqual(await page.evaluate(() => dataLayer.find(x => x.event === 'view_item').ecommerce.items[0]), oldItem);
    }
    await clickNav(page.getByRole('link', { name: ui.goCart }), 'kosik.html');
    await snap('checkout cart');
    const cartItems = await page.evaluate(() => dataLayer.find(x => x.event === 'view_cart').ecommerce.items);
    assert.equal(cartItems.length, 1);
    assert.equal(cartItems[0].quantity, 1);
    assert.equal(cartItems[0].item_name, 'Banán');
    await clickNav(page.getByRole('link', { name: ui.checkout }), 'doprava.html');
    await snap('shipping');
    await clickNav(page.locator('[data-choice="1"]'), 'platba.html');
    await snap('payment');
    await clickNav(page.locator('[data-choice="0"]'), 'shrnuti.html');
    await snap('summary');
    await clickNav(page.getByRole('button', { name: ui.pay, exact: true }), 'dekujeme.html');
    await snap('thanks');
    await page.screenshot({ path: `output/playwright/${label}-thanks.png`, fullPage: true });
    await page.reload(); await snap('thanks reload');
    await clickNav(page.getByRole('link', { name: ui.homeLink }), 'index.html');
    await page.goBack(); await snap('thanks back');
    const purchases = entries.filter(e => e.page === page && e.entry.event === 'purchase');
    assert.equal(purchases.length, 1, 'Purchase must be deduplicated');
    assert.equal(purchases[0].entry.ecommerce.shipping, 99);
    assert.equal(purchases[0].entry.ecommerce.value, 22);
    assert.equal(purchases[0].entry.ecommerce.tax, 14.52);
    assert.match(purchases[0].entry.ecommerce.transaction_id, /^fruit-/);
    assert.equal(purchases[0].entry.ecommerce.items[0].item_list_id, 'search');
    for (const path of ['doprava.html','platba.html','shrnuti.html']) {
      await page.goto(new URL(path, languageBase()).href);
      await page.waitForURL('**/kosik.html');
      await snap('empty redirect ' + path);
    }
    await clickNav(page.getByRole('link', { name: ui.leadLink, exact: true }), 'poptavka.html');
    await page.locator('#email').fill('tester@example.test');
    await page.locator('#message').fill('Private fruit message 12345');
    await clickNav(page.getByRole('button', { name: ui.sendLead }), 'poptavka-odeslano.html');
    await snap('lead sent');
    await page.reload(); await snap('lead confirmation reload');
    const leads = entries.filter(e => e.page === page && e.entry.event === 'generate_lead');
    assert.equal(leads.length, 1);
    assert.deepEqual(leads[0].entry, { event: 'generate_lead', currency: 'CZK', value: 500, lead_source: 'contact_form' });
    const serialized = JSON.stringify(entries.map(e => e.entry));
    assert(!serialized.includes('tester@example.test') && !serialized.includes('Private fruit message'));
    assert(entries.some(e => e.entry.event === 'search' && e.entry.search_term === searchTerm));
    await runSearch('<script>');
    await snap('no results');
    assert(await page.getByText(ui.noResults, { exact: true }).isVisible());
    const primary = entries.filter(e => e.page === page);
    for (let i = 0; i < primary.length; i++) {
      const entry = primary[i].entry;
      if (commerce.has(entry.event)) {
        assert.deepEqual(primary[i-1].entry, { ecommerce: null });
        assert.equal(entry.ecommerce.currency, 'CZK');
        assert.equal(entry.ecommerce.value, Math.round(entry.ecommerce.items.reduce((n, row) => n + row.price * row.quantity, 0) * 100) / 100);
        for (const number of [entry.ecommerce.value, entry.ecommerce.shipping, entry.ecommerce.tax, ...entry.ecommerce.items.map(row => row.price)].filter(x => x !== undefined)) {
          assert.equal(typeof number, 'number');
          assert(Math.abs(number * 100 - Math.round(number * 100)) < 1e-8, 'At most two decimal places');
        }
        assert(!('language' in entry.ecommerce) && !('locale' in entry.ecommerce));
        for (const row of entry.ecommerce.items) {
          for (const key of ['item_id','item_name','item_category','price','quantity']) assert(key in row);
          assert.equal(row.item_name, messages.cs.products[row.item_id].name, 'Canonical Czech item name');
        }
      }
    }
    for (let i = 0; i < primary.length; i++) {
      if ('page_type' in primary[i].entry) {
        assert.deepEqual(Object.keys(primary[i].entry).sort(), ['language', 'page_type']);
        assert(['cs', 'en'].includes(primary[i].entry.language));
        assert.deepEqual(primary[i + 1].entry, { event: 'page_view' });
      }
    }
    const sequence = events();
    const expected = [
      'page_view', 'view_item_list', 'select_item', 'select_item',
      'page_view', 'view_item', 'add_to_cart', 'add_to_cart',
      'page_view', 'view_cart', 'remove_from_cart',
      'page_view', 'search', 'view_item_list', 'select_item',
      'page_view', 'view_item',
      'page_view', 'search', 'view_item_list', 'select_item',
      'page_view', 'view_item', 'add_to_cart',
      ...(mixed ? ['page_view', 'view_item'] : []),
      'page_view', 'view_cart', 'begin_checkout',
      'page_view', 'add_shipping_info',
      'page_view', 'add_payment_info',
      'page_view', // Summary.
      'page_view', 'purchase',
      'page_view', // Confirmation reload.
      'page_view', 'view_item_list',
      'page_view', // Confirmation via history.
      ...Array(3).fill(['page_view', 'page_view', 'view_cart']).flat(),
      'page_view', 'page_view', 'generate_lead', 'page_view', // Lead sent only on its confirmation page.
      'page_view', 'search', 'view_item_list'
    ];
    assert.deepEqual(sequence, expected, 'Full event sequence');
    const shippingEvent = primary.find(e => e.entry.event === 'add_shipping_info').entry;
    const paymentEvent = primary.find(e => e.entry.event === 'add_payment_info').entry;
    assert.equal(shippingEvent.ecommerce.shipping_tier, 'Kurýr');
    assert.equal(paymentEvent.ecommerce.payment_type, 'Kartou');
    assert(requests.every(r => r.method === 'GET'), 'No submission requests');
    assert.deepEqual(errors, []);
    await page.screenshot({ path: `output/playwright/${label}.png`, fullPage: true });
    report.push({ scenario: label, sequence, snapshots, records: primary.map(({ url, entry }) => ({ url, entry })), requests });
    console.log(label + ': PASS · ' + sequence.join(' → '));
    await context.close();
  }
  const plain = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 360, height: 800 } });
  const plainPage = await plain.newPage();
  for (const prefix of ['', 'en/']) {
    await plainPage.goto(new URL(prefix + 'index.html', base).href);
    assert(await plainPage.locator('#query').isVisible(), 'Search must remain visible without JavaScript');
    assert(!await plainPage.locator('#search-toggle').isVisible());
    assert(await plainPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
  await plain.close();
  console.log('No-JavaScript mobile search: PASS (CZ + EN)');
  await writeFile('output/playwright/report.json', JSON.stringify(report, null, 2));
} finally { await browser.close(); }

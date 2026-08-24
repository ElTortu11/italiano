/**
 * Responsive layout gate tests.
 * Asserts that no route causes documentElement or body to exceed the viewport width.
 * Run with: npm run test:responsive
 */

const { chromium, webkit } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:3000';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const VIEWPORTS = [
  { name: '320x568',  width: 320,  height: 568,  mobile: true  },
  { name: '390x844',  width: 390,  height: 844,  mobile: true  },
  { name: '1440x900', width: 1440, height: 900,  mobile: false },
];

// routeKey matches the SPA router keys (location.hash.replace('#',''))
// Tab labels match the exact text in .tab-btn elements
const ROUTES = [
  { routeKey: 'conjugation', name: 'Verbi-Pratica',      tab: null           },
  { routeKey: 'conjugation', name: 'Verbi-PerVerbo',     tab: 'Per verbo'    },
  { routeKey: 'conjugation', name: 'Verbi-Terminazioni', tab: 'Terminazioni' },
  { routeKey: 'conjugation', name: 'Verbi-Riferimento',  tab: 'Riferimento'  },
  { routeKey: 'conjugation', name: 'Punteggi',           tab: 'Punteggi'     },
  { routeKey: 'vocabulary',  name: 'Vocabolario',        tab: null           },
];

/** Wait for app to initialise and window.navigate to be available */
async function waitForApp(page) {
  await page.waitForFunction(() => typeof window.navigate === 'function', { timeout: 10000 });
  // Wait for spinner to disappear
  await page.waitForFunction(
    () => !document.querySelector('.spinner'),
    { timeout: 8000 }
  ).catch(() => {});
}

/** Navigate to a route via the app router, then wait for render */
async function goTo(page, routeKey) {
  await page.evaluate((r) => window.navigate(r), routeKey);
  await page.waitForTimeout(800);
  // Wait until spinner is gone
  await page.waitForFunction(
    () => !document.querySelector('.spinner'),
    { timeout: 8000 }
  ).catch(() => {});
  await page.waitForTimeout(200);
}

/** Click a tab button by text label */
async function clickTab(page, tabLabel) {
  if (!tabLabel) return;
  try {
    const btn = page.locator(`.tab-btn`).filter({ hasText: tabLabel }).first();
    await btn.waitFor({ state: 'visible', timeout: 5000 });
    await btn.click();
    await page.waitForTimeout(500);
  } catch (e) {
    console.log(`    ⚠ Tab "${tabLabel}" not found — skipping click`);
  }
}

async function measureOverflow(page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const main    = document.querySelector('.main');
    const content = document.querySelector('.content');
    return {
      viewportWidth:  vw,
      docScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      mainRight:    main    ? Math.round(main.getBoundingClientRect().right)    : null,
      contentRight: content ? Math.round(content.getBoundingClientRect().right) : null,
    };
  });
}

async function measureTerminazioni(page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const docSW = document.documentElement.scrollWidth;
    const tables = [...document.querySelectorAll('table, .conj-table, [style*="overflow-x"]')];
    const scrolling = tables.filter(el => el.scrollWidth > el.clientWidth + 1);
    return {
      viewportWidth: vw,
      docScrollWidth: docSW,
      docOk: docSW <= vw + 1,
      tablesFound: tables.length,
      scrollingInternally: scrolling.length,
    };
  });
}

async function runBrowser(browserType, browserName) {
  const browser = await browserType.launch({ headless: true });
  const failures = [];
  const screenshots = [];

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();

    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // Load app once, then navigate within the SPA
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await waitForApp(page);

    for (const route of ROUTES) {
      // Desktop: skip per-tab checks (tabs don't cause overflow on wide screens)
      if (!vp.mobile && route.tab) continue;

      await goTo(page, route.routeKey);
      if (route.tab) await clickTab(page, route.tab);

      const label = `[${browserName}][${vp.name}] ${route.name}`;

      // Take screenshots at 390px and desktop
      if (vp.width === 390 || !vp.mobile) {
        const shotName = `${browserName}_${vp.name}_${route.name.replace(/[^a-z0-9]/gi, '_')}.png`;
        const shotPath = path.join(SCREENSHOT_DIR, shotName);
        await page.screenshot({ path: shotPath, fullPage: false });
        screenshots.push(shotPath);
        console.log(`    📸 ${path.basename(shotPath)}`);
      }

      // Terminazioni: doc must fit, table wrappers may scroll internally
      if (route.name === 'Verbi-Terminazioni' && vp.mobile) {
        const tm = await measureTerminazioni(page);
        if (!tm.docOk) {
          failures.push(`${label}: document wider than viewport — scrollWidth=${tm.docScrollWidth} > vp=${tm.viewportWidth}`);
          console.log(`  ✗ ${label}: doc=${tm.docScrollWidth} > vp=${tm.viewportWidth}`);
        } else {
          console.log(`  ✓ ${label}: doc fits (${tm.docScrollWidth}≤${tm.viewportWidth}); internal table scroll: ${tm.scrollingInternally}/${tm.tablesFound}`);
        }
        continue;
      }

      // Standard overflow check
      const m = await measureOverflow(page);
      const lim = m.viewportWidth + 1;
      const checks = [
        { name: 'documentElement.scrollWidth', val: m.docScrollWidth  },
        { name: 'body.scrollWidth',            val: m.bodyScrollWidth  },
        ...(m.mainRight    !== null ? [{ name: '.main.right',    val: m.mainRight    }] : []),
        ...(m.contentRight !== null ? [{ name: '.content.right', val: m.contentRight }] : []),
      ];

      let bad = false;
      for (const c of checks) {
        if (c.val > lim) {
          failures.push(`${label} — ${c.name}: ${c.val} > limit ${lim} (vp ${m.viewportWidth})`);
          bad = true;
        }
      }
      if (!bad) {
        console.log(`  ✓ ${label}: doc=${m.docScrollWidth} body=${m.bodyScrollWidth} mainR=${m.mainRight} contentR=${m.contentRight} vp=${m.viewportWidth}`);
      } else {
        console.log(`  ✗ ${label}: FAILED — see failures list`);
      }
    }

    if (consoleErrors.length > 0) {
      failures.push(`[${browserName}][${vp.name}] Console errors (${consoleErrors.length}):\n    ${consoleErrors.slice(0, 5).join('\n    ')}`);
      console.log(`  ⚠ ${consoleErrors.length} console error(s) at ${vp.name}`);
    }

    await context.close();
  }

  await browser.close();
  return { failures, screenshots };
}

(async () => {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Responsive layout gate — Chromium + WebKit');
  console.log('═══════════════════════════════════════════════════════════');

  const allFailures = [];
  const allScreenshots = [];

  for (const [bt, name] of [[chromium, 'Chromium'], [webkit, 'WebKit']]) {
    console.log(`\n▶ ${name}`);
    const { failures, screenshots } = await runBrowser(bt, name);
    allFailures.push(...failures);
    allScreenshots.push(...screenshots);
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  if (allFailures.length === 0) {
    console.log('  ✅ ALL RESPONSIVE GATES PASSED');
  } else {
    console.log(`  ❌ ${allFailures.length} FAILURE(S):`);
    allFailures.forEach(f => console.log(`    • ${f}`));
  }
  console.log(`\n  Screenshots: ${SCREENSHOT_DIR}`);
  console.log('═══════════════════════════════════════════════════════════');

  process.exit(allFailures.length > 0 ? 1 : 0);
})();

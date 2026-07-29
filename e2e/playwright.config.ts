import { defineConfig, devices, type ReporterDescription } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

/**
 * Read environment variables from file. https://github.com/motdotla/dotenv
 *
 * `quiet: true` because dotenv v17 prints a promotional banner to STDOUT on load, which
 * corrupts any reporter or script that reads Playwright's output from a pipe.
 */
dotenv.config({ path: path.resolve(__dirname, '.env'), quiet: true });

const isCI = !!process.env.CI;

/**
 * 127.0.0.1 rather than localhost: Node 18+ resolves `localhost` to ::1 first,
 * which stalls for the connect timeout against Nest's IPv4-only listener.
 */
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000';
const API_URL = process.env.E2E_API_URL ?? 'http://127.0.0.1:4000';

const ADMIN_STATE = path.resolve(__dirname, 'playwright/.auth/admin.json');

/**
 * Visual baselines are byte-sensitive to font rasterisation, so only the Linux
 * (CI) baselines are committed. A macOS/Windows developer run therefore SKIPS
 * screenshot comparison rather than failing on host-font differences — see
 * README "Intentional skips".
 */
const CAN_COMPARE_SCREENSHOTS = process.platform === 'linux';

/**
 * Headless Chromium has no GPU, so `Hero3D` (a @react-three/fiber Canvas mounted
 * on /, /login and every admin page header) cannot acquire a WebGL context and
 * spins a retry loop. SwiftShader gives it a soft-rasterised context that
 * initialises once and then idles cheaply.
 */
const WEBGL_ARGS = [
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--disable-dev-shm-usage',
];

const CHROME = { ...devices['Desktop Chrome'], launchOptions: { args: WEBGL_ARGS } };

/** Specs that never open a browser or are handled by a dedicated project. */
const NON_UI_SPECS = [
  /.*\.api\.spec\.ts/,
  /.*\.a11y\.spec\.ts/,
  /.*\.visual\.spec\.ts/,
  /.*\.security\.spec\.ts/,
];

const reporter: ReporterDescription[] = [
  ['list'],
  ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ['json', { outputFile: 'test-results/e2e-results.json' }],
];
if (isCI) {
  // blob feeds `playwright merge-reports` across shards; github annotates the PR.
  reporter.push(['blob'], ['github']);
}

export default defineConfig({
  testDir: './tests',

  /**
   * Per-test budget. RSC pages read through `unstable_cache`, and `serverApi`
   * retries twice at a 10s timeout each, so a cold backend can legitimately
   * take ~30s to render a page for the first time.
   */
  timeout: 90_000,

  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      /**
       * Anti-aliasing on the gold gradients never matches to the pixel. 0.15%
       * of pixels at threshold 0.2 is the empirically stable band; tighter than
       * this and every run flakes, looser and real regressions slip through.
       */
      maxDiffPixelRatio: 0.0015,
      threshold: 0.2,
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    },
  },

  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 4 : '50%',
  globalTimeout: isCI ? 45 * 60_000 : undefined,
  maxFailures: isCI ? 40 : 0,

  outputDir: 'test-results/artifacts',
  /**
   * `{testDir}` is required here, not optional decoration.
   *
   * `{testFileDir}` is the path FROM testDir to the spec's directory — `visual`, not
   * `tests/visual` — and a relative template resolves against the config directory. So
   * the old value wrote baselines to `e2e/visual/__screenshots__/...`, while both
   * .gitignore files and `e2e-visual-baselines.yml`'s `add-paths` all describe a location
   * under `e2e/tests/`. Nothing matched, so `git add` picked up nothing, the
   * PR step reported "not ahead of base" and the workflow finished GREEN having produced
   * no PR at all — twice. Anchoring on {testDir} puts the images beside their spec, which
   * is what the rest of the repo already assumes.
   */
  snapshotPathTemplate:
    '{testDir}/{testFileDir}/__screenshots__/{testFileName}/{arg}-{projectName}-{platform}{ext}',

  reporter,

  use: {
    baseURL: BASE_URL,
    headless: true,

    /**
     * The single biggest stability win. `frontend/src/app/globals.css` zeroes
     * every animation and transition under prefers-reduced-motion, and
     * `useReducedMotion()` is honoured in `shared/motion/primitives.tsx`,
     * `tilt-card.tsx`, `best-events-slider.tsx` and `website/components/gallery.tsx`
     * — so Reveal/Stagger settle instantly, TiltCard and Magnetic stop drifting
     * under the cursor, and the home slider stops auto-advancing every 5s.
     *
     * It does NOT stop: Lenis smooth scroll, the launch splash, the WebGL
     * canvas, or BrandLoader's message interval. Those are handled by
     * `src/fixtures/init-scripts.ts` and per-spec waits.
     *
     * Lives under `contextOptions` because `reducedMotion` is a browser-context
     * option, not a top-level Playwright test option.
     */
    contextOptions: { reducedMotion: 'reduce' },

    /**
     * Pinned because `shared/ui/theme-toggle.tsx` renders an empty
     * `<div className="h-9 w-9" />` until mounted, and next-themes would
     * otherwise inherit the runner's OS preference and flip half the palette
     * mid-run.
     */
    colorScheme: 'light',

    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
    viewport: { width: 1440, height: 900 },

    actionTimeout: 15_000,
    navigationTimeout: 45_000,

    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: isCI ? 'retain-on-failure' : 'off',

    launchOptions: { args: WEBGL_ARGS },
  },

  projects: [
    /* ------------------------------------------------------------------ setup */
    {
      /**
       * Health-gates the API and the site — neutralising the "serverApi swallows
       * errors and returns null, so an empty page looks like a pass" trap — then
       * performs ONE real UI login and persists localStorage as admin
       * storageState. Auth is 100% localStorage (zero cookies), so storageState
       * round-trips it cleanly, and one login per run keeps us under the
       * POST /auth/login 10/min throttle.
       */
      name: 'setup',
      testMatch: /global\.setup\.ts/,
      teardown: 'teardown',
      use: CHROME,
    },
    {
      name: 'teardown',
      testMatch: /global\.teardown\.ts/,
      use: { baseURL: API_URL },
    },

    /* --------------------------------------------------------- api / contract */
    {
      /** No browser at all — pure APIRequestContext against the Nest API. */
      name: 'api',
      testMatch: /.*\.api\.spec\.ts/,
      dependencies: ['setup'],
      use: { baseURL: API_URL },
    },

    /* ---------------------------------------------------------------- security */
    {
      /**
       * Its own project rather than a `grep`, because the rate-limit specs need
       * E2E_IP_PARTITION=0 (one shared throttler bucket, so a real 429 is
       * observable) while the rest of the suite needs it on. A project boundary
       * makes that a config concern instead of a per-spec incantation.
       */
      name: 'security',
      testMatch: /.*\.security\.spec\.ts/,
      dependencies: ['setup'],
      use: { ...CHROME },
    },

    /* ---------------------------------------------------------------------- ui */
    {
      name: 'chromium',
      testMatch: /.*\.spec\.ts/,
      testIgnore: NON_UI_SPECS,
      dependencies: ['setup'],
      use: CHROME,
    },
    {
      /**
       * Cross-browser is a tagged smoke subset. The app has a single rendering
       * path; full triplication triples runtime for near-zero signal.
       */
      name: 'firefox',
      grep: /@cross-browser/,
      testIgnore: NON_UI_SPECS,
      dependencies: ['setup'],
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      grep: /@cross-browser/,
      testIgnore: NON_UI_SPECS,
      dependencies: ['setup'],
      use: { ...devices['Desktop Safari'] },
    },

    /* ------------------------------------------------------------------ mobile */
    {
      /**
       * Navbar collapses to a hamburger below `md`, and the admin Sidebar is
       * `hidden md:flex` — i.e. admin is entirely unnavigable on mobile. The
       * admin responsive specs assert that as current behaviour.
       */
      name: 'mobile-chrome',
      grep: /@mobile/,
      testIgnore: NON_UI_SPECS,
      dependencies: ['setup'],
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      grep: /@mobile/,
      testIgnore: NON_UI_SPECS,
      dependencies: ['setup'],
      use: { ...devices['iPhone 13'] },
    },

    /* -------------------------------------------------------------------- a11y */
    {
      name: 'a11y',
      testMatch: /.*\.a11y\.spec\.ts/,
      dependencies: ['setup'],
      use: CHROME,
    },

    /* ------------------------------------------------------------------ visual */
    {
      name: 'visual',
      testMatch: /.*\.visual\.spec\.ts/,
      dependencies: ['setup'],
      /** Off-platform: render but diff nothing, rather than fail on font metrics. */
      ignoreSnapshots: !CAN_COMPARE_SCREENSHOTS,
      retries: 0,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 1,
        launchOptions: {
          args: [
            ...WEBGL_ARGS,
            '--force-device-scale-factor=1',
            '--hide-scrollbars',
            '--disable-lcd-text',
            '--font-render-hinting=none',
            '--disable-skia-runtime-opts',
          ],
        },
      },
    },
  ],

  /**
   * No `webServer` in CI or in orchestrated runs — `scripts/stack.mjs` owns the
   * processes, because (a) the database must be branched, migrated and seeded
   * BEFORE the NestJS process starts, since PrismaService connects at module
   * init, and Playwright starts `webServer` *before* globalSetup; and (b)
   * NEXT_PUBLIC_API_URL is inlined by `next build`, which is a cacheable CI step
   * rather than a webServer command.
   *
   * Opt in with E2E_WEBSERVER=1 for a fast local loop against an
   * already-prepared database.
   */
  webServer:
    process.env.E2E_WEBSERVER === '1'
      ? [
          {
            command: 'npm run start:dev',
            cwd: path.resolve(__dirname, '../backend'),
            url: `${API_URL}/api/departments`,
            reuseExistingServer: true,
            timeout: 120_000,
            stdout: 'pipe',
          },
          {
            command: 'npm run dev',
            cwd: path.resolve(__dirname, '../frontend'),
            url: BASE_URL,
            reuseExistingServer: true,
            timeout: 180_000,
            stdout: 'pipe',
            env: { NEXT_PUBLIC_API_URL: API_URL },
          },
        ]
      : undefined,
});

export { ADMIN_STATE, BASE_URL, API_URL };

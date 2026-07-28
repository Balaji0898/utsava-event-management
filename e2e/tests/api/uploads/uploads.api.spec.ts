import { test, expect } from '@fixtures/test';
import { apiPaths } from '@config/urls';
import { payloads } from '@data/test-data';
import { GIF_1X1, HTML_DISGUISED, PNG_1X1, SVG_WITH_SCRIPT, oversizePng } from '@components/uploader.component';

/**
 * API-UPL — the upload gate.
 *
 * This is the app's only route that accepts arbitrary bytes, and the files it stores are
 * served straight back from `/uploads` on the SAME ORIGIN as the app. So the MIME
 * allowlist is not a convenience — it is the control that stops `/uploads` becoming a
 * stored-XSS delivery path. SVG is deliberately excluded from
 * `FileTypeValidator(/^image\/(png|jpe?g|webp|gif)$/)` for exactly that reason, and an
 * accidental widening of that regex would be a serious regression. Hence a permanent
 * test per rejected type rather than one representative case.
 *
 * Serial: every upload writes into the shared `backend/uploads/` directory.
 */
test.describe.configure({ mode: 'serial' });

const FOLDER = 'e2e-test';

/** Playwright's multipart helper shape. */
const upload = (name: string, mimeType: string, buffer: Buffer) => ({ name, mimeType, buffer });

test.describe('API uploads - accepted types', () => {
  for (const [label, name, mimeType, buffer] of [
    ['PNG', 'e2e.png', 'image/png', PNG_1X1],
    ['JPEG', 'e2e.jpg', 'image/jpeg', PNG_1X1],
    ['WebP', 'e2e.webp', 'image/webp', PNG_1X1],
    ['GIF', 'e2e.gif', 'image/gif', GIF_1X1],
  ] as const) {
    test(`API-UPL-P ${label} is accepted and returns a reachable URL`, async ({ api }) => {
      const res = await api.postMultipart(apiPaths.uploads.create(FOLDER), {
        file: upload(name, mimeType, buffer),
      });
      expect(res.status(), `${label} must be accepted (got ${await res.text()})`).toBe(201);

      const body = await res.json();
      expect(body.url, 'the response must carry a URL').toBeTruthy();

      /** A stored file nobody can fetch is useless, so resolve it. */
      const fetched = await api.fetchAbsolute(body.url);
      expect(fetched.status(), 'the uploaded file must be served back').toBe(200);
    });
  }
});

test.describe('API uploads - rejected input', () => {
  test('API-UPL-S-01 an SVG carrying a script is rejected', async ({ api }) => {
    /**
     * The single most important case in this file. An accepted SVG would be served from
     * `/uploads` on the app's own origin, so its embedded `<script>` would run as
     * first-party code with access to the localStorage access and refresh tokens.
     */
    const res = await api.postMultipart(apiPaths.uploads.create(FOLDER), {
      file: upload('payload.svg', 'image/svg+xml', SVG_WITH_SCRIPT),
    });
    expect(res.status(), 'SVG must be rejected — it can carry executable script').toBe(400);
  });

  test('API-UPL-S-02 a file over the 8 MB cap is rejected', async ({ api }) => {
    const res = await api.postMultipart(apiPaths.uploads.create(FOLDER), {
      file: upload('huge.png', 'image/png', oversizePng()),
    });
    /**
     * Two independent limits apply: multer's `limits.fileSize`, which aborts the stream
     * and often surfaces as 413, and `MaxFileSizeValidator`, which is a 400. Either is a
     * pass; a 201 is not.
     */
    expect([400, 413], `got ${res.status()}`).toContain(res.status());
  });

  test('API-UPL-S-03 HTML disguised as an image is rejected', async ({ api }) => {
    const res = await api.postMultipart(apiPaths.uploads.create(FOLDER), {
      file: upload('payload.html', 'text/html', HTML_DISGUISED),
    });
    expect(res.status()).toBe(400);
  });

  test('API-UPL-N-01 a request with no file is rejected', async ({ api }) => {
    const res = await api.postMultipart(apiPaths.uploads.create(FOLDER), {});
    expect(res.status()).toBe(400);
  });

  test('API-UPL-N-02 the wrong multipart field name is rejected', async ({ api }) => {
    /** `FileInterceptor('file')` — anything else is simply not seen. */
    const res = await api.postMultipart(apiPaths.uploads.create(FOLDER), {
      image: upload('e2e.png', 'image/png', PNG_1X1),
    });
    expect(res.status()).toBe(400);
  });

  test('API-UPL-S-04 path traversal in ?folder= cannot escape the uploads directory', async ({ api }) => {
    /**
     * `safeFolder()` sanitises the folder name. The property under test is that the
     * returned URL stays under `/uploads/` — a traversal that escaped it would let an
     * admin write to arbitrary paths on the server filesystem.
     */
    for (const folder of payloads.pathTraversal) {
      const res = await api.postMultipart(apiPaths.uploads.create(folder), {
        file: upload('e2e.png', 'image/png', PNG_1X1),
      });

      if (res.status() === 201) {
        const { url } = await res.json();
        expect(String(url), `"${folder}" must not escape /uploads`).not.toMatch(/\.\.|\/etc\/|^\/absolute/);
        expect(String(url)).toContain('/uploads/');
      } else {
        expect([400, 404], `"${folder}" was neither sanitised nor cleanly rejected`).toContain(res.status());
      }
    }
  });
});

test.describe('API uploads - served file hardening', () => {
  test('API-UPL-S-05 served uploads carry nosniff and a locked-down CSP', async ({ api }) => {
    const res = await api.postMultipart(apiPaths.uploads.create(FOLDER), {
      file: upload('headers.png', 'image/png', PNG_1X1),
    });
    test.skip(res.status() !== 201, 'the upload failed, so there is nothing to fetch');

    const { url } = await res.json();
    const fetched = await api.fetchAbsolute(url);
    const headers = fetched.headers();

    /**
     * `main.ts` sets both on the static handler: `nosniff` stops the browser
     * MIME-sniffing an upload into an executable type, and the sandbox CSP neuters any
     * script that does somehow end up inside the file.
     *
     * If this fails while `src/main.ts` clearly sets them, the server is running a stale
     * build — SEC-00 in tests/security/build-freshness.security.spec.ts gates that so it
     * reports as a stale deploy rather than as a mysterious header failure.
     */
    expect(headers['x-content-type-options'], 'uploads must be served with nosniff').toBe('nosniff');
    expect(headers['content-security-policy'], 'uploads must be served under a sandbox CSP').toContain(
      "default-src 'none'",
    );
  });
});

test.describe('API uploads - listing and deletion', () => {
  test('API-UPL-P-05 lists and deletes a MediaAsset record', async ({ api }) => {
    const created = await api.postMultipart(apiPaths.uploads.create(FOLDER), {
      file: upload('listed.png', 'image/png', PNG_1X1),
    });
    test.skip(created.status() !== 201, 'the upload failed, so there is nothing to list');
    const asset = await created.json();

    const list = await api.json<{ id: string }[]>(`${apiPaths.uploads.list}?folder=${FOLDER}`);
    expect(list.some((a) => a.id === asset.id), 'the asset must appear in its folder listing').toBe(true);

    const deleted = await api.delete(apiPaths.uploads.one(asset.id));
    expect(deleted.ok()).toBeTruthy();
  });
});

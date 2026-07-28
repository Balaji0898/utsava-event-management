import { expect, type Locator, type Page } from '@playwright/test';
import { messages } from '@data/test-data';

/**
 * `LocationInput` (`shared/ui/location-input.tsx`) — used on the home hero, the
 * booking form and the admin vendor form.
 *
 * Mechanics:
 *  - typing debounces **350ms**, then queries `photon.komoot.io` for suggestions
 *    (stubbed centrally by `src/fixtures/network.ts`, so results are deterministic);
 *  - a geolocate button `aria-label="Use my current location"` calls the browser
 *    geolocation API, reverse-geocodes via photon/nominatim, and on the HOME page
 *    bypasses the form entirely with `router.push('/vendors?lat=..&lng=..')`;
 *  - permission-denied and unavailable render distinct messages;
 *  - on the vendor form it also fires `onResolveCity`, which auto-appends the
 *    resolved city to "Available cities" — a side effect worth asserting.
 *
 * The geolocation specs must grant the permission and set a position on the
 * context; `src/fixtures/test.ts` exposes a helper for that rather than leaving each
 * spec to remember.
 */
export class LocationInputComponent {
  constructor(
    private readonly page: Page,
    private readonly input: Locator,
  ) {}

  get field(): Locator {
    return this.input;
  }

  get geolocateButton(): Locator {
    return this.page.getByRole('button', { name: messages.location.useMy });
  }

  /** The suggestion dropdown, populated from the stubbed photon response. */
  get suggestions(): Locator {
    return this.page.getByRole('option');
  }

  suggestion(name: string | RegExp): Locator {
    return this.page.getByRole('option', { name });
  }

  /** Type and wait out the 350ms debounce plus the (stubbed) request. */
  async search(text: string): Promise<void> {
    await this.input.fill(text);
    await this.page.waitForTimeout(500);
  }

  async pickSuggestion(name: string | RegExp): Promise<void> {
    await this.search(typeof name === 'string' ? name.slice(0, 4) : 'Beng');
    await this.suggestion(name).first().click();
  }

  async useMyLocation(): Promise<void> {
    await this.geolocateButton.click();
  }

  async expectValue(value: string | RegExp): Promise<void> {
    await expect(this.input).toHaveValue(value);
  }

  async expectPermissionDenied(): Promise<void> {
    await expect(this.page.getByText(messages.location.denied)).toBeVisible({ timeout: 20_000 });
  }

  async expectUnavailable(): Promise<void> {
    await expect(this.page.getByText(messages.location.unavailable)).toBeVisible({ timeout: 20_000 });
  }
}

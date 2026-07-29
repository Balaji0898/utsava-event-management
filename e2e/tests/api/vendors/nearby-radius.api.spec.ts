import { test, expect } from '@fixtures/test';
import { apiPaths } from '@config/urls';
import { nearbyRadiusKm } from '@config/source-constants';

type VendorList = { data: { id: string; name: string }[]; total: number };

/**
 * API-VEND-R — the "near me" default radius.
 *
 * The radius is declared twice, because the frontend and backend are separate
 * deployables with no shared package: `NEARBY_RADIUS_KM` in
 * `frontend/src/shared/config/site.ts` and `DEFAULT_NEARBY_RADIUS_KM` in
 * `backend/src/vendors/vendors.service.ts`. They started out disagreeing (200 vs
 * 50), which meant a caller who omitted `radius` silently searched a quarter of
 * the area the site itself searches.
 *
 * Nothing at runtime ties the two together, so the sync is asserted here rather
 * than trusted to the comment on each constant:
 *  - R-01 compares the two declarations directly, and fails the moment one side
 *    is edited alone;
 *  - R-02 proves the number the backend declares is the one the API actually
 *    applies, using the FRONTEND constant as the source of truth so a backend
 *    drift fails this test too.
 *
 * Note that R-02 has to create its own fixtures: `backend/prisma/seed.ts` sets no
 * latitude/longitude at all, so on a freshly seeded database no vendor qualifies
 * for the geo branch and every radius would return the same empty list — a test
 * built on seeded data alone would pass no matter what the constants said.
 */

/** Kilometres per degree of latitude, for the R = 6371 km the backend's Haversine uses. */
const KM_PER_DEG_LAT = (Math.PI * 6371) / 180;

/**
 * A latitude exactly `km` due north of `lat`. Holding longitude constant makes the
 * Haversine reduce to `R · Δlat`, so the distance is exact rather than approximate.
 */
function northOf(lat: number, km: number): number {
  return lat + km / KM_PER_DEG_LAT;
}

test.describe('API vendors - nearby radius', () => {
  test('API-VEND-R-01 the frontend and backend radii are the same number', () => {
    const frontend = nearbyRadiusKm.frontend();
    const backend = nearbyRadiusKm.backend();

    expect(
      backend,
      `NEARBY_RADIUS_KM (frontend/src/shared/config/site.ts) is ${frontend} km but ` +
        `DEFAULT_NEARBY_RADIUS_KM (backend/src/vendors/vendors.service.ts) is ${backend} km. ` +
        'While they disagree, a caller that omits ?radius= sees a different area than the ' +
        'site searches. Change both, or drop the duplication behind a shared package.',
    ).toBe(frontend);
  });

  test('API-VEND-R-02 a query with no ?radius= applies that radius @mutates', async ({
    anonApi,
    factory,
  }) => {
    /**
     * Deliberately the frontend value: this asserts the API behaves the way the
     * site assumes, so it fails if the backend constant drifts away.
     */
    const radius = nearbyRadiusKm.frontend();

    // Bengaluru, matching the factory's default `location`.
    const originLat = 12.9716;
    const originLng = 77.5946;

    // Both offsets are derived from the radius, so this spec never becomes one
    // more place the number is written down.
    const insideKm = radius * 0.75;
    const outsideKm = radius * 1.5;

    const inside = await factory.createVendor({
      name: factory.name('NearbyInside'),
      latitude: northOf(originLat, insideKm),
      longitude: originLng,
    });
    const outside = await factory.createVendor({
      name: factory.name('NearbyOutside'),
      latitude: northOf(originLat, outsideKm),
      longitude: originLng,
    });

    /** No `radius`, so the backend falls back to its default. 100 is the server's cap. */
    const body = await anonApi.json<VendorList>(
      `${apiPaths.vendors.list}?lat=${originLat}&lng=${originLng}&limit=100`,
    );
    const ids = body.data.map((v) => v.id);

    expect(
      ids,
      `a vendor ${Math.round(insideKm)} km away must fall inside the ${radius} km default`,
    ).toContain(inside.id);

    expect(
      ids,
      `a vendor ${Math.round(outsideKm)} km away must fall outside the ${radius} km default`,
    ).not.toContain(outside.id);
  });
});

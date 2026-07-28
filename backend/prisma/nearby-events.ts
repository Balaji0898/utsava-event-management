import { PrismaClient, PriceUnit } from '@prisma/client';

/**
 * Idempotent seeding for a handful of Andhra Pradesh events that carry real
 * latitude/longitude, so the "near me" proximity search (Haversine within a
 * radius) has data to return. Safe to run repeatedly — the department and
 * categories upsert by slug; vendors are skipped if their slug already exists.
 *
 *   npm run seed:nearby
 */

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const img = (id: string, w = 1200) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

const NEARBY_EVENTS = [
  {
    name: 'Krishna Riverside Weddings',
    category: 'Riverside Weddings',
    lat: 16.508191647328296,
    lng: 80.64492532308385,
    city: 'Vijayawada',
    priceFrom: 85000,
    priceTo: 320000,
    description:
      'Grand riverside mandaps on the banks of the Krishna at Vijayawada — traditional Telugu weddings with open-air pavilions and evening aarti.',
    banner: '1519167758481-83f550bb49b3',
    gallery: ['1519167758481-83f550bb49b3', '1470162656305-6f429ba817bf', '1478146059778-26028b07395a'],
  },
  {
    name: 'Guntur Grand Celebrations',
    category: 'Banquet Events',
    lat: 16.30637364431197,
    lng: 80.43838590671879,
    city: 'Guntur',
    priceFrom: 60000,
    priceTo: 240000,
    description:
      'Spacious banquet halls and lawns in Guntur for receptions, sangeets and corporate functions with full catering and décor.',
    banner: '1492684223066-81342ee5ff30',
    gallery: ['1492684223066-81342ee5ff30', '1516280440614-37939bbacd81', '1511795409834-ef04bbd61622'],
  },
  {
    name: 'Amaravati Heritage Venues',
    category: 'Heritage Venues',
    lat: 16.239027093025694,
    lng: 80.64450249508434,
    city: 'Mangalagiri',
    priceFrom: 95000,
    priceTo: 380000,
    description:
      'Heritage-styled venues near Amaravati and Mangalagiri, blending temple-town charm with modern amenities for weddings and festivities.',
    banner: '1470162656305-6f429ba817bf',
    gallery: ['1470162656305-6f429ba817bf', '1519741497674-611481863552', '1519167758481-83f550bb49b3'],
  },
  {
    name: 'Repalle Coastal Functions',
    category: 'Open-Air Events',
    lat: 16.01795702125633,
    lng: 80.8304990027005,
    city: 'Repalle',
    priceFrom: 45000,
    priceTo: 170000,
    description:
      'Open-air and coastal-style venues around Repalle for intimate weddings, haldi ceremonies and community celebrations.',
    banner: '1478146059778-26028b07395a',
    gallery: ['1478146059778-26028b07395a', '1470162656305-6f429ba817bf', '1516280440614-37939bbacd81'],
  },
];

const CATEGORY_NAMES = ['Riverside Weddings', 'Banquet Events', 'Heritage Venues', 'Open-Air Events'];

export async function seedNearbyEvents(prisma: PrismaClient) {
  const dept = await prisma.department.upsert({
    where: { slug: 'local-celebrations' },
    update: {
      icon: '📍',
      banner: img('1519167758481-83f550bb49b3'),
      description: 'Nearby weddings and celebrations across the Krishna–Guntur region.',
    },
    create: {
      name: 'Local Celebrations',
      slug: 'local-celebrations',
      description: 'Nearby weddings and celebrations across the Krishna–Guntur region.',
      icon: '📍',
      banner: img('1519167758481-83f550bb49b3'),
      sortOrder: 7,
    },
  });

  const categories: Record<string, string> = {};
  for (const [i, name] of CATEGORY_NAMES.entries()) {
    const cat = await prisma.category.upsert({
      where: { departmentId_slug: { departmentId: dept.id, slug: slugify(name) } },
      update: {},
      create: {
        name,
        slug: slugify(name),
        image: img(NEARBY_EVENTS[i]?.banner ?? '1519167758481-83f550bb49b3', 600),
        departmentId: dept.id,
        sortOrder: i,
      },
    });
    categories[name] = cat.id;
  }

  for (const [i, e] of NEARBY_EVENTS.entries()) {
    const slug = slugify(e.name);
    const existing = await prisma.vendor.findUnique({ where: { slug } });
    if (existing) {
      // Backfill coordinates on re-run in case the vendor predates lat/lng.
      await prisma.vendor.update({
        where: { slug },
        data: { latitude: e.lat, longitude: e.lng },
      });
      continue;
    }

    const vendor = await prisma.vendor.create({
      data: {
        name: e.name,
        slug,
        description: e.description,
        logo: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(e.name)}`,
        coverImage: img(e.banner),
        gallery: e.gallery.map((g) => img(g, 900)),
        experience: 5 + i,
        location: e.city,
        latitude: e.lat,
        longitude: e.lng,
        availableCities: [e.city],
        rating: 4.6,
        reviewCount: 12 + i * 3,
        contactNumber: '+91 98765 43210',
        whatsapp: '+91 98765 43210',
        email: `hello@${slug}.com`,
        priceFrom: e.priceFrom,
        priceTo: e.priceTo,
        featured: i === 0,
        trending: i % 2 === 0,
        verified: true,
        departmentId: dept.id,
        packages: {
          create: [
            {
              name: 'Essentials',
              price: e.priceFrom,
              sortOrder: 0,
              features: ['Venue access (6 hrs)', 'Basic seating', 'Ambient lighting'],
            },
            {
              name: 'Signature',
              price: Math.round((e.priceFrom + e.priceTo) / 2),
              popular: true,
              sortOrder: 1,
              features: ['Full-day access', 'Décor & stage', 'Lighting & sound', 'Guest lounge'],
            },
            {
              name: 'Grand',
              price: e.priceTo,
              sortOrder: 2,
              features: ['Full-day access', 'Premium décor', 'Catering coordination', 'Valet parking'],
            },
          ],
        },
      },
    });

    await prisma.item.create({
      data: {
        name: `${e.name} — Venue Booking`,
        description: `Venue in ${e.city}. ${e.category}.`,
        images: e.gallery.map((g) => img(g, 800)),
        minPrice: e.priceFrom,
        maxPrice: e.priceTo,
        priceUnit: PriceUnit.PER_DAY,
        departmentId: dept.id,
        categoryId: categories[e.category] ?? categories[CATEGORY_NAMES[0]],
        vendorId: vendor.id,
      },
    });

    await prisma.review.create({
      data: {
        vendorId: vendor.id,
        rating: 5,
        authorName: 'Event Host',
        comment: 'Wonderful local venue — beautifully arranged and close to home!',
      },
    });
  }

  return dept;
}

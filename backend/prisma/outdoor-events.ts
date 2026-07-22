import { PrismaClient, PriceUnit } from '@prisma/client';

/**
 * Idempotent seeding for the "Outdoor Events" department. Safe to run repeatedly
 * (department + categories upsert by slug; vendors are skipped if their slug
 * already exists), so it can be applied to an already-populated production DB
 * without duplicating data — unlike the main seed's `vendor.create` calls.
 */

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const img = (id: string, w = 1200) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

const OUTDOOR_EVENTS = [
  {
    name: 'Serene Garden Weddings',
    category: 'Garden Weddings',
    priceFrom: 90000,
    priceTo: 350000,
    location: 'Bengaluru',
    description:
      'Lush landscaped gardens with fairy-lit canopies and open-air mandaps — a dreamy setting for daytime and sunset weddings.',
    banner: '1470162656305-6f429ba817bf',
    gallery: ['1470162656305-6f429ba817bf', '1519167758481-83f550bb49b3', '1478146059778-26028b07395a'],
  },
  {
    name: 'Azure Beachside Events',
    category: 'Beach Events',
    priceFrom: 120000,
    priceTo: 500000,
    location: 'Goa',
    description:
      'Beachfront celebrations with sunset ceremonies, cabana lounges and bonfire after-parties by the shore.',
    banner: '1519741497674-611481863552',
    gallery: ['1519741497674-611481863552', '1511795409834-ef04bbd61622', '1470162656305-6f429ba817bf'],
  },
  {
    name: 'Skyline Rooftop Celebrations',
    category: 'Rooftop Parties',
    priceFrom: 70000,
    priceTo: 260000,
    location: 'Hyderabad',
    description:
      'Chic rooftop terraces with city skyline views, ambient lighting and lounge seating — ideal for cocktail evenings and receptions.',
    banner: '1492684223066-81342ee5ff30',
    gallery: ['1492684223066-81342ee5ff30', '1516280440614-37939bbacd81', '1511795409834-ef04bbd61622'],
  },
  {
    name: 'Meadow Open-Air Venues',
    category: 'Garden Weddings',
    priceFrom: 60000,
    priceTo: 200000,
    location: 'Chennai',
    description:
      'Sprawling open meadows for tent weddings, sangeets and corporate offsites, with flexible layouts and marquee options.',
    banner: '1478146059778-26028b07395a',
    gallery: ['1478146059778-26028b07395a', '1470162656305-6f429ba817bf', '1519167758481-83f550bb49b3'],
  },
];

const CATEGORY_NAMES = ['Garden Weddings', 'Beach Events', 'Rooftop Parties'];

export async function seedOutdoorEvents(prisma: PrismaClient) {
  const dept = await prisma.department.upsert({
    where: { slug: 'outdoor-events' },
    update: {
      icon: '🌿',
      banner: img('1470162656305-6f429ba817bf'),
      description: 'Gardens, beaches and rooftops for unforgettable open-air celebrations.',
    },
    create: {
      name: 'Outdoor Events',
      slug: 'outdoor-events',
      description: 'Gardens, beaches and rooftops for unforgettable open-air celebrations.',
      icon: '🌿',
      banner: img('1470162656305-6f429ba817bf'),
      sortOrder: 6,
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
        image: img(OUTDOOR_EVENTS[i]?.banner ?? '1470162656305-6f429ba817bf', 600),
        departmentId: dept.id,
        sortOrder: i,
      },
    });
    categories[name] = cat.id;
  }

  for (const [i, e] of OUTDOOR_EVENTS.entries()) {
    const slug = slugify(e.name);
    const existing = await prisma.vendor.findUnique({ where: { slug } });
    if (existing) continue; // idempotent — don't duplicate on re-run

    const vendor = await prisma.vendor.create({
      data: {
        name: e.name,
        slug,
        description: e.description,
        logo: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(e.name)}`,
        coverImage: img(e.banner),
        gallery: e.gallery.map((g) => img(g, 900)),
        experience: 6 + i,
        location: e.location,
        availableCities: [e.location],
        rating: 4.7,
        reviewCount: 15 + i * 4,
        contactNumber: '+91 98765 43210',
        whatsapp: '+91 98765 43210',
        email: `hello@${slug}.com`,
        priceFrom: e.priceFrom,
        priceTo: e.priceTo,
        // One "best event" (featured) for this category so it appears in the
        // home Best Events slider; enforcement keeps it one-per-category.
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
              features: ['Full-day access', 'Premium décor', 'Catering coordination', 'Valet parking', 'Backup power'],
            },
          ],
        },
      },
    });

    await prisma.item.create({
      data: {
        name: `${e.name} — Venue Booking`,
        description: `Open-air venue in ${e.location}. ${e.category}.`,
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
        comment: 'Breathtaking outdoor setting — everything was beautifully arranged!',
      },
    });
  }

  return dept;
}

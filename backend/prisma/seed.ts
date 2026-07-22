import { PrismaClient, Role, PriceUnit, CmsBlockType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { seedOutdoorEvents } from './outdoor-events';

const prisma = new PrismaClient();

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const img = (id: string, w = 1200) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

// Curated placeholder imagery per department (replace with your own later).
const DEPARTMENTS = [
  {
    name: 'Photography',
    icon: '📸',
    desc: 'Capture your moments in style.',
    banner: '1519741497674-611481863552',
    gallery: ['1519741497674-611481863552', '1511285560929-80b456fea0bc', '1606216794074-735e91aa2c92'],
  },
  {
    name: 'Catering',
    icon: '🍽️',
    desc: 'Delicious food for every occasion.',
    banner: '1414235077428-338989a2e8c0',
    gallery: ['1414235077428-338989a2e8c0', '1555939594-58d7cb561ad1', '1467003909585-2f8a72700288'],
  },
  {
    name: 'Decoration',
    icon: '🎈',
    desc: 'Stunning décor and stage setups.',
    banner: '1519167758481-83f550bb49b3',
    gallery: ['1519167758481-83f550bb49b3', '1478146059778-26028b07395a', '1470162656305-6f429ba817bf'],
  },
  {
    name: 'Lighting',
    icon: '💡',
    desc: 'Ambient and event lighting.',
    banner: '1492684223066-81342ee5ff30',
    gallery: ['1492684223066-81342ee5ff30', '1516450360452-9312f5e86fc7', '1533174072545-7a4b6ad7a6c3'],
  },
  {
    name: 'Entertainment',
    icon: '🎤',
    desc: 'DJs, artists and live shows.',
    banner: '1470229722913-7c0e2dbbafd3',
    gallery: ['1470229722913-7c0e2dbbafd3', '1493225457124-a3eb161ffa5f', '1516280440614-37939bbacd81'],
  },
];

// Dedicated seeding for Function Halls — a service where each vendor is a
// venue with a capacity and a per-day price range.
const FUNCTION_HALLS = [
  {
    name: 'Grand Palace Convention',
    capacity: 800,
    priceFrom: 150000,
    priceTo: 600000,
    location: 'Bengaluru',
    description:
      'A luxurious 800-guest air-conditioned convention centre with valet parking for 200 cars, in-house catering and a grand stage.',
    banner: '1464366400600-7168b8af9bc3',
    gallery: ['1464366400600-7168b8af9bc3', '1519167758481-83f550bb49b3', '1478146059778-26028b07395a'],
  },
  {
    name: 'Royal Gardens Banquet & Lawns',
    capacity: 400,
    priceFrom: 80000,
    priceTo: 300000,
    location: 'Hyderabad',
    description:
      'Elegant indoor banquet paired with a sprawling open-air lawn — perfect for weddings and receptions up to 400 guests.',
    banner: '1470162656305-6f429ba817bf',
    gallery: ['1470162656305-6f429ba817bf', '1511795409834-ef04bbd61622', '1478146059778-26028b07395a'],
  },
  {
    name: 'Lotus Community Hall',
    capacity: 200,
    priceFrom: 40000,
    priceTo: 120000,
    location: 'Chennai',
    description:
      'A budget-friendly, well-maintained hall for 200 guests, ideal for birthdays, engagements and family functions.',
    banner: '1478146059778-26028b07395a',
    gallery: ['1478146059778-26028b07395a', '1519167758481-83f550bb49b3', '1464366400600-7168b8af9bc3'],
  },
  {
    name: 'Emerald Hall & Lawns',
    capacity: 1000,
    priceFrom: 200000,
    priceTo: 800000,
    location: 'Bengaluru',
    description:
      'Our flagship luxury venue: 1000-guest capacity, dual banquet halls, landscaped lawns, bridal suites and premium lighting.',
    banner: '1511795409834-ef04bbd61622',
    gallery: ['1511795409834-ef04bbd61622', '1464366400600-7168b8af9bc3', '1470162656305-6f429ba817bf'],
  },
];

async function seedFunctionHalls() {
  const dept = await prisma.department.upsert({
    where: { slug: 'function-halls' },
    update: { banner: img('1464366400600-7168b8af9bc3') },
    create: {
      name: 'Function Halls',
      slug: 'function-halls',
      description: 'Banquet halls, convention centres and lawns for every occasion.',
      icon: '🏛️',
      banner: img('1464366400600-7168b8af9bc3'),
      sortOrder: 5,
    },
  });

  // Categories under Function Halls
  const categories: Record<string, string> = {};
  for (const [i, name] of ['Banquet Halls', 'Convention Centres', 'Lawns & Gardens'].entries()) {
    const cat = await prisma.category.upsert({
      where: { departmentId_slug: { departmentId: dept.id, slug: slugify(name) } },
      update: {},
      create: { name, slug: slugify(name), departmentId: dept.id, sortOrder: i },
    });
    categories[name] = cat.id;
  }
  const bookOne = categories['Banquet Halls'];

  for (const [i, h] of FUNCTION_HALLS.entries()) {
    const vendor = await prisma.vendor.create({
      data: {
        name: h.name,
        slug: slugify(h.name),
        description: `${h.description} Capacity: ${h.capacity} guests.`,
        logo: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(h.name)}`,
        coverImage: img(h.banner),
        gallery: h.gallery.map((g) => img(g, 900)),
        experience: 8 + i,
        location: h.location,
        availableCities: [h.location],
        rating: 4.6,
        reviewCount: 20 + i * 5,
        contactNumber: '+91 98765 43210',
        whatsapp: '+91 98765 43210',
        email: `bookings@${slugify(h.name)}.com`,
        priceFrom: h.priceFrom,
        priceTo: h.priceTo,
        featured: i < 2,
        trending: i % 2 === 0,
        verified: true,
        departmentId: dept.id,
        packages: {
          create: [
            {
              name: 'Half Day (6 hrs)',
              price: h.priceFrom,
              sortOrder: 0,
              features: [`Up to ${h.capacity} guests`, 'Air conditioning', 'Parking', 'Basic decor'],
            },
            {
              name: 'Full Day (12 hrs)',
              price: Math.round((h.priceFrom + h.priceTo) / 2),
              popular: true,
              sortOrder: 1,
              features: [`Up to ${h.capacity} guests`, 'AC + Power backup', 'Valet parking', 'Stage + lighting'],
            },
            {
              name: 'Wedding Package',
              price: h.priceTo,
              sortOrder: 2,
              features: [`Up to ${h.capacity} guests`, 'Full-day access', 'In-house catering', 'Bridal suite', 'Premium decor'],
            },
          ],
        },
      },
    });

    // An item representing the venue rental with its price range (per day)
    await prisma.item.create({
      data: {
        name: `${h.name} — Venue Rental`,
        description: `Per-day venue rental. Seating capacity ${h.capacity} guests.`,
        images: h.gallery.map((g) => img(g, 800)),
        minPrice: h.priceFrom,
        maxPrice: h.priceTo,
        priceUnit: PriceUnit.PER_DAY,
        departmentId: dept.id,
        categoryId: bookOne,
        vendorId: vendor.id,
      },
    });

    await prisma.review.create({
      data: {
        vendorId: vendor.id,
        rating: 5,
        authorName: 'Event Host',
        comment: 'Spacious, well-managed venue. Our guests loved it!',
      },
    });
  }
}

async function main() {
  // ---- Super admin ----
  const passwordHash = await bcrypt.hash('Admin@123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@elite.events' },
    update: {},
    create: {
      name: 'Super Admin',
      email: 'admin@elite.events',
      passwordHash,
      role: Role.SUPER_ADMIN,
    },
  });

  for (const [i, d] of DEPARTMENTS.entries()) {
    const dept = await prisma.department.upsert({
      where: { slug: slugify(d.name) },
      update: { banner: img(d.banner) },
      create: {
        name: d.name,
        slug: slugify(d.name),
        description: d.desc,
        icon: d.icon,
        banner: img(d.banner),
        sortOrder: i,
      },
    });

    const category = await prisma.category.upsert({
      where: { departmentId_slug: { departmentId: dept.id, slug: 'featured' } },
      update: {},
      create: {
        name: 'Featured',
        slug: 'featured',
        image: img(d.gallery[0], 600),
        departmentId: dept.id,
        sortOrder: 0,
      },
    });

    await prisma.item.create({
      data: {
        name: `${d.name} — Signature`,
        description: `Signature ${d.name.toLowerCase()} offering.`,
        images: d.gallery.map((g) => img(g, 800)),
        minPrice: 25000,
        maxPrice: 120000,
        priceUnit: PriceUnit.FIXED,
        departmentId: dept.id,
        categoryId: category.id,
      },
    });

    const vendor = await prisma.vendor.create({
      data: {
        name: `${d.name} Studio ${i + 1}`,
        slug: `${slugify(d.name)}-studio-${i + 1}`,
        description: `Award-winning ${d.name.toLowerCase()} team with a passion for perfection.`,
        logo: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(d.name)}`,
        coverImage: img(d.banner),
        gallery: d.gallery.map((g) => img(g, 900)),
        experience: 5 + i,
        location: 'Bengaluru',
        availableCities: ['Bengaluru', 'Chennai', 'Hyderabad'],
        rating: 4.5,
        reviewCount: 32,
        contactNumber: '+91 98765 43210',
        whatsapp: '+91 98765 43210',
        email: `hello@${slugify(d.name)}studio.com`,
        priceFrom: 25000,
        priceTo: 120000,
        featured: i < 3,
        trending: i % 2 === 0,
        verified: true,
        departmentId: dept.id,
        packages: {
          create: [
            {
              name: 'Basic',
              price: 25000,
              sortOrder: 0,
              features: ['1 Professional', '100 Deliverables', '4 Hours'],
            },
            {
              name: 'Premium',
              price: 60000,
              popular: true,
              sortOrder: 1,
              features: ['2 Professionals', 'Add-ons included', 'Full Day'],
            },
            {
              name: 'Luxury',
              price: 120000,
              sortOrder: 2,
              features: ['Team of experts', 'All premium add-ons', 'Unlimited deliverables'],
            },
          ],
        },
      },
    });

    await prisma.review.create({
      data: {
        vendorId: vendor.id,
        rating: 5,
        authorName: 'Happy Customer',
        comment: 'Fantastic experience, highly recommended!',
      },
    });
  }

  // ---- Function Halls (venues with capacity + price range) ----
  await seedFunctionHalls();

  // ---- Outdoor Events (gardens, beaches, rooftops) ----
  await seedOutdoorEvents(prisma);

  // ---- CMS: hero + about blocks ----
  await prisma.cmsBlock.upsert({
    where: { key: 'home-hero' },
    update: {},
    create: {
      key: 'home-hero',
      type: CmsBlockType.BANNER,
      title: 'Plan unforgettable events, effortlessly.',
      subtitle:
        'Discover verified photographers, caterers, decorators, lighting and entertainment vendors.',
      image: img('1511795409834-ef04bbd61622'),
      link: '/book',
      sortOrder: 0,
    },
  });

  const contactData = {
    manager: 'Balaji Guggilam',
    role: 'Event Manager & Owner',
    phone: '8790233572',
    phoneDisplay: '+91 87902 33572',
    whatsapp: '918790233572',
    email: 'hello@utsava.events',
  };
  await prisma.cmsBlock.upsert({
    where: { key: 'site-contact' },
    update: { data: contactData },
    create: {
      key: 'site-contact',
      type: CmsBlockType.SECTION,
      title: 'Contact',
      data: contactData,
    },
  });

  // ---- Home stats ("trusted users" counters) ----
  await prisma.cmsBlock.upsert({
    where: { key: 'home-stats' },
    update: {},
    create: {
      key: 'home-stats',
      type: CmsBlockType.SECTION,
      title: 'Home stats',
      data: {
        items: [
          { label: 'Events Delivered', value: 5200, suffix: '+' },
          { label: 'Verified Vendors', value: 480, suffix: '+' },
          { label: 'Cities', value: 32, suffix: '' },
          { label: 'Happy Customers', value: 12000, suffix: '+' },
        ],
      },
    },
  });

  await prisma.cmsBlock.upsert({
    where: { key: 'about-main' },
    update: {},
    create: {
      key: 'about-main',
      type: CmsBlockType.ABOUT,
      title: 'About Elite Events',
      content:
        'We connect you with the finest event professionals across the country — vetted, verified and ready to make your day special.',
      image: img('1464366400600-7168b8af9bc3'),
    },
  });

  // ---- Testimonials ----
  const testimonials = [
    { name: 'Ananya Rao', role: 'Bride', message: 'Our wedding was flawless. Every vendor was a delight to work with!', img: 5 },
    { name: 'Vikram Shetty', role: 'Corporate Lead', message: 'Booked catering and lighting for our gala — seamless and professional.', img: 12 },
    { name: 'Priya Nair', role: 'Event Planner', message: 'The best platform to find reliable vendors in minutes.', img: 32 },
    { name: 'Rahul Mehta', role: 'Groom', message: 'Transparent pricing and amazing packages. Highly recommend!', img: 45 },
  ];
  for (const [i, t] of testimonials.entries()) {
    await prisma.testimonial.create({
      data: {
        name: t.name,
        role: t.role,
        message: t.message,
        rating: 5,
        avatar: `https://i.pravatar.cc/150?img=${t.img}`,
        sortOrder: i,
        approved: true,
      },
    });
  }

  // ---- FAQs ----
  const faqs = [
    { q: 'How do I book a vendor?', a: 'Browse vendors or packages, then submit a booking request. Our team confirms the details with you.' },
    { q: 'Are the vendors verified?', a: 'Vendors marked with a shield badge are verified by our team for quality and reliability.' },
    { q: 'Can I customise a package?', a: 'Yes — mention your requirements in the booking form and the vendor will tailor a quote.' },
    { q: 'What areas do you cover?', a: 'We currently operate across 32+ cities, with new locations added regularly.' },
  ];
  for (const [i, f] of faqs.entries()) {
    await prisma.faq.create({
      data: { question: f.q, answer: f.a, sortOrder: i, category: 'General' },
    });
  }

  console.log('✅ Seed complete. Login: admin@elite.events / Admin@123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

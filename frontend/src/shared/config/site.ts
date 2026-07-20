/** Global site + contact configuration (single source of truth). */
export const site = {
  name: 'Utsava',
  tagline: 'Where Every Moment Becomes a Festival',
  contact: {
    manager: 'Balaji Guggilam',
    role: 'Event Manager & Owner',
    phone: '8790233572',
    phoneDisplay: '+91 87902 33572',
    whatsapp: '918790233572',
    email: 'hello@utsava.events',
  },
};

export const telHref = `tel:+91${site.contact.phone}`;
export const whatsappHref = `https://wa.me/${site.contact.whatsapp}?text=${encodeURIComponent(
  'Hi Utsava, I would like to plan an event.',
)}`;
export const mailHref = `mailto:${site.contact.email}`;

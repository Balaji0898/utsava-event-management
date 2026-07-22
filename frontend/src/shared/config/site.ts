/** Global site config + contact defaults (fallback when the CMS has no value). */
export type SiteContact = {
  manager: string;
  role: string;
  phone: string;
  phoneDisplay: string;
  whatsapp: string;
  email: string;
};

export const defaultContact: SiteContact = {
  manager: 'Balaji Guggilam',
  role: 'Event Manager & Owner',
  phone: '8790233572',
  phoneDisplay: '+91 87902 33572',
  whatsapp: '918790233572',
  email: 'hello@utsava.events',
};

export const site = {
  name: 'Utsava',
  tagline: 'Where Every Moment Becomes a Festival',
  contact: defaultContact,
};

// Contact values are now admin-editable, so these are helpers computed from the
// current contact rather than module-level constants.
export const telHref = (phone: string) => {
  const digits = (phone || '').replace(/\D/g, '');
  const withCc = digits.startsWith('91') ? digits : `91${digits}`;
  return `tel:+${withCc}`;
};

export const whatsappHref = (whatsapp: string) =>
  `https://wa.me/${(whatsapp || '').replace(/\D/g, '')}?text=${encodeURIComponent(
    'Hi Utsava, I would like to plan an event.',
  )}`;

export const mailHref = (email: string) => `mailto:${email}`;

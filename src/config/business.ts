// Single source of truth for business facts. Every page, the header, footer,
// bottom bar and structured data read from here — change a fact once.

export interface OrderLink {
  handle?: string;
  name: string;
  url: string;
}

export const business = {
  name: 'Rimal Seafood',
  nameAr: 'رمال',
  tagline: 'Lebanese & Egyptian seafood restaurant and fish market in Bay Ridge, Brooklyn',

  phone: {
    display: '(347) 497-4002',
    tel: '+13474974002',
    schema: '+1-347-497-4002',
  },

  address: {
    street: '7812 5th Ave',
    city: 'Brooklyn',
    region: 'NY',
    postalCode: '11209',
    country: 'US',
    neighborhood: 'Bay Ridge',
  },

  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=7812+5th+Ave,+Brooklyn,+NY+11209',
  // Building coordinates (OpenStreetMap, 7812 5th Avenue).
  geo: { latitude: 40.6270505, longitude: -74.0239395 },

  // Same hours every day. 24-hour "HH:MM"; display strings are derived below.
  hours: { opens: '12:00', closes: '21:00' },

  reservations: 'Walk-ins welcome, or call (347) 497-4002 to reserve.',

  // Shown in this order. order.online is Rimal's own storefront, so it comes first.
  orderLinks: [
    { name: 'Order Online', url: 'https://order.online/store/-52064701/' },
    { name: 'DoorDash', url: 'https://www.doordash.com/store/rimal-seafood-brooklyn-52064701/' },
    { name: 'Uber Eats', url: 'https://www.ubereats.com/store/rimal-seafood/8Glu_iK5QqyuJ0H2Ow9g-w' },
    { name: 'Grubhub', url: 'https://www.grubhub.com/restaurant/rimal-seafood-7812-5th-ave-brooklyn/15770144' },
    { name: 'Seamless', url: 'https://www.seamless.com/menu/rimal-seafood-7812-5th-ave-brooklyn/15770144' },
    { name: 'Postmates', url: 'https://www.postmates.com/store/rimal-seafood/8Glu_iK5QqyuJ0H2Ow9g-w' },
  ] satisfies OrderLink[],

  // Empty url = not shown. Fill in when confirmed.
  socials: [
    { name: 'Instagram', url: 'https://www.instagram.com/rimal_seafood/', handle: '@rimal_seafood' },
    { name: 'Facebook', url: '' },
  ] satisfies OrderLink[],
  googleReviewUrl: '',
} as const;

/** "21:00" -> "9 PM", "12:30" -> "12:30 PM" */
export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h < 12 ? 'AM' : 'PM';
  const hour = h % 12 || 12;
  return m ? `${hour}:${String(m).padStart(2, '0')} ${suffix}` : `${hour} ${suffix}`;
}

export const hoursText = `${formatTime(business.hours.opens)} – ${formatTime(business.hours.closes)}`;
/** Compact form for the top bar, e.g. "12–9 PM". */
export const hoursShort = `${formatTime(business.hours.opens).replace(/ (AM|PM)$/, '')}–${formatTime(business.hours.closes)}`;
export const addressLine = `${business.address.street}, ${business.address.city}, ${business.address.region} ${business.address.postalCode}`;
export const liveSocials = business.socials.filter((s) => s.url);

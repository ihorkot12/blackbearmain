import { SITE_URL, SITE_NAME, DEFAULT_OG_IMAGE } from '../components/SEO';

/**
 * Структуровані дані schema.org для локального пошуку:
 * дві зали клубу як SportsActivityLocation + організація.
 * Дані — адреси, телефони, години — ті самі, що на сторінці.
 */

const SHULIAVKA = {
  '@type': 'SportsActivityLocation',
  '@id': `${SITE_URL}/#shuliavka`,
  name: `${SITE_NAME} — карате Кіокушинкай, Шулявка`,
  url: `${SITE_URL}/`,
  image: DEFAULT_OG_IMAGE,
  telephone: '+380954756500',
  sport: 'Kyokushin Karate',
  priceRange: '2500 UAH / місяць',
  address: {
    '@type': 'PostalAddress',
    streetAddress: "вул. Сім'ї Бродських, 31/33",
    addressLocality: 'Київ',
    postalCode: '03057',
    addressCountry: 'UA'
  },
  openingHoursSpecification: [
    { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Wednesday', 'Friday'], opens: '17:00', closes: '21:00' },
    { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Tuesday', 'Thursday'], opens: '17:20', closes: '18:50' }
  ]
};

const NEKRASOVA = {
  '@type': 'SportsActivityLocation',
  '@id': `${SITE_URL}/#nekrasova`,
  name: `${SITE_NAME} — карате Кіокушинкай, Сирець`,
  url: `${SITE_URL}/`,
  image: DEFAULT_OG_IMAGE,
  telephone: '+380955680604',
  sport: 'Kyokushin Karate',
  priceRange: '2300 UAH / місяць',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'вул. Віктора Некрасова, 1-3',
    addressLocality: 'Київ',
    postalCode: '04136',
    addressCountry: 'UA'
  },
  openingHoursSpecification: [
    { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Wednesday', 'Friday'], opens: '17:30', closes: '20:30' }
  ]
};

export const ORGANIZATION = {
  '@type': 'SportsOrganization',
  '@id': `${SITE_URL}/#organization`,
  name: SITE_NAME,
  alternateName: 'Блек Бір Доджо — клуб карате Кіокушинкай, Київ',
  url: `${SITE_URL}/`,
  logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon-512.png`, width: 512, height: 512 },
  image: DEFAULT_OG_IMAGE,
  sport: 'Kyokushin Karate',
  telephone: '+380954756500',
  founder: { '@type': 'Person', name: 'Ігор Котляревський', jobTitle: 'Головний тренер, 3 дан Кіокушинкай, майстер спорту України' },
  location: [{ '@id': SHULIAVKA['@id'] }, { '@id': NEKRASOVA['@id'] }],
  sameAs: ['https://instagram.com/karate_kyiv', 'https://www.facebook.com/karatee.kyiv/']
};

/** Для сторінок, де тренує особисто Ігор — лише зал на Шулявці */
export const shuliavkaGraph = (extra: object[] = []) => ({
  '@context': 'https://schema.org',
  '@graph': [{ ...ORGANIZATION, location: [{ '@id': SHULIAVKA['@id'] }] }, SHULIAVKA, ...extra]
});

export const clubGraph = (extra: object[] = []) => ({
  '@context': 'https://schema.org',
  '@graph': [ORGANIZATION, SHULIAVKA, NEKRASOVA, ...extra]
});

export const faqPage = (items: { q: string; a: string }[]) => ({
  '@type': 'FAQPage',
  mainEntity: items.map(item => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: { '@type': 'Answer', text: item.a }
  }))
});

export const courseOffer = (opts: { name: string; description: string; url: string; ageRange: string }) => ({
  '@type': 'Course',
  name: opts.name,
  description: opts.description,
  url: opts.url,
  provider: { '@id': ORGANIZATION['@id'] },
  audience: { '@type': 'PeopleAudience', suggestedMinAge: opts.ageRange.split('-')[0], suggestedMaxAge: opts.ageRange.split('-')[1] || undefined },
  hasCourseInstance: {
    '@type': 'CourseInstance',
    courseMode: 'onsite',
    location: [{ '@id': SHULIAVKA['@id'] }, { '@id': NEKRASOVA['@id'] }]
  },
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'UAH', description: 'Перше тренування безкоштовне' }
});

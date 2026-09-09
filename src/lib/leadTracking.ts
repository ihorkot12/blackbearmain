import { track } from '@vercel/analytics';

const TRACKING_QUERY_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'fbclid'
] as const;

const getCookieValue = (name: string) => {
  if (typeof document === 'undefined') return '';
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|; )${escapedName}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
};

export const getTrackingData = (): Record<string, string> => {
  if (typeof window === 'undefined') return {};

  const params = new URLSearchParams(window.location.search);
  const tracking: Record<string, string> = {};

  TRACKING_QUERY_KEYS.forEach((key) => {
    const value = params.get(key);
    if (value) tracking[key] = value;
  });

  const firstLandingPage = sessionStorage.getItem('first_landing_page') || window.location.href;
  sessionStorage.setItem('first_landing_page', firstLandingPage);

  const fbp = getCookieValue('_fbp');
  const existingFbc = getCookieValue('_fbc');
  const fbclid = tracking.fbclid;

  if (fbp) tracking.fbp = fbp;
  if (existingFbc) {
    tracking.fbc = existingFbc;
  } else if (fbclid) {
    tracking.fbc = `fb.1.${Math.floor(Date.now() / 1000)}.${fbclid}`;
  }

  tracking.landing_page = firstLandingPage;
  tracking.page_url = window.location.href;
  if (document.referrer) tracking.referrer = document.referrer;

  return tracking;
};

export const createEventId = () =>
  `lead_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

/** Клік по будь-якому CTA «записатись» — намір, який видно в Meta ще до заявки. */
export const trackLeadIntent = (contentName: string, location: string) => {
  if (typeof window === 'undefined') return;
  try {
    track('lead_intent', { page: location, cta: contentName });
  } catch {
    /* ignore */
  }
  const fbq = (window as any).fbq;
  if (fbq) {
    fbq('trackCustom', 'LeadIntent', { content_name: contentName, location });
  }
};

export interface LeadPayload {
  name: string;
  phone: string;
  age_group?: string;
  location?: string;
  source: string;
}

/**
 * Єдина точка відправки заявки: POST /api/leads-public,
 * далі generate_lead (GA) і стандартна подія Lead (Meta) з тим самим event_id.
 */
export const submitLead = async (payload: LeadPayload): Promise<boolean> => {
  const eventId = createEventId();
  const trackingData = getTrackingData();

  const body = {
    name: payload.name,
    phone: payload.phone,
    age_group: payload.age_group || undefined,
    location: payload.location || undefined,
    event_id: eventId,
    source: payload.source,
    ...trackingData
  };

  const res = await fetch('/api/leads-public', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) return false;

  if (typeof window !== 'undefined') {
    const conversion = {
      value: 1.0,
      currency: 'UAH',
      source: payload.source,
      age_group: payload.age_group,
      location: payload.location,
      ...trackingData
    };

    try {
      track('lead', { source: payload.source, age_group: payload.age_group || '', location: payload.location || '' });
    } catch {
      /* ignore */
    }

    const gtag = (window as any).gtag;
    if (gtag) {
      gtag('event', 'generate_lead', { event_id: eventId, ...conversion });
    }

    const fbq = (window as any).fbq;
    if (fbq) {
      fbq('track', 'Lead', { content_name: 'Trial Lesson Signup', ...conversion }, { eventID: eventId });
    }
  }

  return true;
};

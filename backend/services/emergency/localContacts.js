// Local emergency-contact lookup by US zipcode.
//
// We deliberately use only free, keyless data:
//   - Zippopotam.us turns a zip into a real city + state (no API key needed).
//   - The contact list is built from genuinely nationwide hotlines plus 211,
//     which routes callers to LOCAL health & human services for their area.
//
// There is no free API that returns a directory of local relief charities with
// phone numbers, so we do NOT fabricate specific local organizations — we
// surface real numbers that actually work for the resolved location.

// Resolve a 5-digit US zipcode to its city/state using Zippopotam.us.
// Returns { zipcode, city, state, stateAbbreviation } or null if not found.
export async function resolveZip(zipcode) {
  const res = await fetch(`https://api.zippopotam.us/us/${zipcode}`);

  // Zippopotam.us returns 404 for a zip that doesn't exist.
  if (!res.ok) return null;

  const data = await res.json();
  const place = data.places?.[0];
  if (!place) return null;

  return {
    zipcode: data['post code'] || zipcode,
    city: place['place name'],
    state: place['state'],
    stateAbbreviation: place['state abbreviation'],
  };
}

// Build the emergency-contact list for a resolved location. The national lines
// are the same everywhere; 211 and the local note are personalized with the
// city/state so the help-seeker knows they reach services for THEIR area.
export function buildContacts(location) {
  const area = location ? `${location.city}, ${location.stateAbbreviation}` : 'your area';

  return [
    {
      label: 'Life-threatening emergency',
      value: '911',
      note: 'Police, fire, or medical — anywhere in the US',
    },
    {
      label: `Local help (211) — ${area}`,
      value: '211',
      note: 'Free 24/7 line that connects you to local food, shelter & assistance',
      local: true,
    },
    {
      label: 'Disaster Distress Helpline',
      value: '1-800-985-5990',
      note: '24/7 crisis counseling after a disaster',
    },
    {
      label: 'FEMA Helpline',
      value: '1-800-621-3362',
      note: 'Disaster assistance & claims',
    },
    {
      label: 'American Red Cross',
      value: '1-800-733-2767',
      note: 'Shelter & relief services',
    },
    {
      label: 'Poison Control',
      value: '1-800-222-1222',
      note: 'Poisoning or exposure',
    },
  ];
}

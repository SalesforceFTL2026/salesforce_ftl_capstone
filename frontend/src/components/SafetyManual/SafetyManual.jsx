import { useState } from 'react';
import api from '../../utils/api';

// A reference "manual" for help-seekers: who to call in an emergency, and
// what to do before / during / after common disasters. Content is static
// (no backend) and sourced from standard FEMA / Ready.gov / Red Cross guidance.

// National emergency contacts. Numbers are US-wide; local lines vary, so we
// leave a clearly-labeled placeholder for those.
const EMERGENCY_CONTACTS = [
  { label: 'Life-threatening emergency', value: '911', note: 'Police, fire, or medical' },
  { label: 'Disaster Distress Helpline', value: '1-800-985-5990', note: '24/7 crisis counseling' },
  { label: 'Poison Control', value: '1-800-222-1222', note: 'Poisoning or exposure' },
  { label: 'FEMA Helpline', value: '1-800-621-3362', note: 'Disaster assistance & claims' },
  { label: 'American Red Cross', value: '1-800-733-2767', note: 'Shelter & relief services' },
  { label: 'Local non-emergency', value: 'Add your local line', note: 'Police/utilities non-emergency', placeholder: true },
];

// Before / during / after steps for each disaster type. Kept concise and
// action-oriented so it reads like a checklist.
const DISASTER_GUIDES = [
  {
    id: 'hurricane',
    title: 'Hurricane & Flood',
    icon: '🌀',
    before: [
      'Know your evacuation zone and route.',
      'Build a kit: 3 days of water (1 gal/person/day), non-perishable food, meds, flashlight, batteries.',
      'Keep documents (ID, insurance, medical) in a waterproof bag.',
      'Charge phones and backup batteries; fill your car with gas.',
    ],
    during: [
      'Evacuate immediately if told to. Never drive through flood water — “Turn Around, Don’t Drown.”',
      'Move to the highest level of the building; avoid basements.',
      'Stay away from windows; shelter in an interior room.',
      'Listen to local officials on a battery or hand-crank radio.',
    ],
    after: [
      'Return home only when authorities say it’s safe.',
      'Avoid standing water — it may be electrically charged or contaminated.',
      'Photograph damage for insurance before cleaning up.',
      'Check on neighbors, especially older adults and people with disabilities.',
    ],
  },
  {
    id: 'wildfire',
    title: 'Wildfire',
    icon: '🔥',
    before: [
      'Clear leaves, brush, and debris within 30 ft of your home.',
      'Pack a go-bag and keep it by the door.',
      'Sign up for local emergency alerts.',
      'Plan two escape routes out of your neighborhood.',
    ],
    during: [
      'Leave early — don’t wait for an evacuation order if you feel unsafe.',
      'Wear an N95 mask; close all windows and doors before leaving.',
      'If trapped, call 911 and shelter in a cleared area away from vegetation.',
      'Keep headlights on; drive slowly through smoke.',
    ],
    after: [
      'Wait for the “all clear” before returning.',
      'Watch for hot spots, ash pits, and downed power lines.',
      'Wear gloves and a mask during cleanup; ash can be toxic.',
      'Document losses for insurance and FEMA claims.',
    ],
  },
  {
    id: 'earthquake',
    title: 'Earthquake',
    icon: '🌎',
    before: [
      'Secure heavy furniture, water heaters, and shelves to walls.',
      'Identify safe spots: under sturdy tables, against interior walls.',
      'Keep sturdy shoes and a flashlight by your bed.',
      'Store an emergency kit and know how to shut off gas and water.',
    ],
    during: [
      'Drop, Cover, and Hold On — get under sturdy furniture.',
      'Stay indoors until shaking stops; don’t run outside.',
      'If outdoors, move to an open area away from buildings and wires.',
      'If driving, pull over away from overpasses and stop.',
    ],
    after: [
      'Expect aftershocks; Drop, Cover, and Hold On again if they come.',
      'Check for injuries and gas leaks — leave if you smell gas.',
      'Use texts, not calls, to keep phone lines open.',
      'Inspect your home for damage before re-entering.',
    ],
  },
  {
    id: 'tornado',
    title: 'Tornado',
    icon: '🌪️',
    before: [
      'Know the difference: a Watch means possible; a Warning means take shelter now.',
      'Identify a safe room — basement or an interior room on the lowest floor.',
      'Keep a helmet or heavy blankets to protect your head.',
      'Enable Wireless Emergency Alerts on your phone.',
    ],
    during: [
      'Go to your safe room immediately; put as many walls between you and outside as possible.',
      'Cover your head and neck; crouch low.',
      'Avoid windows, doors, and outside walls.',
      'If in a mobile home or car, get to a sturdy building.',
    ],
    after: [
      'Watch for broken glass, nails, and downed power lines.',
      'Don’t enter damaged buildings until they’re inspected.',
      'Help injured people but don’t move the seriously hurt unless in danger.',
      'Take photos of damage for your insurance.',
    ],
  },
  {
    id: 'winter',
    title: 'Winter Storm',
    icon: '❄️',
    before: [
      'Insulate pipes and know how to shut off water if they freeze.',
      'Stock extra blankets, warm clothing, food, and water.',
      'Keep flashlights and batteries ready for outages.',
      'Service heating equipment and check smoke/CO detectors.',
    ],
    during: [
      'Stay indoors and dress in layers.',
      'Never use a generator, grill, or camp stove indoors — carbon monoxide risk.',
      'Keep faucets dripping slightly to prevent frozen pipes.',
      'If you lose heat, close off unused rooms to conserve warmth.',
    ],
    after: [
      'Check on neighbors at risk from the cold.',
      'Watch for signs of frostbite and hypothermia.',
      'Clear snow from vents and exhausts to avoid CO buildup.',
      'Avoid overexertion when shoveling.',
    ],
  },
  {
    id: 'heat',
    title: 'Extreme Heat',
    icon: '🌡️',
    before: [
      'Identify air-conditioned public places (libraries, malls, cooling centers).',
      'Check that fans and AC work; cover windows that get morning/afternoon sun.',
      'Stock extra water and electrolyte drinks.',
      'Plan to check on older or isolated neighbors.',
    ],
    during: [
      'Drink water often — don’t wait until you’re thirsty.',
      'Stay in the coolest part of your home or a cooling center.',
      'Never leave people or pets in a parked car.',
      'Limit outdoor activity to early morning or evening.',
    ],
    after: [
      'Watch for heat exhaustion (heavy sweating, weakness) and heat stroke (confusion, hot dry skin — call 911).',
      'Keep hydrating and resting in a cool place.',
      'Check on family, neighbors, and pets.',
      'Restock your water and supplies for the next wave.',
    ],
  },
];

const PHASES = [
  { key: 'before', label: 'Before', color: 'text-blue-700 dark:text-blue-300' },
  { key: 'during', label: 'During', color: 'text-[#c84444] dark:text-red-300' },
  { key: 'after', label: 'After', color: 'text-green-700 dark:text-green-300' },
];

const SafetyManual = () => {
  // Which disaster guide is expanded (only one open at a time). Default to the
  // first so the section doesn't look empty on load.
  const [openId, setOpenId] = useState(DISASTER_GUIDES[0].id);

  // Zipcode lookup: resolves a US zip to its city/state and area-tailored
  // contacts. Until a search succeeds, we show the national defaults.
  const [zip, setZip] = useState('');
  const [zipLoading, setZipLoading] = useState(false);
  const [zipError, setZipError] = useState('');
  const [localResult, setLocalResult] = useState(null); // { location, contacts }

  const handleZipSearch = async (e) => {
    e.preventDefault();
    const trimmed = zip.trim();
    setZipError('');

    if (!/^\d{5}$/.test(trimmed)) {
      setZipError('Please enter a valid 5-digit US zipcode.');
      return;
    }

    setZipLoading(true);
    try {
      const { data } = await api.get(`/api/emergency/${trimmed}`);
      setLocalResult(data.data);
    } catch (err) {
      setLocalResult(null);
      setZipError(err.response?.data?.message || 'Could not look up that zipcode. Please try again.');
    } finally {
      setZipLoading(false);
    }
  };

  // Show area-tailored contacts once a lookup succeeds, else national defaults.
  const contacts = localResult?.contacts || EMERGENCY_CONTACTS;

  return (
    <div>
      <h1 className="text-3xl font-bold text-[#1C2A16] dark:text-white mb-1">
        Safety Manual
      </h1>
      <p className="text-gray-500 dark:text-gray-400 mb-8">
        Emergency contacts and step-by-step guidance for before, during, and
        after a disaster.
      </p>

      {/* ── Emergency contacts ───────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-4">
          Emergency Contacts
        </h2>

        {/* Zipcode search — find local (211) help for a specific area. */}
        <form onSubmit={handleZipSearch} className="flex flex-wrap items-end gap-3 mb-4">
          <div>
            <label htmlFor="zip" className="block text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
              Find local help by zipcode
            </label>
            <input
              id="zip"
              type="text"
              inputMode="numeric"
              value={zip}
              onChange={(e) => { setZip(e.target.value); setZipError(''); }}
              placeholder="e.g. 78701"
              maxLength={5}
              className="w-40 px-4 py-2.5 rounded-xl border-2 border-gray-300 dark:border-[#3a4f30] bg-white dark:bg-[#1a2f1a] text-gray-900 dark:text-white focus:outline-none focus:border-[#6ba3d3] focus:ring-2 focus:ring-[#6ba3d3]/30 transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={zipLoading}
            className="px-6 py-2.5 rounded-xl bg-[#1e3a5f] text-white font-semibold hover:bg-[#182f4d] focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {zipLoading ? 'Searching…' : 'Search'}
          </button>
          {localResult && (
            <button
              type="button"
              onClick={() => { setLocalResult(null); setZip(''); setZipError(''); }}
              className="px-4 py-2.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              Clear
            </button>
          )}
        </form>

        {zipError && (
          <p className="text-sm text-red-600 dark:text-red-400 mb-4">{zipError}</p>
        )}
        {localResult && (
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
            Showing contacts for{' '}
            <span className="font-bold">
              {localResult.location.city}, {localResult.location.stateAbbreviation} {localResult.location.zipcode}
            </span>
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {contacts.map((c) => (
            <div
              key={c.label}
              className={`bg-white dark:bg-[#273A20] rounded-2xl shadow-md p-5 transition-colors duration-300 ${
                c.local ? 'ring-2 ring-[#6ba3d3]' : ''
              }`}
            >
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {c.label}
              </p>
              {c.placeholder ? (
                <p className="text-lg font-bold text-gray-400 dark:text-gray-500 italic mt-1">
                  {c.value}
                </p>
              ) : (
                <a
                  href={`tel:${c.value.replace(/[^0-9]/g, '')}`}
                  className="text-2xl font-bold text-[#1e3a5f] dark:text-[#6ba3d3] hover:underline mt-1 inline-block"
                >
                  {c.value}
                </a>
              )}
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{c.note}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Disaster guides ──────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-4">
          Disaster Preparedness Guides
        </h2>
        <div className="space-y-4">
          {DISASTER_GUIDES.map((guide) => {
            const isOpen = openId === guide.id;
            return (
              <div
                key={guide.id}
                className="bg-white dark:bg-[#273A20] rounded-2xl shadow-md overflow-hidden transition-colors duration-300"
              >
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : guide.id)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                >
                  <span className="flex items-center gap-3">
                    <span className="text-2xl" aria-hidden="true">{guide.icon}</span>
                    <span className="text-lg font-bold text-[#1C2A16] dark:text-white">
                      {guide.title}
                    </span>
                  </span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-5 w-5 text-gray-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-3 gap-6 border-t border-gray-100 dark:border-gray-700 pt-5">
                    {PHASES.map((phase) => (
                      <div key={phase.key}>
                        <h3 className={`text-sm font-bold uppercase tracking-wide mb-2 ${phase.color}`}>
                          {phase.label}
                        </h3>
                        <ul className="space-y-2">
                          {guide[phase.key].map((step, i) => (
                            <li
                              key={i}
                              className="flex gap-2 text-sm text-gray-700 dark:text-gray-300"
                            >
                              <span className="text-[#7F9764] mt-0.5" aria-hidden="true">•</span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <p className="text-xs text-gray-400 dark:text-gray-500 mt-8 italic">
        Guidance adapted from FEMA, Ready.gov, and the American Red Cross. Always
        follow instructions from your local emergency officials.
      </p>
    </div>
  );
};

export default SafetyManual;

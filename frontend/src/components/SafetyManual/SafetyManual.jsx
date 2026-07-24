import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../utils/api';

// A reference "manual" for help-seekers: who to call in an emergency, and
// what to do before / during / after common disasters. Content is static
// (no backend) and sourced from standard FEMA / Ready.gov / Red Cross guidance.

const SafetyManual = () => {
  const { t } = useTranslation();

  // National emergency contacts. Numbers are US-wide; local lines vary, so we
  // leave a clearly-labeled placeholder for those.
  const EMERGENCY_CONTACTS = [
    { label: t('safety.contacts.lifeThreatening.label'), value: '911', note: t('safety.contacts.lifeThreatening.note') },
    { label: t('safety.contacts.distressHelpline.label'), value: '1-800-985-5990', note: t('safety.contacts.distressHelpline.note') },
    { label: t('safety.contacts.poisonControl.label'), value: '1-800-222-1222', note: t('safety.contacts.poisonControl.note') },
    { label: t('safety.contacts.fema.label'), value: '1-800-621-3362', note: t('safety.contacts.fema.note') },
    { label: t('safety.contacts.redCross.label'), value: '1-800-733-2767', note: t('safety.contacts.redCross.note') },
    { label: t('safety.contacts.localNonEmergency.label'), value: t('safety.contacts.localNonEmergency.value'), note: t('safety.contacts.localNonEmergency.note'), placeholder: true },
  ];

  // Before / during / after steps for each disaster type. Kept concise and
  // action-oriented so it reads like a checklist.
  const DISASTER_GUIDES = [
    {
      id: 'hurricane',
      title: t('safety.guides.hurricane.title'),
      icon: '🌀',
      before: [
        t('safety.guides.hurricane.before.0'),
        t('safety.guides.hurricane.before.1'),
        t('safety.guides.hurricane.before.2'),
        t('safety.guides.hurricane.before.3'),
      ],
      during: [
        t('safety.guides.hurricane.during.0'),
        t('safety.guides.hurricane.during.1'),
        t('safety.guides.hurricane.during.2'),
        t('safety.guides.hurricane.during.3'),
      ],
      after: [
        t('safety.guides.hurricane.after.0'),
        t('safety.guides.hurricane.after.1'),
        t('safety.guides.hurricane.after.2'),
        t('safety.guides.hurricane.after.3'),
      ],
    },
    {
      id: 'wildfire',
      title: t('safety.guides.wildfire.title'),
      icon: '🔥',
      before: [
        t('safety.guides.wildfire.before.0'),
        t('safety.guides.wildfire.before.1'),
        t('safety.guides.wildfire.before.2'),
        t('safety.guides.wildfire.before.3'),
      ],
      during: [
        t('safety.guides.wildfire.during.0'),
        t('safety.guides.wildfire.during.1'),
        t('safety.guides.wildfire.during.2'),
        t('safety.guides.wildfire.during.3'),
      ],
      after: [
        t('safety.guides.wildfire.after.0'),
        t('safety.guides.wildfire.after.1'),
        t('safety.guides.wildfire.after.2'),
        t('safety.guides.wildfire.after.3'),
      ],
    },
    {
      id: 'earthquake',
      title: t('safety.guides.earthquake.title'),
      icon: '🌎',
      before: [
        t('safety.guides.earthquake.before.0'),
        t('safety.guides.earthquake.before.1'),
        t('safety.guides.earthquake.before.2'),
        t('safety.guides.earthquake.before.3'),
      ],
      during: [
        t('safety.guides.earthquake.during.0'),
        t('safety.guides.earthquake.during.1'),
        t('safety.guides.earthquake.during.2'),
        t('safety.guides.earthquake.during.3'),
      ],
      after: [
        t('safety.guides.earthquake.after.0'),
        t('safety.guides.earthquake.after.1'),
        t('safety.guides.earthquake.after.2'),
        t('safety.guides.earthquake.after.3'),
      ],
    },
    {
      id: 'tornado',
      title: t('safety.guides.tornado.title'),
      icon: '🌪️',
      before: [
        t('safety.guides.tornado.before.0'),
        t('safety.guides.tornado.before.1'),
        t('safety.guides.tornado.before.2'),
        t('safety.guides.tornado.before.3'),
      ],
      during: [
        t('safety.guides.tornado.during.0'),
        t('safety.guides.tornado.during.1'),
        t('safety.guides.tornado.during.2'),
        t('safety.guides.tornado.during.3'),
      ],
      after: [
        t('safety.guides.tornado.after.0'),
        t('safety.guides.tornado.after.1'),
        t('safety.guides.tornado.after.2'),
        t('safety.guides.tornado.after.3'),
      ],
    },
    {
      id: 'winter',
      title: t('safety.guides.winter.title'),
      icon: '❄️',
      before: [
        t('safety.guides.winter.before.0'),
        t('safety.guides.winter.before.1'),
        t('safety.guides.winter.before.2'),
        t('safety.guides.winter.before.3'),
      ],
      during: [
        t('safety.guides.winter.during.0'),
        t('safety.guides.winter.during.1'),
        t('safety.guides.winter.during.2'),
        t('safety.guides.winter.during.3'),
      ],
      after: [
        t('safety.guides.winter.after.0'),
        t('safety.guides.winter.after.1'),
        t('safety.guides.winter.after.2'),
        t('safety.guides.winter.after.3'),
      ],
    },
    {
      id: 'heat',
      title: t('safety.guides.heat.title'),
      icon: '🌡️',
      before: [
        t('safety.guides.heat.before.0'),
        t('safety.guides.heat.before.1'),
        t('safety.guides.heat.before.2'),
        t('safety.guides.heat.before.3'),
      ],
      during: [
        t('safety.guides.heat.during.0'),
        t('safety.guides.heat.during.1'),
        t('safety.guides.heat.during.2'),
        t('safety.guides.heat.during.3'),
      ],
      after: [
        t('safety.guides.heat.after.0'),
        t('safety.guides.heat.after.1'),
        t('safety.guides.heat.after.2'),
        t('safety.guides.heat.after.3'),
      ],
    },
  ];

  const PHASES = [
    { key: 'before', label: t('safety.phases.before'), color: 'text-blue-700 dark:text-blue-300' },
    { key: 'during', label: t('safety.phases.during'), color: 'text-[#c84444] dark:text-red-300' },
    { key: 'after', label: t('safety.phases.after'), color: 'text-green-700 dark:text-green-300' },
  ];

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
      setZipError(t('safety.zip.invalid'));
      return;
    }

    setZipLoading(true);
    try {
      const { data } = await api.get(`/api/emergency/${trimmed}`);
      setLocalResult(data.data);
    } catch (err) {
      setLocalResult(null);
      setZipError(err.response?.data?.message || t('safety.zip.lookupError'));
    } finally {
      setZipLoading(false);
    }
  };

  // Show area-tailored contacts once a lookup succeeds, else national defaults.
  const contacts = localResult?.contacts || EMERGENCY_CONTACTS;

  return (
    <div>
      <h1 className="text-3xl font-bold text-[#1C2A16] dark:text-white mb-1">
        {t('safety.pageTitle')}
      </h1>
      <p className="text-gray-500 dark:text-gray-400 mb-8">
        {t('safety.pageSubtitle')}
      </p>

      {/* ── Emergency contacts ───────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-4">
          {t('safety.contactsHeading')}
        </h2>

        {/* Zipcode search — find local (211) help for a specific area. */}
        <form onSubmit={handleZipSearch} className="flex flex-wrap items-end gap-3 mb-4">
          <div>
            <label htmlFor="zip" className="block text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
              {t('safety.zip.label')}
            </label>
            <input
              id="zip"
              type="text"
              inputMode="numeric"
              value={zip}
              onChange={(e) => { setZip(e.target.value); setZipError(''); }}
              placeholder={t('safety.zip.placeholder')}
              maxLength={5}
              className="w-40 px-4 py-2.5 rounded-xl border-2 border-gray-300 dark:border-[#3a4f30] bg-white dark:bg-[#1a2f1a] text-gray-900 dark:text-white focus:outline-none focus:border-[#6ba3d3] focus:ring-2 focus:ring-[#6ba3d3]/30 transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={zipLoading}
            className="px-6 py-2.5 rounded-xl bg-[#1e3a5f] text-white font-semibold hover:bg-[#182f4d] focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {zipLoading ? t('safety.zip.searching') : t('safety.zip.search')}
          </button>
          {localResult && (
            <button
              type="button"
              onClick={() => { setLocalResult(null); setZip(''); setZipError(''); }}
              className="px-4 py-2.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              {t('safety.zip.clear')}
            </button>
          )}
        </form>

        {zipError && (
          <p className="text-sm text-red-600 dark:text-red-400 mb-4">{zipError}</p>
        )}
        {localResult && (
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
            {t('safety.zip.showingContacts')}{' '}
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
          {t('safety.guidesHeading')}
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
        {t('safety.disclaimer')}
      </p>
    </div>
  );
};

export default SafetyManual;

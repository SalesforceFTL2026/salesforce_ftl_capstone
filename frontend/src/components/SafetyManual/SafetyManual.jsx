import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

// A reference "manual" for help-seekers: who to call in an emergency, and
// what to do before / during / after common disasters. Content is static
// (no backend) and sourced from standard FEMA / Ready.gov / Red Cross guidance.

const SafetyManual = () => {
  const { t } = useTranslation();

  // National emergency contacts, grouped by need. Every number here is a real,
  // established US-wide hotline that works from anywhere in the country — no
  // area/zip lookup, because these lines route callers to local help themselves
  // (e.g. 211, 988). Labels and notes are translated; the numbers live in code.
  //
  //   `tel`  — digits to dial (used for the clickable tel: link).
  //   items without `tel` are text-only actions (e.g. "Text HOME to 741741").
  const CONTACT_CATEGORIES = [
    {
      id: 'immediate',
      items: [
        { key: 'lifeThreatening', value: '911', tel: '911' },
        { key: 'crisisLifeline', value: '988', tel: '988' },
        { key: 'community211', value: '211', tel: '211' },
      ],
    },
    {
      id: 'disaster',
      items: [
        { key: 'fema', value: '1-800-621-3362', tel: '18006213362' },
        { key: 'distressHelpline', value: '1-800-985-5990', tel: '18009855990' },
        { key: 'redCross', value: '1-800-733-2767', tel: '18007332767' },
      ],
    },
    {
      id: 'health',
      items: [
        { key: 'poisonControl', value: '1-800-222-1222', tel: '18002221222' },
        { key: 'samhsa', value: '1-800-662-4357', tel: '18006624357' },
        { key: 'cdc', value: '1-800-232-4636', tel: '18002324636' },
        { key: 'medicare', value: '1-800-633-4227', tel: '18006334227' },
      ],
    },
    {
      id: 'mentalHealth',
      items: [
        { key: 'crisisText', value: t('safety.contacts.crisisText.value') },
        { key: 'veteransCrisis', value: t('safety.contacts.veteransCrisis.value'), tel: '988' },
        { key: 'transLifeline', value: '1-877-565-8860', tel: '18775658860' },
        { key: 'trevor', value: '1-866-488-7386', tel: '18664887386' },
      ],
    },
    {
      id: 'safety',
      items: [
        { key: 'domesticViolence', value: '1-800-799-7233', tel: '18007997233' },
        { key: 'sexualAssault', value: '1-800-656-4673', tel: '18006564673' },
        { key: 'childAbuse', value: '1-800-422-4453', tel: '18004224453' },
        { key: 'humanTrafficking', value: '1-888-373-7888', tel: '18883737888' },
      ],
    },
    {
      id: 'children',
      items: [
        { key: 'runaway', value: '1-800-786-2929', tel: '18007862929' },
        { key: 'missingChildren', value: '1-800-843-5678', tel: '18008435678' },
      ],
    },
    {
      id: 'seniorsDisability',
      items: [
        { key: 'eldercare', value: '1-800-677-1116', tel: '18006771116' },
        { key: 'dial', value: '1-888-677-1199', tel: '18886771199' },
      ],
    },
    {
      id: 'veterans',
      items: [
        { key: 'vaBenefits', value: '1-800-827-1000', tel: '18008271000' },
        { key: 'homelessVeterans', value: '1-877-424-3838', tel: '18774243838' },
      ],
    },
    {
      id: 'animals',
      items: [
        { key: 'aspca', value: '1-888-426-4435', tel: '18884264435' },
      ],
    },
  ];

  // Before / during / after steps for each disaster type. Kept concise and
  // action-oriented so it reads like a checklist.
  const DISASTER_GUIDES = [
    {
      id: 'hurricane',
      title: t('safety.guides.hurricane.title'),
      Icon: HurricaneIcon,
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
      Icon: WildfireIcon,
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
      Icon: EarthquakeIcon,
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
      Icon: TornadoIcon,
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
      Icon: WinterIcon,
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
      Icon: HeatIcon,
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

  return (
    <div className="safety-screen">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#1C2A16] dark:text-white mb-1">
            {t('safety.pageTitle')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            {t('safety.pageSubtitle')}
          </p>
        </div>
        {/* Print → "Save as PDF". A print stylesheet renders the full manual
            (all contacts + every guide expanded) so people can keep an offline
            copy. window.print() lets the browser use its own fonts, so every
            language / script prints correctly. */}
        <button
          type="button"
          onClick={() => window.print()}
          className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1e3a5f] text-white font-semibold hover:bg-[#182f4d] focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/40 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v6" />
          </svg>
          {t('safety.download')}
        </button>
      </div>

      {/* ── Emergency contacts ───────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
          {t('safety.contactsHeading')}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          {t('safety.contactsIntro')}
        </p>

        <div className="space-y-8">
          {CONTACT_CATEGORIES.map((category) => (
            <div key={category.id}>
              <h3 className="text-base font-bold text-[#1C2A16] dark:text-white mb-3">
                {t(`safety.contacts.categories.${category.id}`)}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {category.items.map((item) => (
                  <div
                    key={item.key}
                    className="bg-white dark:bg-[#273A20] rounded-2xl shadow-md p-5 transition-colors duration-300"
                  >
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      {t(`safety.contacts.${item.key}.label`)}
                    </p>
                    {item.tel ? (
                      <a
                        href={`tel:${item.tel}`}
                        className="text-2xl font-bold text-[#1e3a5f] dark:text-[#6ba3d3] hover:underline mt-1 inline-block"
                      >
                        {item.value}
                      </a>
                    ) : (
                      <p className="text-2xl font-bold text-[#1e3a5f] dark:text-[#6ba3d3] mt-1">
                        {item.value}
                      </p>
                    )}
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                      {t(`safety.contacts.${item.key}.note`)}
                    </p>
                  </div>
                ))}
              </div>
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
                    <span className="w-10 h-10 shrink-0 rounded-xl bg-[#7F9764]/15 text-[#4d5f38] dark:text-[#a9c088] flex items-center justify-center">
                      <guide.Icon />
                    </span>
                    <span className="text-lg font-bold text-[#1C2A16] dark:text-white">
                      {guide.title}
                    </span>
                  </span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-5 w-5 text-gray-500 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
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

      <p className="text-xs text-gray-500 dark:text-gray-500 mt-8 italic">
        {t('safety.disclaimer')}
      </p>

      {/* Print-only document. Rendered into <body> so a print stylesheet can
          hide the entire app and show only this. It ignores the on-screen
          accordion state — every guide is fully expanded here. */}
      {createPortal(
        <div className="safety-print" aria-hidden="true">
          <h1 className="safety-print__title">{t('safety.pageTitle')}</h1>
          <p className="safety-print__subtitle">{t('safety.pageSubtitle')}</p>

          <h2 className="safety-print__section">{t('safety.contactsHeading')}</h2>
          <p className="safety-print__intro">{t('safety.contactsIntro')}</p>
          {CONTACT_CATEGORIES.map((category) => (
            <div key={category.id} className="safety-print__group">
              <h3 className="safety-print__category">
                {t(`safety.contacts.categories.${category.id}`)}
              </h3>
              <table className="safety-print__contacts">
                <tbody>
                  {category.items.map((item) => (
                    <tr key={item.key}>
                      <td className="safety-print__c-label">
                        {t(`safety.contacts.${item.key}.label`)}
                      </td>
                      <td className="safety-print__c-value">{item.value}</td>
                      <td className="safety-print__c-note">
                        {t(`safety.contacts.${item.key}.note`)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          <h2 className="safety-print__section safety-print__section--break">
            {t('safety.guidesHeading')}
          </h2>
          {DISASTER_GUIDES.map((guide) => (
            <div key={guide.id} className="safety-print__guide">
              <h3 className="safety-print__guide-title">{guide.title}</h3>
              <div className="safety-print__phases">
                {PHASES.map((phase) => (
                  <div key={phase.key} className="safety-print__phase">
                    <h4 className="safety-print__phase-label">{phase.label}</h4>
                    <ul className="safety-print__steps">
                      {guide[phase.key].map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <p className="safety-print__disclaimer">{t('safety.disclaimer')}</p>
        </div>,
        document.body,
      )}
    </div>
  );
};

// --- Disaster icons ---------------------------------------------------------
//
// Line icons in the page's existing stroke style (matching the chevron above),
// replacing the emoji glyphs so the guide reads as a designed set rather than
// OS-dependent emoji. Each is decorative — the guide's title carries the label —
// so they're marked aria-hidden.
const iconProps = {
  xmlns: 'http://www.w3.org/2000/svg',
  className: 'h-6 w-6',
  fill: 'none',
  viewBox: '0 0 24 24',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  'aria-hidden': true,
};

// Hurricane — a spiral of curved bands.
function HurricaneIcon() {
  return (
    <svg {...iconProps}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7c3-2 8-2.5 12-1M20 17c-3 2-8 2.5-12 1" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 9.5a3 3 0 10-2 5.2" />
    </svg>
  );
}

// Wildfire — a flame.
function WildfireIcon() {
  return (
    <svg {...iconProps}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c.7 2.2 2.4 3.3 3.6 5A6 6 0 016 15.5C6 11 9.5 10 9 5c1.2.8 2 1.6 3-2z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a5 5 0 01-3-9c-.2 2 1 3 1.5 3.8A2.5 2.5 0 0015 15c1 1.2 1 1.8 1 2.5a4 4 0 01-4 3.5z" />
    </svg>
  );
}

// Earthquake — a cracked ground line.
function EarthquakeIcon() {
  return (
    <svg {...iconProps}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9l3.5 2L9 6l3 8 2.5-6L18 11l3-1.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 17h4l1.5 2.5L12 15l2 3 1.5-2H20" />
    </svg>
  );
}

// Tornado — stacked funnel lines narrowing to a point.
function TornadoIcon() {
  return (
    <svg {...iconProps}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h16M6 9h12M9 13h7M12 17h3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 17c-.5 2-1.5 3-3 4" />
    </svg>
  );
}

// Winter — a snowflake.
function WinterIcon() {
  return (
    <svg {...iconProps}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M3 12h18M5.5 5.5l13 13M18.5 5.5l-13 13" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6l-2-2m2 2l2-2m-2 14l-2 2m2-2l2 2M6 12l-2-2m2 2l-2 2m14-2l2-2m-2 2l2 2" />
    </svg>
  );
}

// Extreme heat — a thermometer.
function HeatIcon() {
  return (
    <svg {...iconProps}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 13.5V5a2 2 0 114 0v8.5a4 4 0 11-4 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 17.5a0 0 0 100 0M12 9v6" />
    </svg>
  );
}

export default SafetyManual;

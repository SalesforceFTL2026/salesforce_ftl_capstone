import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import salesforce from '../../assets/partners/salesforce.svg';
import redCross from '../../assets/partners/american-red-cross.svg';
import directRelief from '../../assets/partners/direct-relief.png';
import habitat from '../../assets/partners/habitat.svg';
import unitedWay from '../../assets/partners/united-way.svg';
import good360 from '../../assets/partners/g360logo.png';

// Partner marks bundled in the repo so there's no runtime network dependency.
// Partners without a clean, freely-licensable logo asset (e.g. Good360) render
// as a styled name wordmark. `logo` is optional; a missing or broken image
// falls back to the name so a broken image never shows.
const partners = [
  { name: 'Salesforce', logo: salesforce },
  { name: 'Good360', logo: good360},
  { name: 'American Red Cross', logo: redCross },
  { name: 'Direct Relief', logo: directRelief },
  { name: 'Habitat for Humanity', logo: habitat },
  { name: 'United Way', logo: unitedWay },
];

// One partner tile: the logo, or the partner's name if there's no logo or it
// fails to load.
const PartnerLogo = ({ name, logo }) => {
  const [failed, setFailed] = useState(false);

  return (
    <div className="w-full h-24 sm:h-28 bg-white rounded-2xl ring-1 ring-hairline flex items-center justify-center p-5 transition-shadow hover:shadow-card">
      {(!logo || failed) ? (
        <span className="font-display text-lg text-forest-800 tracking-wide text-center">
          {name}
        </span>
      ) : (
        <img
          src={logo}
          alt={`${name} logo`}
          loading="lazy"
          onError={() => setFailed(true)}
          className="max-h-full max-w-full object-contain"
        />
      )}
    </div>
  );
};

const PartnerSection = () => {
  const { t } = useTranslation();
  return (
    <section id="partner-resources" className="py-20 bg-surface-2">
      <div className="max-w-5xl mx-auto px-6">
        <h2 className="font-display text-3xl sm:text-4xl text-center mb-14 text-ink tracking-wide max-w-3xl mx-auto">
          {t('landing.partners.title')}
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6">
          {partners.map((p) => (
            <PartnerLogo key={p.name} name={p.name} logo={p.logo} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default PartnerSection;

import { useTranslation } from 'react-i18next';
import communityImg from '../../assets/hero_disaster_pictures/team.jpg';

const WhoWeAreSection = () => {
  const { t } = useTranslation();
  return (
    <section id="who-we-are" className="py-24 bg-surface">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Text */}
          <div>
            <p className="font-display text-pin-500 text-lg tracking-[0.2em] mb-3">
              {t('landing.whoWeAre.title')}
            </p>
            <h2 className="text-3xl sm:text-4xl md:text-[2.75rem] font-semibold mb-6 text-ink leading-tight">
              {t('landing.whoWeAre.lead')}
            </h2>
            <p className="text-ink-muted text-lg leading-relaxed">
              {t('landing.whoWeAre.body')}
            </p>
          </div>

          {/* Image */}
          <div className="rounded-[2rem] overflow-hidden shadow-card h-80 lg:h-[28rem] ring-1 ring-hairline">
            <img
              src={communityImg}
              alt={t('landing.whoWeAre.imageAlt')}
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export default WhoWeAreSection;

import { useTranslation } from 'react-i18next';
import floodImg from '../../assets/hero_disaster_pictures/hurricane.webp';
import foodImg from '../../assets/hero_disaster_pictures/trash.jpg';
import rubbleImg from '../../assets/hero_disaster_pictures/child.jpg';

const WhatWeDoSection = () => {
  const { t } = useTranslation();

  const cards = [
    { key: 'map', image: floodImg },
    { key: 'match', image: foodImg },
    { key: 'coordinate', image: rubbleImg },
  ];

  return (
    <section id="what-we-do" className="py-24 bg-surface-2">
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="font-display text-4xl sm:text-5xl text-center mb-14 text-ink tracking-wide">
          {t('landing.whatWeDo.title')}
        </h2>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {cards.map(({ key, image }, i) => (
            <div
              key={key}
              className="group bg-surface rounded-3xl overflow-hidden flex flex-col shadow-card hover:shadow-card-hover ring-1 ring-hairline transition-shadow duration-300"
            >
              <div className="h-52 overflow-hidden relative">
                <img
                  src={image}
                  alt={t(`landing.whatWeDo.cards.${key}.imageAlt`)}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                {/* Numbered marker — this section is a real sequence: map → match → coordinate. */}
                <span className="absolute top-4 left-4 font-display text-white text-lg w-9 h-9 flex items-center justify-center rounded-full bg-forest-900/70 backdrop-blur-sm ring-1 ring-white/30">
                  {i + 1}
                </span>
              </div>
              <div className="p-7 flex flex-col flex-grow">
                <h3 className="font-display text-2xl text-ink mb-3 tracking-wide">
                  {t(`landing.whatWeDo.cards.${key}.title`)}
                </h3>
                <p className="text-ink-muted leading-relaxed">
                  {t(`landing.whatWeDo.cards.${key}.description`)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default WhatWeDoSection;

import { useTranslation } from 'react-i18next';
import floodImg from '../../assets/hero_disaster_pictures/flood.jpeg';
import foodImg from '../../assets/hero_disaster_pictures/food.jpeg';
import rubbleImg from '../../assets/hero_disaster_pictures/rubble.jpg';

const WhatWeDoSection = () => {
  const { t } = useTranslation();

  const cards = [
    { key: 'map', image: floodImg },
    { key: 'match', image: foodImg },
    { key: 'coordinate', image: rubbleImg },
  ];

  return (
    <section id="what-we-do" className="py-24 bg-[#7F9764] dark:bg-[#1a2f1a] transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="text-4xl sm:text-5xl font-bold text-center mb-16 text-white dark:text-white transition-colors duration-300">
          {t('landing.whatWeDo.title')}
        </h2>

        <div className="grid md:grid-cols-3 gap-8">
          {cards.map(({ key, image }) => (
            <div
              key={key}
              className="bg-[#e8e8e8] dark:bg-[#273A20] rounded-[2rem] overflow-hidden flex flex-col transition-colors duration-300"
            >
              <div className="h-56 overflow-hidden">
                <img
                  src={image}
                  alt={t(`landing.whatWeDo.cards.${key}.imageAlt`)}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-8 flex flex-col flex-grow">
                <h3 className="text-2xl font-bold text-black dark:text-white mb-4 transition-colors duration-300">
                  {t(`landing.whatWeDo.cards.${key}.title`)}
                </h3>
                <p className="text-gray-800 dark:text-gray-300 leading-relaxed transition-colors duration-300">
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

import { useTranslation } from 'react-i18next';
import communityImg from '../../assets/hero_disaster_pictures/food.jpeg';

const WhoWeAreSection = () => {
  const { t } = useTranslation();
  return (
    <section id="who-we-are" className="py-24 bg-[#7F9764] dark:bg-[#1a2f1a] transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Text */}
          <div>
            <h2 className="text-4xl sm:text-5xl font-bold mb-8 text-white dark:text-[#B0BF9F] transition-colors duration-300">
              {t('landing.whoWeAre.title')}
            </h2>
            <p className="text-xl sm:text-2xl font-semibold mb-6 text-white dark:text-gray-200 leading-snug transition-colors duration-300">
              {t('landing.whoWeAre.lead')}
            </p>
            <p className="text-gray-100 dark:text-gray-300 leading-relaxed transition-colors duration-300">
              {t('landing.whoWeAre.body')}
            </p>
          </div>

          {/* Image */}
          <div className="rounded-[2rem] overflow-hidden shadow-lg h-80 lg:h-96">
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

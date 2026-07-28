import { useTranslation } from 'react-i18next';
import StatCard from '../StatCard/StatCard';

const ImpactSection = () => {
  const { t } = useTranslation();

  // Illustrative demo figures for the pilot network. Keyed to the i18n
  // "impact.stats" block so copy and translations stay in one place.
  const stats = ['requests', 'volunteers', 'response', 'counties'];

  return (
    <section className="py-16 sm:py-20 md:py-24 bg-forest-800 dark:bg-surface-2">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
        <h2 className="font-display text-3xl sm:text-4xl md:text-5xl text-white dark:text-forest-300 tracking-wide">
          {t('landing.impact.title')}
        </h2>
        <p className="text-white/70 dark:text-ink-muted mt-3 mb-12 sm:mb-16">
          {t('landing.impact.subtitle')}
        </p>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {stats.map((key) => (
            <StatCard
              key={key}
              value={t(`landing.impact.stats.${key}.value`)}
              label={t(`landing.impact.stats.${key}.label`)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export default ImpactSection;

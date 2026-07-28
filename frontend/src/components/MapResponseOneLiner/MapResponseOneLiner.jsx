import { useTranslation } from 'react-i18next';

const MapResponseOneLiner = () => {
  const { t } = useTranslation();
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <section className="bg-gradient-to-br from-forest-900 via-forest-800 to-forest-700 dark:from-black dark:via-surface dark:to-surface-2 py-20">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between gap-6">
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl text-white max-w-3xl leading-tight tracking-wide">
            {t('landing.oneLiner.text')}
          </h2>
          <button
            onClick={scrollToTop}
            className="w-14 h-14 sm:w-16 sm:h-16 bg-pin-500 rounded-full flex items-center justify-center hover:bg-pin-600 transition-colors flex-shrink-0 shadow-lg shadow-pin-600/30"
            aria-label={t('landing.oneLiner.scrollToTopAria')}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-7 w-7 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}

export default MapResponseOneLiner;

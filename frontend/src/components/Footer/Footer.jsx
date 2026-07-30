import { useTranslation } from 'react-i18next';
import MRLogo from '../../assets/logos/MRLogo.png';

const Footer = () => {
  const { t } = useTranslation();
  return (
    <footer className="bg-forest-900 dark:bg-surface border-t border-hairline/40 py-14">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          {/* Logo and Description */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-4 bg-white/95 rounded-2xl px-4 py-3 w-fit">
              <img
                src={MRLogo}
                alt={t('landing.footer.logoAlt')}
                className="w-[180px] object-contain"
              />
            </div>
            <p className="text-white dark:text-ink text-lg font-semibold mb-2">{t('landing.footer.phone')}</p>
            <p className="text-forest-200 dark:text-ink-muted text-base max-w-xs">
              {t('landing.footer.description')}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;

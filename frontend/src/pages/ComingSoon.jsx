// Temporary placeholder for role destinations a teammate is still building.
import { useTranslation } from 'react-i18next';

const ComingSoon = ({ title }) => {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center p-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-2">{title}</h1>
      <p className="text-gray-500">{t('misc.comingSoon')}</p>
    </div>
  );
};

export default ComingSoon;

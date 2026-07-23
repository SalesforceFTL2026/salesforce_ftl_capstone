import { useTranslation } from 'react-i18next';

const GetInvolvedSection = () => {
  const { t } = useTranslation();
  return (
    <section className="py-24 bg-[#C1DAFF] dark:bg-[#1a2f3a] transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="text-5xl font-bold text-center mb-20 text-[#1C2A16] dark:text-white transition-colors duration-300">
          {t('landing.getInvolved.title')}
        </h2>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-[#e8e8e8] dark:bg-[#273A20] rounded-[2rem] overflow-hidden transition-colors duration-300">
            <div className="bg-[#d4d4d4] dark:bg-[#1a2332] h-72 flex items-center justify-center transition-colors duration-300">
              <span className="text-gray-600 dark:text-gray-400 text-sm transition-colors duration-300">{t('landing.getInvolved.graphic')}</span>
            </div>
            <div className="bg-[#1C2A16] dark:bg-[#0f1419] p-8 text-center transition-colors duration-300">
              <p className="text-white text-xl font-medium leading-snug">
                {t('landing.getInvolved.corporatePartnerLine1')}<br />{t('landing.getInvolved.corporatePartnerLine2')}
              </p>
            </div>
          </div>

          <div className="bg-[#e8e8e8] dark:bg-[#273A20] rounded-[2rem] overflow-hidden transition-colors duration-300">
            <div className="bg-[#d4d4d4] dark:bg-[#1a2332] h-72 flex items-center justify-center transition-colors duration-300">
              <span className="text-gray-600 dark:text-gray-400 text-sm transition-colors duration-300">{t('landing.getInvolved.graphic')}</span>
            </div>
            <div className="bg-[#1C2A16] dark:bg-[#0f1419] p-8 text-center transition-colors duration-300">
              <p className="text-white text-xl font-medium leading-snug">
                {t('landing.getInvolved.nonprofitNetworkLine1')}<br />{t('landing.getInvolved.nonprofitNetworkLine2')}
              </p>
            </div>
          </div>

          <div className="bg-[#e8e8e8] dark:bg-[#273A20] rounded-[2rem] overflow-hidden transition-colors duration-300">
            <div className="bg-[#d4d4d4] dark:bg-[#1a2332] h-72 flex items-center justify-center transition-colors duration-300">
              <span className="text-gray-600 dark:text-gray-400 text-sm transition-colors duration-300">{t('landing.getInvolved.graphic')}</span>
            </div>
            <div className="bg-[#1C2A16] dark:bg-[#0f1419] p-8 text-center transition-colors duration-300">
              <p className="text-white text-xl font-medium leading-snug">
                {t('landing.getInvolved.helpCommunitiesLine1')}<br />{t('landing.getInvolved.helpCommunitiesLine2')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default GetInvolvedSection;

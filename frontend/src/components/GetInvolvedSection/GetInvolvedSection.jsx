import { useTranslation } from 'react-i18next';
import fireImg from '../../assets/hero_disaster_pictures/fire.jpeg';
import foodImg from '../../assets/hero_disaster_pictures/food.jpeg';
import rubbleImg from '../../assets/hero_disaster_pictures/rubble.jpg';

const GetInvolvedSection = () => {
  const { t } = useTranslation();

  const cards = [
    {
      image: fireImg,
      line1: t('landing.getInvolved.corporatePartnerLine1'),
      line2: t('landing.getInvolved.corporatePartnerLine2'),
      body: t('landing.getInvolved.corporatePartnerBody'),
      imageAlt: t('landing.getInvolved.corporatePartnerImageAlt'),
    },
    {
      image: foodImg,
      line1: t('landing.getInvolved.nonprofitNetworkLine1'),
      line2: t('landing.getInvolved.nonprofitNetworkLine2'),
      body: t('landing.getInvolved.nonprofitNetworkBody'),
      imageAlt: t('landing.getInvolved.nonprofitNetworkImageAlt'),
    },
    {
      image: rubbleImg,
      line1: t('landing.getInvolved.helpCommunitiesLine1'),
      line2: t('landing.getInvolved.helpCommunitiesLine2'),
      body: t('landing.getInvolved.helpCommunitiesBody'),
      imageAlt: t('landing.getInvolved.helpCommunitiesImageAlt'),
    },
  ];

  return (
    <section id="get-involved" className="py-24 bg-[#C1DAFF] dark:bg-[#1a2f3a] transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="text-4xl sm:text-5xl font-bold text-center mb-4 text-[#1C2A16] dark:text-white transition-colors duration-300">
          {t('landing.getInvolved.title')}
        </h2>
        <p className="text-center text-lg text-[#1C2A16] dark:text-gray-300 max-w-2xl mx-auto mb-16 transition-colors duration-300">
          {t('landing.getInvolved.subtitle')}
        </p>

        <div className="grid md:grid-cols-3 gap-8">
          {cards.map((card) => (
            <div
              key={card.line1}
              className="bg-[#e8e8e8] dark:bg-[#273A20] rounded-[2rem] overflow-hidden flex flex-col transition-colors duration-300"
            >
              <div className="h-72 overflow-hidden">
                <img
                  src={card.image}
                  alt={card.imageAlt}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="bg-[#1C2A16] dark:bg-[#0f1419] p-8 text-center flex flex-col flex-grow transition-colors duration-300">
                <p className="text-white text-xl font-medium leading-snug mb-3">
                  {card.line1}<br />{card.line2}
                </p>
                <p className="text-gray-300 text-sm leading-relaxed">
                  {card.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default GetInvolvedSection;

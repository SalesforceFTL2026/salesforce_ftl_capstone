import { useTranslation } from 'react-i18next';
import fireImg from '../../assets/hero_disaster_pictures/firerescue.jpeg';
import foodImg from '../../assets/hero_disaster_pictures/workers.jpg';
import rubbleImg from '../../assets/hero_disaster_pictures/foodbank.jpg';

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
    <section id="get-involved" className="py-24 bg-surface">
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="font-display text-4xl sm:text-5xl text-center mb-4 text-ink tracking-wide">
          {t('landing.getInvolved.title')}
        </h2>
        <p className="text-center text-lg text-ink-muted max-w-2xl mx-auto mb-16">
          {t('landing.getInvolved.subtitle')}
        </p>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {cards.map((card) => (
            <div
              key={card.line1}
              className="group rounded-3xl overflow-hidden flex flex-col shadow-card hover:shadow-card-hover ring-1 ring-hairline transition-shadow duration-300"
            >
              <div className="h-60 overflow-hidden">
                <img
                  src={card.image}
                  alt={card.imageAlt}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div className="bg-forest-900 dark:bg-surface-2 p-7 text-center flex flex-col flex-grow">
                <p className="font-display text-white dark:text-ink text-2xl leading-tight mb-3 tracking-wide">
                  {card.line1}<br />{card.line2}
                </p>
                <p className="text-forest-200 dark:text-ink-muted text-sm leading-relaxed">
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

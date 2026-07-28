import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import MRLogo from '../../assets/logos/MRLogo.png';
import fireImg from '../../assets/hero_disaster_pictures/fire.jpeg';
import floodImg from '../../assets/hero_disaster_pictures/flood.jpeg';
import rubbleImg from '../../assets/hero_disaster_pictures/rubble.jpg';
import foodImg from '../../assets/hero_disaster_pictures/food.jpeg';

// Imported so Vite bundles them and gives us resolved URLs. Add more here.
const disasterImages = [fireImg, floodImg, rubbleImg, foodImg];

const HeroSection = ({ onRoleSelect }) => {
  const { t } = useTranslation();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Rotate images every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prevIndex) =>
        (prevIndex + 1) % disasterImages.length
      );
    }, 5000);

    return () => clearInterval(interval);
  }, [disasterImages.length]);

  return (
    <section id="get-help" className="relative h-[480px] sm:h-[540px] md:h-[640px] flex items-center justify-center overflow-hidden">
      {/* Rotating disaster imagery — the emotional core of the page. Kept in both
          themes; dark mode just deepens the overlay so the scene stays visible
          instead of collapsing to a flat black block. */}
      <div className="absolute inset-0">
        {disasterImages.map((image, index) => (
          <div
            key={image}
            className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ${
              index === currentImageIndex ? 'opacity-100' : 'opacity-0'
            }`}
            style={{
              backgroundImage: `url(${image})`,
            }}
          />
        ))}
        {/* Forest-tinted overlay for text contrast — a brand gradient, not raw
            black. Darker in dark mode. */}
        <div className="absolute inset-0 bg-gradient-to-b from-forest-900/70 via-forest-900/55 to-forest-900/80 dark:from-forest-900/85 dark:via-forest-900/80 dark:to-black/90" />
      </div>

      {/* Content */}
      <div className="relative z-10 text-center px-4 sm:px-6 max-w-4xl mx-auto">
        {/* Heading */}
        <h1 className="font-display text-white mb-4 leading-none flex flex-col items-center justify-center gap-1">
          <span className="text-2xl sm:text-3xl md:text-4xl tracking-[0.2em] text-white/80">
            {t('landing.hero.welcomeTo')}
          </span>
          <img
            src={MRLogo}
            alt="MapResponse"
            className="h-16 sm:h-20 md:h-28 w-auto object-contain drop-shadow-lg mt-1"
          />
        </h1>

        {/* Subtitle */}
        <p className="text-base sm:text-lg md:text-xl text-white/90 font-normal max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed">
          {t('landing.hero.subtitle')}
        </p>

        {/* Role selection. "I need help" carries the coral accent — help-seekers
            are the priority audience; the other two are quiet outlines. */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center max-w-3xl mx-auto">
          <button
            onClick={() => onRoleSelect('help-seeker')}
            className="px-8 py-3.5 bg-pin-500 text-white text-base font-semibold rounded-full hover:bg-pin-600 transition-colors w-full sm:w-auto shadow-lg shadow-pin-600/30"
          >
            {t('landing.hero.needHelp')}
          </button>
          <button
            onClick={() => onRoleSelect('volunteer')}
            className="px-8 py-3.5 bg-white/10 backdrop-blur-sm text-white text-base font-semibold rounded-full ring-1 ring-white/40 hover:bg-white/20 transition-colors w-full sm:w-auto"
          >
            {t('landing.hero.volunteer')}
          </button>
          <button
            onClick={() => onRoleSelect('organization')}
            className="px-8 py-3.5 bg-white/10 backdrop-blur-sm text-white text-base font-semibold rounded-full ring-1 ring-white/40 hover:bg-white/20 transition-colors w-full sm:w-auto"
          >
            {t('landing.hero.organization')}
          </button>
        </div>
      </div>
    </section>
  );
}

export default HeroSection;

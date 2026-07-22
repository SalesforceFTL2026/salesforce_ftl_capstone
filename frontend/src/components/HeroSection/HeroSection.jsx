import { useState, useEffect } from 'react';
import MRLogo from '../../assets/logos/MRLogo.png';
import fireImg from '../../assets/hero_disaster_pictures/fire.jpeg';
import floodImg from '../../assets/hero_disaster_pictures/flood.jpeg';
import rubbleImg from '../../assets/hero_disaster_pictures/rubble.jpg';
import foodImg from '../../assets/hero_disaster_pictures/food.jpeg';

// Imported so Vite bundles them and gives us resolved URLs. Add more here.
const disasterImages = [fireImg, floodImg, rubbleImg, foodImg];

const HeroSection = ({ onRoleSelect }) => {
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
    <section className="relative h-[450px] sm:h-[500px] md:h-[600px] flex items-center justify-center overflow-hidden">
      {/* Light mode: Rotating Background Images with overlay */}
      <div className="absolute inset-0 dark:hidden">
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
        {/* Light mode overlay for text contrast */}
        <div className="absolute inset-0 bg-black/60" />
      </div>

      {/* Dark mode: Solid black background */}
      <div className="hidden dark:block absolute inset-0 bg-black" />

      {/* Content */}
      <div className="relative z-10 text-center px-4 sm:px-6 max-w-6xl mx-auto">
        {/* Heading */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-3 sm:mb-4 leading-tight flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
          <span>WELCOME TO</span>
          <img
            src={MRLogo}
            alt="MapResponse"
            className="h-12 sm:h-16 md:h-20 lg:h-24 w-auto object-contain"
          />
          <span>!</span>
        </h1>

        {/* Subtitle */}
        <p className="text-sm sm:text-base md:text-lg lg:text-xl text-white font-semibold mb-6 sm:mb-10 md:mb-12 tracking-wide px-2">
          A MAPPED NETWORK TO STREAMLINE ASSISTANCE FOR HELP SEEKERS FROM HELPERS.
        </p>

        {/* Role Selection Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center max-w-3xl mx-auto">
          <button
            onClick={() => onRoleSelect('help-seeker')}
            className="px-6 sm:px-8 md:px-10 py-3 bg-[#1C2A16] dark:bg-[#7F9764] text-white text-sm sm:text-base font-semibold rounded-full hover:opacity-90 transition-opacity w-full sm:w-auto shadow-lg"
          >
            I NEED HELP
          </button>
          <button
            onClick={() => onRoleSelect('volunteer')}
            className="px-6 sm:px-8 md:px-10 py-3 bg-[#1C2A16] dark:bg-[#7F9764] text-white text-sm sm:text-base font-semibold rounded-full hover:opacity-90 transition-opacity w-full sm:w-auto shadow-lg"
          >
            I WANT TO VOLUNTEER
          </button>
          <button
            onClick={() => onRoleSelect('organization')}
            className="px-6 sm:px-8 md:px-10 py-3 bg-[#1C2A16] dark:bg-[#7F9764] text-white text-sm sm:text-base font-semibold rounded-full hover:opacity-90 transition-opacity w-full sm:w-auto shadow-lg"
          >
            I'M AN ORGANIZATION
          </button>
        </div>
      </div>
    </section>
  );
}

export default HeroSection;

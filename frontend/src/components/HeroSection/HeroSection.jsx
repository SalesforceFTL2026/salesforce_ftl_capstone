import { useState, useEffect } from 'react';

const HeroSection = ({ onRoleSelect }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Array of disaster images - add more image paths here
  const disasterImages = [
    '/hero-disaster-1.jpg',
    '/hero-disaster-2.jpg',
    '/hero-disaster-3.jpg',
    '/hero-disaster-4.jpg',
  ];

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
        {/* Logo */}
        <div className="mb-4 sm:mb-6 flex items-center justify-center">
          <svg width="80" height="80" viewBox="0 0 120 120" className="sm:w-[120px] sm:h-[120px]">
            <circle cx="60" cy="60" r="55" fill="#a8c5a8" />
            <text x="60" y="50" textAnchor="middle" className="text-[#1e5a3a] font-bold" style={{ fontSize: '48px' }}>M</text>
            <text x="60" y="85" textAnchor="middle" className="text-[#c84444] font-bold" style={{ fontSize: '40px' }}>R</text>
            <circle cx="78" cy="35" r="10" fill="#c84444" />
          </svg>
        </div>

        {/* Heading */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-3 sm:mb-4 leading-tight">
          WELCOME TO{' '}
          <span className="block sm:inline-block mt-1 sm:mt-0">
            <span className="text-[#7F9764]">Map</span>
            <span className="text-[#E57373]">Response</span>!
          </span>
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

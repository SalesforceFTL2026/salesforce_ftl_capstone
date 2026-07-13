const StatCard = ({ number, description }) => {
  return (
    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 md:gap-8">
      <div className="w-24 h-24 sm:w-32 sm:h-32 md:w-36 md:h-36 bg-[#e8e8e8] dark:bg-[#1a2332] rounded-xl flex items-center justify-center flex-shrink-0 transition-colors duration-300">
        <div className="text-center">
          <p className="text-xs text-gray-600 dark:text-gray-400 leading-tight transition-colors duration-300">
            GRAPHIC<br />
            PERTAINING TO<br />
            FACT
          </p>
        </div>
      </div>
      <div className="text-center sm:text-left">
        <h3 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white dark:text-[#B0BF9F] mb-1 transition-colors duration-300">
          STATISTIC #{number}
        </h3>
        <p className="text-base sm:text-lg md:text-xl text-white dark:text-[#B0BF9F] transition-colors duration-300">Fact</p>
      </div>
    </div>
  );
}

export default StatCard;

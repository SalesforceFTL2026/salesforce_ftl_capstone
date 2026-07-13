function PartnerSection() {
  return (
    <section className="py-20 bg-white dark:bg-black transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="text-4xl font-bold text-center mb-16 text-[#1C2A16] dark:text-white transition-colors duration-300">
          THANK YOU TO OUR PARTNERS FOR YOUR SUPPORT!
        </h2>

        <div className="flex flex-wrap justify-center items-center gap-6 max-w-5xl mx-auto">
          {[...Array(7)].map((_, i) => (
            <div
              key={i}
              className="w-28 h-28 bg-[#d4d4d4] dark:bg-[#1a2332] flex items-center justify-center transition-colors duration-300"
            >
              <span className="text-gray-500 dark:text-gray-400 text-xs transition-colors duration-300">Logo</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default PartnerSection;

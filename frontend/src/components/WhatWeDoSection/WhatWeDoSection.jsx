function WhatWeDoSection() {
  return (
    <section className="py-24 bg-[#7F9764] dark:bg-[#1a2f1a] transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left: Vertical Card */}
          <div className="bg-[#e8e8e8] dark:bg-[#273A20] rounded-[2rem] p-8 flex flex-col transition-colors duration-300">
            <h3 className="text-3xl font-bold text-black dark:text-white mb-6 transition-colors duration-300">Title</h3>

            <div className="bg-[#d4d4d4] dark:bg-[#1a2332] rounded-2xl h-56 mb-6 flex items-center justify-center transition-colors duration-300">
              <span className="text-gray-600 dark:text-gray-400 text-sm transition-colors duration-300">GRAPHIC</span>
            </div>

            <p className="text-gray-800 dark:text-gray-300 mb-8 flex-grow leading-relaxed transition-colors duration-300">
              Description
            </p>

            <button className="bg-[#1C2A16] dark:bg-[#273A20] text-white px-6 py-3 rounded-xl font-medium hover:bg-[#2a3f2a] dark:hover:bg-[#344a30] transition-colors self-start">
              LEARN MORE
            </button>
          </div>

          {/* Right: Two Horizontal Cards */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-[#e8e8e8] dark:bg-[#273A20] rounded-[2rem] p-8 flex flex-col md:flex-row items-center gap-8 transition-colors duration-300">
              <div className="bg-[#d4d4d4] dark:bg-[#1a2332] rounded-2xl w-full md:w-80 h-56 flex items-center justify-center flex-shrink-0 transition-colors duration-300">
                <span className="text-gray-600 dark:text-gray-400 text-sm transition-colors duration-300">GRAPHIC</span>
              </div>
              <div className="flex-grow flex items-center">
                <button className="bg-[#1C2A16] dark:bg-[#273A20] text-white px-6 py-3 rounded-xl font-medium hover:bg-[#2a3f2a] dark:hover:bg-[#344a30] transition-colors">
                  LEARN MORE
                </button>
              </div>
            </div>

            <div className="bg-[#e8e8e8] dark:bg-[#273A20] rounded-[2rem] p-8 flex flex-col md:flex-row items-center gap-8 transition-colors duration-300">
              <div className="bg-[#d4d4d4] dark:bg-[#1a2332] rounded-2xl w-full md:w-80 h-56 flex items-center justify-center flex-shrink-0 transition-colors duration-300">
                <span className="text-gray-600 dark:text-gray-400 text-sm transition-colors duration-300">GRAPHIC</span>
              </div>
              <div className="flex-grow flex items-center">
                <button className="bg-[#1C2A16] dark:bg-[#273A20] text-white px-6 py-3 rounded-xl font-medium hover:bg-[#2a3f2a] dark:hover:bg-[#344a30] transition-colors">
                  LEARN MORE
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default WhatWeDoSection;

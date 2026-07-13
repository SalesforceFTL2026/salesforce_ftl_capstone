function MapResponseOneLiner() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <section className="bg-gradient-to-r from-[#273A20] via-[#4a6a3a] to-[#7F9764] dark:from-[#0f1419] dark:via-[#1a2332] dark:to-[#273A20] py-16 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between">
          <h2 className="text-4xl font-bold text-white max-w-3xl">
            MAP RESPONSE ONE-LINER
          </h2>
          <button
            onClick={scrollToTop}
            className="w-16 h-16 bg-[#6ba3d3] rounded-full flex items-center justify-center hover:bg-[#5a92c2] transition-colors flex-shrink-0 ml-4"
            aria-label="Scroll to top"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}

export default MapResponseOneLiner;

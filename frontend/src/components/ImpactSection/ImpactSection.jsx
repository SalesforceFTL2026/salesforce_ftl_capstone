import StatCard from '../StatCard/StatCard';

function ImpactSection() {
  const stats = [
    { number: 1, description: 'Fact' },
    { number: 2, description: 'Fact' },
  ];

  return (
    <section className="py-12 sm:py-16 md:py-20 lg:py-24 bg-[#7F9764] dark:bg-[#273A20] transition-colors duration-300">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-10 sm:mb-16 md:mb-20 text-white dark:text-[#B0BF9F] transition-colors duration-300">
          OUR 2026 IMPACT
        </h2>

        <div className="space-y-8 sm:space-y-12 md:space-y-16">
          {stats.map((stat) => (
            <StatCard
              key={stat.number}
              number={stat.number}
              description={stat.description}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export default ImpactSection;

import { useState } from 'react';
import Header from '../components/Header/Header';
import HeroSection from '../components/HeroSection/HeroSection';
import ImpactSection from '../components/ImpactSection/ImpactSection';
import WhatWeDoSection from '../components/WhatWeDoSection/WhatWeDoSection';
import GetInvolvedSection from '../components/GetInvolvedSection/GetInvolvedSection';
import PartnerSection from '../components/PartnerSection/PartnerSection';
import MapResponseOneLiner from '../components/MapResponseOneLiner/MapResponseOneLiner';
import Footer from '../components/Footer/Footer';
import RoleSelectionModal from '../components/RoleSelectionModal/RoleSelectionModal';

function LandingPage() {
  const [selectedRole, setSelectedRole] = useState(null);

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
  };

  const handleModalClose = () => {
    setSelectedRole(null);
  };

  const handleFormSubmit = (userData) => {
    console.log('User data:', userData);
    // TODO: Navigate to appropriate page based on role
    // For now, just close the modal
    setSelectedRole(null);
  };

  return (
    <div className="min-h-screen">
      <Header />
      <div className="pt-[70px]">
        <HeroSection onRoleSelect={handleRoleSelect} />
        <ImpactSection />
        <WhatWeDoSection />
        <GetInvolvedSection />
        <PartnerSection />
        <MapResponseOneLiner />
        <Footer />
      </div>

      {selectedRole && (
        <RoleSelectionModal
          role={selectedRole}
          onClose={handleModalClose}
          onSubmit={handleFormSubmit}
        />
      )}
    </div>
  );
}

export default LandingPage;

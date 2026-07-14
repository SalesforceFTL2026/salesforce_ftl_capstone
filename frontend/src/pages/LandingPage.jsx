import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header/Header';
import HeroSection from '../components/HeroSection/HeroSection';
import ImpactSection from '../components/ImpactSection/ImpactSection';
import WhatWeDoSection from '../components/WhatWeDoSection/WhatWeDoSection';
import GetInvolvedSection from '../components/GetInvolvedSection/GetInvolvedSection';
import PartnerSection from '../components/PartnerSection/PartnerSection';
import MapResponseOneLiner from '../components/MapResponseOneLiner/MapResponseOneLiner';
import Footer from '../components/Footer/Footer';
import RoleSelectionModal from '../components/RoleSelectionModal/RoleSelectionModal';
import SignInModal from '../components/SignInModal/SignInModal';
import { pathForRole } from '../utils/roleRedirect';
import { getCurrentUser, logout } from '../utils/auth';

const LandingPage = () => {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState(null);
  const [showSignIn, setShowSignIn] = useState(false);
  // Seed from storage so a page refresh keeps the user signed in.
  const [currentUser, setCurrentUser] = useState(getCurrentUser);

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
  };

  const handleModalClose = () => {
    setSelectedRole(null);
  };

  // A new user registered and was signed in. Route them by role.
  const handleFormSubmit = (user) => {
    setSelectedRole(null);
    goToRoleHome(user);
  };

  // A returning user signed in. Route them by role.
  const handleSignInSuccess = (user) => {
    setShowSignIn(false);
    goToRoleHome(user);
  };

  // Role comes from the server on the user object, never chosen in the UI, so
  // we route based on it. Shared by both sign-up and sign-in.
  const goToRoleHome = (user) => {
    setCurrentUser(user);
    navigate(pathForRole(user.role));
  };

  // Clear the stored session and update the UI back to signed-out.
  const handleLogout = () => {
    logout();
    setCurrentUser(null);
  };

  return (
    <div className="min-h-screen">
      <Header
        currentUser={currentUser}
        onSignInClick={() => setShowSignIn(true)}
        onSignOutClick={handleLogout}
      />
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

      {showSignIn && (
        <SignInModal
          onClose={() => setShowSignIn(false)}
          onSuccess={handleSignInSuccess}
        />
      )}
    </div>
  );
}

export default LandingPage;

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
import AuthModal from '../components/AuthModal/AuthModal';
import { pathForRole } from '../utils/roleRedirect';
import { getCurrentUser, logout } from '../utils/auth';

const LandingPage = () => {
  // Which auth popup to show. null = closed. Otherwise { role, mode }.
  // role labels the signup form; mode is which tab opens first ('signup'|'login').
  const [authModal, setAuthModal] = useState(null);
  // Seed from storage so a page refresh keeps the user signed in.
  const [currentUser, setCurrentUser] = useState(getCurrentUser);
  const navigate = useNavigate();

  // Clicking a role card opens the auth popup on the Sign Up tab.
  const handleRoleSelect = (role) => {
    setAuthModal({ role, mode: 'signup' });
  };

  // The header "Sign In" opens the popup on the Log In tab (no role needed).
  const handleSignInClick = () => {
    setAuthModal({ role: null, mode: 'login' });
  };

  const closeAuthModal = () => setAuthModal(null);

  // Fired on successful signup OR login. Route by the account's role.
  // Role comes from the server on the user object, never chosen in the UI.
  const handleAuthenticated = (user) => {
    setAuthModal(null);
    setCurrentUser(user);
    const destination = pathForRole(user.role);
    navigate(destination);
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
        onSignInClick={handleSignInClick}
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

      {authModal && (
        <AuthModal
          role={authModal.role}
          initialMode={authModal.mode}
          onClose={closeAuthModal}
          onAuthenticated={handleAuthenticated}
        />
      )}
    </div>
  );
}

export default LandingPage;

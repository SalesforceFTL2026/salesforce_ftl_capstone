import { useEffect, useRef } from 'react';

// Renders Google's official "Sign in with Google" button using Google Identity
// Services (the popup / ID-token flow — no redirect, no client secret). When
// the user finishes the Google popup, `onCredential` is called with the ID
// token string, which the caller sends to POST /api/auth/google.
//
// Renders nothing if VITE_GOOGLE_CLIENT_ID isn't configured, so the app still
// works (password auth only) in an environment without Google set up.
//
// @param {(idToken: string) => void} onCredential - receives the Google ID token
const GIS_SRC = 'https://accounts.google.com/gsi/client';

const GoogleSignInButton = ({ onCredential }) => {
  const containerRef = useRef(null);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  // Keep the latest callback in a ref so re-renders don't re-init Google.
  const onCredentialRef = useRef(onCredential);
  onCredentialRef.current = onCredential;

  useEffect(() => {
    if (!clientId || !containerRef.current) return undefined;

    let cancelled = false;

    // Initialize GIS and paint the button into our container.
    const renderButton = () => {
      if (cancelled || !window.google?.accounts?.id || !containerRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => onCredentialRef.current?.(response.credential),
      });
      window.google.accounts.id.renderButton(containerRef.current, {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'pill',
        width: 320,
      });
    };

    // Script already present (another button mounted earlier)?
    if (window.google?.accounts?.id) {
      renderButton();
      return () => { cancelled = true; };
    }

    // Load the GIS script once, shared across the app.
    let script = document.getElementById('google-gis-script');
    if (!script) {
      script = document.createElement('script');
      script.id = 'google-gis-script';
      script.src = GIS_SRC;
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
    script.addEventListener('load', renderButton);

    return () => {
      cancelled = true;
      script.removeEventListener('load', renderButton);
    };
  }, [clientId]);

  // No client id configured -> render nothing (password auth still works).
  if (!clientId) return null;

  return <div ref={containerRef} className="flex justify-center" />;
};

export default GoogleSignInButton;

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { updateName, updatePhone, updateLanguage, uploadAvatar } from '../../utils/auth';
import { SUPPORTED_LANGUAGES } from '../../i18n';

// Shared account settings for the org & volunteer portals: profile picture,
// display name, phone number, and language. The help-seeker portal has its own
// copy of this block that also includes household size, which doesn't apply to
// organizations or volunteers. All fields write to the User model via
// utils/auth and call onUserChange so the parent (greeting, profile card)
// updates live after a save.
const AccountSettings = ({ currentUser, onUserChange }) => {
  // t() looks up UI text in the active language; changing the language
  // re-renders this component with the translated strings.
  const { t } = useTranslation();

  // Display name, plus save state and feedback messages.
  const [nameInput, setNameInput] = useState(currentUser?.name || '');
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState('');
  const [nameSaved, setNameSaved] = useState(false);

  // Phone number, plus save state and feedback.
  const [phoneInput, setPhoneInput] = useState(currentUser?.phoneNumber || '');
  const [savingPhone, setSavingPhone] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [phoneSaved, setPhoneSaved] = useState(false);

  // Language save state and feedback.
  const [savingLanguage, setSavingLanguage] = useState(false);
  const [languageError, setLanguageError] = useState('');
  const [languageSaved, setLanguageSaved] = useState(false);

  // Profile picture. avatarUrl is a short-lived signed URL from S3.
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatarUrl || '');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState('');

  // Save the chosen UI language to the user's profile and switch the live UI.
  const handleChangeLanguage = async (e) => {
    const lang = e.target.value;
    setLanguageError('');
    setLanguageSaved(false);
    setSavingLanguage(true);
    try {
      const updated = await updateLanguage(lang);
      onUserChange(updated);
      setLanguageSaved(true);
    } catch (err) {
      setLanguageError(
        err.response?.data?.message || err.message || t('settings.languageUpdateError'),
      );
    } finally {
      setSavingLanguage(false);
    }
  };

  // Upload a chosen image as the profile picture. uploadAvatar persists the
  // signed URL to the session; here we just reflect it in local state.
  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError('');
    setUploadingAvatar(true);
    try {
      const url = await uploadAvatar(file);
      setAvatarUrl(url);
      onUserChange({ ...currentUser, avatarUrl: url });
    } catch (err) {
      setAvatarError(err.response?.data?.message || err.message || 'Could not upload your photo.');
    } finally {
      setUploadingAvatar(false);
      e.target.value = ''; // let the user re-pick the same file if they want
    }
  };

  // Save the edited display name, then update the live session so the greeting
  // and profile card reflect it immediately.
  const handleSaveName = async (e) => {
    e.preventDefault();
    const trimmed = nameInput.trim();
    setNameError('');
    setNameSaved(false);

    if (!trimmed) {
      setNameError('Name must not be empty.');
      return;
    }
    if (trimmed === currentUser?.name) {
      return; // nothing changed
    }

    setSavingName(true);
    try {
      const updated = await updateName(trimmed);
      onUserChange(updated);
      setNameSaved(true);
    } catch (err) {
      setNameError(err.response?.data?.message || err.message || 'Could not update your name.');
    } finally {
      setSavingName(false);
    }
  };

  // Save the edited phone number, then update the live session. An empty value
  // clears the saved number.
  const handleSavePhone = async (e) => {
    e.preventDefault();
    const trimmed = phoneInput.trim();
    setPhoneError('');
    setPhoneSaved(false);

    if (trimmed === (currentUser?.phoneNumber || '')) {
      return; // nothing changed
    }

    setSavingPhone(true);
    try {
      const updated = await updatePhone(trimmed);
      onUserChange(updated);
      setPhoneSaved(true);
    } catch (err) {
      setPhoneError(
        err.response?.data?.message || err.message || t('settings.phoneUpdateError'),
      );
    } finally {
      setSavingPhone(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl sm:text-3xl font-bold text-[#1C2A16] dark:text-white mb-1">
        {t('settings.title')}
      </h2>
      <p className="text-gray-600 dark:text-gray-300 mb-6">
        {t('settings.subtitle')}
      </p>

      {/* Profile picture: uploaded to S3, displayed via a short-lived signed URL. */}
      <div className="bg-white dark:bg-[#16233a] rounded-3xl shadow-md p-6 mb-6 flex items-center gap-5">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt="Profile"
            className="w-20 h-20 rounded-full object-cover border-2 border-gray-200 dark:border-[#3a4f30] bg-gray-100"
          />
        ) : (
          <div className="w-20 h-20 rounded-full border-2 border-gray-200 dark:border-[#3a4f30] bg-gray-100 dark:bg-[#1a2f1a] flex items-center justify-center text-2xl font-bold text-gray-400">
            {(currentUser?.name || '?').charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <label className="block text-sm font-bold text-gray-800 dark:text-gray-200 mb-2">
            Profile picture
          </label>
          <label className="inline-block px-6 py-2.5 bg-[#1a2740] text-white font-bold rounded-full hover:bg-[#14203a] cursor-pointer transition-colors">
            {uploadingAvatar ? 'Uploading…' : 'Change photo'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleAvatarChange}
              disabled={uploadingAvatar}
              className="hidden"
            />
          </label>
          {avatarError && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">{avatarError}</p>
          )}
        </div>
      </div>

      <form
        onSubmit={handleSaveName}
        className="bg-white dark:bg-[#16233a] rounded-3xl shadow-md p-6"
      >
        <label
          htmlFor="displayName"
          className="block text-sm font-bold text-gray-800 dark:text-gray-200 mb-2"
        >
          {t('settings.displayName')}
        </label>
        <input
          id="displayName"
          type="text"
          value={nameInput}
          onChange={(e) => {
            setNameInput(e.target.value);
            setNameError('');
            setNameSaved(false);
          }}
          placeholder={t('settings.namePlaceholder')}
          className="w-full px-4 py-3 rounded-xl border-2 border-gray-300 dark:border-[#3a4f30] bg-white dark:bg-[#1a2f1a] text-gray-900 dark:text-white focus:outline-none focus:border-[#6ba3d3] focus:ring-2 focus:ring-[#6ba3d3]/30 transition-all"
        />

        {nameError && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{nameError}</p>
        )}
        {nameSaved && (
          <p className="mt-3 text-sm text-green-700 dark:text-green-400">
            {t('settings.nameUpdated')}
          </p>
        )}

        <button
          type="submit"
          disabled={savingName || !nameInput.trim() || nameInput.trim() === currentUser?.name}
          className="mt-5 px-8 py-3 bg-[#1a2740] text-white font-bold rounded-full hover:bg-[#14203a] focus:outline-none focus:ring-2 focus:ring-[#1a2740]/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {savingName ? t('settings.saving') : t('settings.saveChanges')}
        </button>
      </form>

      {/* Phone number: shown to help-seekers/responders so they can be reached.
          Optional — clearing the field removes it. */}
      <form
        onSubmit={handleSavePhone}
        className="bg-white dark:bg-[#16233a] rounded-3xl shadow-md p-6 mt-6"
      >
        <label
          htmlFor="phoneNumber"
          className="block text-sm font-bold text-gray-800 dark:text-gray-200 mb-2"
        >
          {t('settings.phoneNumber')}
        </label>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          {t('settings.phoneHelp')}
        </p>
        <input
          id="phoneNumber"
          type="tel"
          value={phoneInput}
          onChange={(e) => {
            setPhoneInput(e.target.value);
            setPhoneError('');
            setPhoneSaved(false);
          }}
          placeholder={t('settings.phonePlaceholder')}
          className="w-full px-4 py-3 rounded-xl border-2 border-gray-300 dark:border-[#3a4f30] bg-white dark:bg-[#1a2f1a] text-gray-900 dark:text-white focus:outline-none focus:border-[#6ba3d3] focus:ring-2 focus:ring-[#6ba3d3]/30 transition-all"
        />

        {phoneError && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{phoneError}</p>
        )}
        {phoneSaved && (
          <p className="mt-3 text-sm text-green-700 dark:text-green-400">
            {t('settings.phoneUpdated')}
          </p>
        )}

        <button
          type="submit"
          disabled={savingPhone || phoneInput.trim() === (currentUser?.phoneNumber || '')}
          className="mt-5 px-8 py-3 bg-[#1a2740] text-white font-bold rounded-full hover:bg-[#14203a] focus:outline-none focus:ring-2 focus:ring-[#1a2740]/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {savingPhone ? t('settings.saving') : t('settings.saveChanges')}
        </button>
      </form>

      {/* Language preference: switching this instantly re-renders the UI in the
          chosen language and saves the choice to the user's profile so it
          follows them across devices. */}
      <div className="bg-white dark:bg-[#16233a] rounded-3xl shadow-md p-6 mt-6">
        <label
          htmlFor="language"
          className="block text-sm font-bold text-gray-800 dark:text-gray-200 mb-2"
        >
          {t('settings.language')}
        </label>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          {t('settings.languageHelp')}
        </p>
        <select
          id="language"
          value={currentUser?.languagePreference || 'en'}
          onChange={handleChangeLanguage}
          disabled={savingLanguage}
          className="w-full px-4 py-3 rounded-xl border-2 border-gray-300 dark:border-[#3a4f30] bg-white dark:bg-[#1a2f1a] text-gray-900 dark:text-white focus:outline-none focus:border-[#6ba3d3] focus:ring-2 focus:ring-[#6ba3d3]/30 transition-all disabled:opacity-50"
        >
          {SUPPORTED_LANGUAGES.map((lang) => (
            <option key={lang} value={lang}>
              {t(`languages.${lang}`)}
            </option>
          ))}
        </select>

        {languageError && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{languageError}</p>
        )}
        {languageSaved && (
          <p className="mt-3 text-sm text-green-700 dark:text-green-400">
            {t('settings.languageUpdated')}
          </p>
        )}
      </div>
    </div>
  );
};

export default AccountSettings;

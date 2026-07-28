// Shared profile-picture uploader used by every portal's Settings view.
// Shows the current avatar (or an initial-letter placeholder), lets the user
// pick a new image, uploads it to S3 via the backend, and reports the fresh
// signed URL back to the parent so the live session updates.
//
// @param {object} currentUser - the signed-in user (for name initial + avatarUrl)
// @param {(avatarUrl: string) => void} onUploaded - called with the new signed URL
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { uploadAvatar } from '../../utils/auth';

const AvatarUploader = ({ currentUser, onUploaded }) => {
  const { t } = useTranslation();
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatarUrl || '');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const url = await uploadAvatar(file);
      setAvatarUrl(url);
      onUploaded?.(url);
    } catch (err) {
      setError(err.response?.data?.message || err.message || t('settings.avatarUploadError'));
    } finally {
      setUploading(false);
      e.target.value = ''; // let the user re-pick the same file if they want
    }
  };

  return (
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
          {t('settings.profilePicture')}
        </label>
        <label className="inline-block px-6 py-2.5 bg-[#1a2740] text-white font-bold rounded-full hover:bg-[#14203a] cursor-pointer transition-colors">
          {uploading ? t('settings.uploading') : t('settings.changePhoto')}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleChange}
            disabled={uploading}
            className="hidden"
          />
        </label>
        {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </div>
  );
};

export default AvatarUploader;

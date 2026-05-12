/**
 * vault.js — Encrypted BYOK API Key with PIN for cross-page usage
 * Uses AES encryption via CryptoJS.
 */
const Vault = (() => {
  const STORAGE_KEY = 'vault_gemini_key_v1';
  const SESSION_KEY = 'vault_unlocked_key_v1';

  function hasStoredKey() { return !!localStorage.getItem(STORAGE_KEY); }
  function isUnlocked() { return !!sessionStorage.getItem(SESSION_KEY); }
  function getUnlockedKey() { return sessionStorage.getItem(SESSION_KEY); }

  function saveKey(apiKey, pin) {
    try {
      const encrypted = CryptoJS.AES.encrypt(apiKey, _pinToPassphrase(pin)).toString();
      localStorage.setItem(STORAGE_KEY, encrypted);
      sessionStorage.setItem(SESSION_KEY, apiKey);
      return true;
    } catch (e) { return false; }
  }

  function loadKey(pin) {
    const cipher = localStorage.getItem(STORAGE_KEY);
    if (!cipher) return null;
    try {
      const bytes  = CryptoJS.AES.decrypt(cipher, _pinToPassphrase(pin));
      const result = bytes.toString(CryptoJS.enc.Utf8);
      if (!result || result.length < 20) return null;
      sessionStorage.setItem(SESSION_KEY, result);
      return result;
    } catch (e) { return null; }
  }

  function clearKey() {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  }

  function _pinToPassphrase(pin) { return `vault::${pin}::2026::v1`; }

  return { hasStoredKey, isUnlocked, getUnlockedKey, saveKey, loadKey, clearKey };
})();

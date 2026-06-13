const Lang = (() => {
  const KEY = 'global_lang';
  
  function get() {
    return localStorage.getItem(KEY) || 'en';
  }
  
  function set(lang) {
    localStorage.setItem(KEY, lang);
    apply();
    window.dispatchEvent(new CustomEvent('langchange', { detail: lang }));
  }
  
  function apply() {
    const lang = get();
    document.querySelectorAll('[data-en][data-es]').forEach(el => {
      el.textContent = el.getAttribute('data-' + lang);
    });
    document.querySelectorAll('input[data-placeholder-en][data-placeholder-es]').forEach(el => {
      el.placeholder = el.getAttribute('data-placeholder-' + lang);
    });
    document.querySelectorAll('.lang-select').forEach(select => {
      select.value = lang;
    });
    document.documentElement.lang = lang;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    apply();
  }

  return { get, set, apply };
})();

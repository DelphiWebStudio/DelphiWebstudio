(function () {
  'use strict';

  if (window.webstudioTranslationReady) return;
  window.webstudioTranslationReady = true;

  function initializeTranslationSelector() {
    var wrapper = document.querySelector('.gtranslate_wrapper');
    if (!wrapper) return;

    var aliases = { iw: 'he', jw: 'jv', tl: 'fil' };
    var names = { 'zh-CN': 'Chinese, Simplified', 'zh-TW': 'Chinese, Traditional' };
    var englishNames = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['en'], { type: 'language' }) : null;
    var rightToLeft = new Set(['ar', 'ckb', 'dv', 'fa', 'he', 'iw', 'ps', 'sd', 'ug', 'ur', 'yi']);
    var originalLanguage = (window.gtranslateSettings && window.gtranslateSettings.default_language) || document.documentElement.lang || 'en';

    function synchronizeDirection() {
      var selected = wrapper.querySelector('a[data-gt-lang][aria-current="true"], .gt_options a.gt-current[data-gt-lang], .gt-selected a[data-gt-lang], .gt-current-lang[data-gt-lang]');
      var cookie = document.cookie.match(/(?:^|;\s*)googtrans=\/[^/;]+\/([^;]+)/);
      var savedLanguage = '';
      try { savedLanguage = cookie ? decodeURIComponent(cookie[1]) : ''; } catch { /* Ignore a malformed cookie. */ }
      var language = ((selected && selected.dataset.gtLang) || savedLanguage || originalLanguage).trim().replace('_', '-');
      var direction = rightToLeft.has(language.split('-')[0].toLowerCase()) ? 'rtl' : 'ltr';
      var previousLanguage = document.documentElement.dataset.translationLanguage;
      document.documentElement.dir = direction;
      document.documentElement.dataset.translationDirection = direction;
      document.documentElement.dataset.translationLanguage = language;
      if (previousLanguage !== language) window.dispatchEvent(new Event('webstudio.translationchange'));
    }

    function updateLanguageLabels() {
      wrapper.querySelectorAll('a[data-gt-lang]').forEach(function (link) {
        if (link.dataset.bilingualLabel === 'true') return;
        var code = link.dataset.gtLang;
        var nativeName = link.textContent.trim();
        var englishName = names[code] || code;
        if (!names[code] && englishNames) {
          try { englishName = englishNames.of(aliases[code] || code) || code; } catch { /* Keep the language code fallback. */ }
        }
        var label = englishName.toLocaleLowerCase('en') === nativeName.toLocaleLowerCase('en') ? englishName : englishName + ' (' + nativeName + ')';
        var flag = link.querySelector('img');
        link.dataset.bilingualLabel = 'true';
        link.setAttribute('aria-label', label);
        link.replaceChildren(flag ? flag.cloneNode(true) : document.createTextNode(''), document.createTextNode(label));
      });
      wrapper.querySelectorAll('.gt_options').forEach(function (list) {
        var current = Array.from(list.children).filter(function (item) { return item.matches('a[data-gt-lang]'); });
        var sorted = current.slice().sort(function (first, second) { return first.textContent.trim().localeCompare(second.textContent.trim(), 'en'); });
        if (sorted.some(function (item, index) { return item !== current[index]; })) sorted.forEach(function (item) { list.appendChild(item); });
      });
      synchronizeDirection();
    }

    new MutationObserver(updateLanguageLabels).observe(wrapper, { attributes: true, childList: true, subtree: true });
    // The vendor's lazy loader treats a focus/entry event as a callback after
    // its library is loaded. Skip only that redundant wrapper-level request.
    function skipLoadedLibraryRequest(event) {
      if (window.gt_translate_script && (event.type === 'focusin' || event.target === wrapper)) event.stopImmediatePropagation();
    }
    wrapper.addEventListener('focusin', skipLoadedLibraryRequest, true);
    wrapper.addEventListener('pointerenter', skipLoadedLibraryRequest, true);
    wrapper.addEventListener('click', function (event) {
      var choice = event.target && typeof event.target.closest === 'function' ? event.target.closest('a[data-gt-lang]') : null;
      if (!choice) return;
      window.setTimeout(synchronizeDirection, 100);
      window.setTimeout(synchronizeDirection, 750);
      window.setTimeout(synchronizeDirection, 1500);
    });
    updateLanguageLabels();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializeTranslationSelector, { once: true });
  else initializeTranslationSelector();
}());

/**
 * @file i18n.js
 * @description Module multilingue vanilla pour Transkryptor.
 * Sans dépendance externe. Expose window.i18n = { t, setLanguage, getLanguage, ready }.
 *
 * Conventions DOM :
 *   - <span data-i18n="my.key">FR fallback</span>           => textContent
 *   - data-i18n-attr-placeholder="my.key"                   => setAttribute('placeholder', ...)
 *   - data-i18n-attr-title="my.key"                         => setAttribute('title', ...)
 *   - data-i18n-attr-aria-label="my.key"                    => setAttribute('aria-label', ...)
 *   - data-i18n-attr-value="my.key"                         => setAttribute('value', ...)
 */
(function () {
    const STORAGE_KEY = 'transkryptor.ui.language';
    const SUPPORTED = ['fr', 'en'];
    const DEFAULT_LANG = 'fr';

    const translations = { fr: null, en: null };
    let currentLang = DEFAULT_LANG;

    function normalizeSupportedLanguage(value) {
        if (!value) return null;
        const lang = String(value).trim().toLowerCase();
        const primary = lang.split(/[-_]/)[0];
        return SUPPORTED.includes(primary) ? primary : null;
    }

    function detectLanguage() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const urlLang = normalizeSupportedLanguage(urlParams.get('lang'));
            if (urlLang) return urlLang;
        } catch (_) {}

        try {
            const stored = normalizeSupportedLanguage(localStorage.getItem(STORAGE_KEY));
            if (stored) return stored;
        } catch (_) {}

        const browserLanguages = [
            ...Array.from(navigator.languages || []),
            navigator.language,
            navigator.userLanguage,
        ];
        for (const browserLang of browserLanguages) {
            const supportedLang = normalizeSupportedLanguage(browserLang);
            if (supportedLang) return supportedLang;
        }

        return DEFAULT_LANG;
    }

    function resolveKey(obj, key) {
        if (!obj) return undefined;
        const parts = key.split('.');
        let cur = obj;
        for (const part of parts) {
            if (cur && typeof cur === 'object' && part in cur) {
                cur = cur[part];
            } else {
                return undefined;
            }
        }
        return cur;
    }

    function interpolate(str, vars) {
        if (!vars || typeof str !== 'string') return str;
        return str.replace(/\{([^}]+)\}/g, (match, name) => {
            const value = vars[name.trim()];
            return value === undefined || value === null ? match : String(value);
        });
    }

    function t(key, vars) {
        const dict = translations[currentLang] || translations[DEFAULT_LANG];
        const value = resolveKey(dict, key);
        if (typeof value !== 'string') {
            const fallback = resolveKey(translations[DEFAULT_LANG], key);
            if (typeof fallback === 'string') return interpolate(fallback, vars);
            return key;
        }
        return interpolate(value, vars);
    }

    const ATTR_TARGETS = ['placeholder', 'title', 'aria-label', 'value'];

    function applyToDom() {
        const elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (!key) return;
            el.textContent = t(key);
        });

        const attrSelector = ATTR_TARGETS.map(a => `[data-i18n-attr-${a}]`).join(',');
        document.querySelectorAll(attrSelector).forEach(el => {
            for (const targetAttr of ATTR_TARGETS) {
                const key = el.getAttribute(`data-i18n-attr-${targetAttr}`);
                if (key) el.setAttribute(targetAttr, t(key));
            }
        });

        if (document.title !== undefined) {
            const brand = document.documentElement.getAttribute('data-brand');
            const dict = translations[currentLang];
            const brandTitle = brand === 'cloud-temple'
                ? resolveKey(dict, 'page.titleCloudTemple')
                : null;
            const titleValue = (typeof brandTitle === 'string' && brandTitle)
                ? brandTitle
                : resolveKey(dict, 'page.title');
            if (typeof titleValue === 'string') document.title = titleValue;
        }

        document.documentElement.setAttribute('lang', currentLang);
    }

    async function loadLocales() {
        const [fr, en] = await Promise.all([
            fetch('/i18n/fr.json', { cache: 'no-cache' }).then(r => r.json()),
            fetch('/i18n/en.json', { cache: 'no-cache' }).then(r => r.json()),
        ]);
        translations.fr = fr;
        translations.en = en;
    }

    function setLanguage(lang) {
        if (!SUPPORTED.includes(lang)) return;
        currentLang = lang;
        try { localStorage.setItem(STORAGE_KEY, lang); } catch (_) {}
        applyToDom();
        window.dispatchEvent(new CustomEvent('i18nchange', { detail: { lang } }));
    }

    function getLanguage() {
        return currentLang;
    }

    const ready = (async () => {
        await loadLocales();
        currentLang = detectLanguage();
        if (document.readyState === 'loading') {
            await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
        }
        applyToDom();
    })();

    window.i18n = { t, setLanguage, getLanguage, ready };
})();

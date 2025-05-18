import { I18nStringKey, TheI18n } from './i18n.js';
import { elements } from './dom.js';

let darkTheme = true;

export function getDarkTheme() {
    return darkTheme;
}

export function setDarkTheme(dark: boolean) {
    darkTheme = dark;
}

export function loadColorTheme(dark: boolean) {
    darkTheme = dark;
    const rootEl = document.documentElement;
    const { toggleThemeBtnText: textEl, toggleThemeIcon: iconEl } = elements;

    rootEl.setAttribute("data-bs-theme", dark ? "dark" : "light");
    textEl.innerHTML = TheI18n.GetString(
        dark
            ? I18nStringKey.kSiteButtons_LightMode
            : I18nStringKey.kSiteButtons_DarkMode
    );
    iconEl.classList.toggle("fa-moon", !dark);
    iconEl.classList.toggle("fa-sun", dark);
}
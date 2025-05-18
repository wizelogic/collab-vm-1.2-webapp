import Config from '../../config.json';
import { getActiveVM, getAuth, setAuth, users, w } from './state';
import 'simple-keyboard/build/css/index.css';
import * as bootstrap from 'bootstrap';
import { I18nStringKey, TheI18n } from './i18n.js';
import { Format } from './format.js';
import AuthManager from './AuthManager.js';
import { elements } from './dom.js';
import { renderAuth } from './auth'
import { loadList } from './vmList.js';
import { turn, turnTimer, voteTimer } from './turnAndVote.js';
import { getDarkTheme, loadColorTheme } from './theme';

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize i18n
    await TheI18n.Init();
    TheI18n.on('languageChanged', () => {
        // Title
        document.title = getActiveVM()
            ? Format('{0} - {1}', getActiveVM()!.getNode()!, TheI18n.GetString(I18nStringKey.kGeneric_CollabVM))
            : TheI18n.GetString(I18nStringKey.kGeneric_CollabVM);

        if (getActiveVM()) {
            // Turn status
            if (turn !== -1) {
                elements.turnstatus.innerText = TheI18n.GetString(
                    turn === 0
                        ? I18nStringKey.kVM_TurnTimeTimer
                        : I18nStringKey.kVM_WaitingTurnTimer,
                    turnTimer
                );
                elements.turnBtnText.innerText = TheI18n.GetString(I18nStringKey.kVMButtons_EndTurn);
            } else {
                elements.turnBtnText.innerText = TheI18n.GetString(I18nStringKey.kVMButtons_TakeTurn);
            }
            // Vote timer
            if (getActiveVM()!.getVoteStatus()) {
                elements.voteTimeText.innerText = TheI18n.GetString(
                    I18nStringKey.kVM_VoteForResetTimer,
                    voteTimer
                );
            }
        }

        // Not logged in?
        if (!getAuth()?.account) {
            elements.accountDropdownUsername.innerText = TheI18n.GetString(I18nStringKey.kNotLoggedIn);
        }

        // Theme toggle text
        elements.toggleThemeBtnText.innerHTML = TheI18n.GetString(
            getDarkTheme()
                ? I18nStringKey.kSiteButtons_LightMode
                : I18nStringKey.kSiteButtons_DarkMode
        );

        // Ghost-turn button text
        elements.ghostTurnBtnText.innerText = TheI18n.GetString(
            w.collabvm.ghostTurn
                ? I18nStringKey.kAdminVMButtons_GhostTurnOn
                : I18nStringKey.kAdminVMButtons_GhostTurnOff
        );

        // Update flags’ titles
        users.forEach(entry => {
            const code = entry.user.countryCode;
            if (code) entry.flagElement.title = TheI18n.getCountryName(code);
        });
    });

    // Load theme from storage or system
    const stored = localStorage.getItem('cvm-dark-theme');
    if (stored !== null) {
        loadColorTheme(stored === '1');
    } else {
        loadColorTheme(window.matchMedia('(prefers-color-scheme: dark)').matches);
    }

    // Init auth if enabled
    if (Config.Auth.Enabled) {
        setAuth(new AuthManager(Config.Auth.APIEndpoint));
        renderAuth();
    }

    // Restore hide-flag setting
    elements.hideFlagCheckbox.checked = JSON.parse(
        localStorage.getItem('collabvm-hide-flag') || 'false'
    );

    // Base title
    document.title = TheI18n.GetString(I18nStringKey.kGeneric_CollabVM);

    // Kick off VM loading
    loadList();

    // Welcome modal
    const welcomeModalEl = document.getElementById('welcomeModal') as HTMLDivElement;
    const welcomeModal   = new bootstrap.Modal(welcomeModalEl);
    if (localStorage.getItem(Config.WelcomeModalLocalStorageKey) !== '1') {
        const dismissBtn = document.getElementById('welcomeModalDismiss') as HTMLButtonElement;
        dismissBtn.addEventListener('click', () =>
            localStorage.setItem(Config.WelcomeModalLocalStorageKey, '1')
        );
        dismissBtn.disabled = true;
        welcomeModal.show();
        setTimeout(() => { dismissBtn.disabled = false; }, 5000);
    }
    elements.rulesBtn.addEventListener('click', e => {
        if (TheI18n.CurrentLanguage() !== 'en-us') {
            e.preventDefault();
            welcomeModal.show();
        }
    });
});
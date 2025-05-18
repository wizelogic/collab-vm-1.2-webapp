import * as bootstrap from 'bootstrap';
import { sendChat } from "./chat";
import { elements } from "./dom";
import { I18nStringKey, TheI18n } from "./i18n";
import { getActiveVM, getAuth, getPerms, getRank, w } from "./state";
import { turn } from "./turnAndVote";
import { closeVM } from "./vmController";
import { doLogin } from './auth';
import { User } from './protocol/User';
import MuteState from './protocol/MuteState';
import { getDarkTheme, loadColorTheme } from './theme';

// Bind list button
elements.homeBtn.addEventListener('click', closeVM);

// VM view buttons
elements.sendChatBtn.addEventListener('click', sendChat);
elements.chatinput.addEventListener('keypress', ({ key }) => key === 'Enter' && sendChat());

elements.changeUsernameBtn.addEventListener('click', () => {
    const oldName = (w.username.nodeName === undefined
        ? w.username
        : w.username.innerText);
    const newName = prompt(
        TheI18n.GetString(I18nStringKey.kVMPrompts_EnterNewUsernamePrompt),
        oldName
    );
    if (newName && newName !== oldName) {
        getActiveVM()?.rename(newName);
    }
});

elements.takeTurnBtn.addEventListener('click', () =>
    getActiveVM()?.turn(turn === -1)
);

elements.screenshotButton.addEventListener('click', () => {
    getActiveVM()?.canvas.toBlob(blob =>
        blob && open(URL.createObjectURL(blob), '_blank')
    );
});

elements.ctrlAltDelBtn.addEventListener('click', () => {
    const client = getActiveVM();
    if (!client) return;

    // Press down Ctrl, Alt, Del
    [0xffe3, 0xffe9, 0xffff].forEach(code => client.key(code, true));
    // Release Ctrl, Alt, Del
    [0xffe3, 0xffe9, 0xffff].forEach(code => client.key(code, false));
});

[elements.voteResetButton, elements.voteYesBtn].forEach(btn =>
    btn.addEventListener('click', () => getActiveVM()?.vote(true))
);
elements.voteNoBtn.addEventListener('click', () => getActiveVM()?.vote(false));

// Login
let usernameClick = false;
export const loginModal = new bootstrap.Modal(elements.loginModal);

elements.loginModal.addEventListener('shown.bs.modal', () => {
    elements.adminPassword.focus();
});

elements.username.addEventListener('click', () => {
    if (getAuth()) return;

    if (!usernameClick) {
        usernameClick = true;
        setTimeout(() => (usernameClick = false), 1000);
    } else {
        loginModal.show();
    }
});

elements.loginButton.addEventListener('click', doLogin);
elements.adminPassword.addEventListener('keypress', ({ key }) => key === 'Enter' && doLogin());
elements.incorrectPasswordDismissBtn.addEventListener('click', () => {
    elements.badPasswordAlert.style.display = 'none';
});

export function userModOptions(entry: { user: User; element: HTMLTableRowElement }) {
    const client = getActiveVM()!;
    const { user: u, element: tr } = entry;
    const username = u.username;

    // Dropdown setup
    tr.classList.add('dropdown');
    const td = tr.children[0] as HTMLTableCellElement;
    td.classList.add('dropdown-toggle');
    td.setAttribute('data-bs-toggle', 'dropdown');
    td.setAttribute('role', 'button');
    td.setAttribute('aria-expanded', 'false');

    // Menu container
    const ul = document.createElement('ul');
    ul.classList.add(
        'dropdown-menu',
        'dropdown-menu-dark',
        'table-dark',
        'text-light'
    );

    // Helper to add items
    const addItem = (
        key: I18nStringKey,
        fn: () => void,
        cls: string
    ) => {
        addUserDropdownItem(
            ul,
            TheI18n.GetString(key, username),
            fn,
            cls
        );
    };

    // Populate based on permissions
    if (getPerms().bypassturn) addItem(
        I18nStringKey.kVMButtons_EndTurn,
        () => client.endTurn(username),
        'mod-end-turn-btn'
    );
    if (getPerms().ban) addItem(
        I18nStringKey.kAdminVMButtons_Ban,
        () => client.ban(username),
        'mod-ban-btn'
    );
    if (getPerms().kick) addItem(
        I18nStringKey.kAdminVMButtons_Kick,
        () => client.kick(username),
        'mod-kick-btn'
    );
    if (getPerms().rename) addItem(
        I18nStringKey.kVMButtons_ChangeUsername,
        () => {
            const newName = prompt(
                TheI18n.GetString(
                    I18nStringKey.kVMPrompts_AdminChangeUsernamePrompt,
                    username
                )
            );
            if (newName) client.renameUser(username, newName);
        },
        'mod-rename-btn'
    );
    if (getPerms().mute) {
        addItem(
            I18nStringKey.kAdminVMButtons_TempMute,
            () => client.mute(username, MuteState.Temp),
            'mod-temp-mute-btn'
        );
        addItem(
            I18nStringKey.kAdminVMButtons_IndefMute,
            () => client.mute(username, MuteState.Perma),
            'mod-indef-mute-btn'
        );
        addItem(
            I18nStringKey.kAdminVMButtons_Unmute,
            () => client.mute(username, MuteState.Unmuted),
            'mod-unmute-btn'
        );
    }
    if (getPerms().grabip) addUserDropdownItem(
        ul,
        TheI18n.GetString(I18nStringKey.kAdminVMButtons_GetIP, username),
        async () => {
            const ip = await client.getip(username);
            alert(ip);
        },
        'mod-get-ip-btn'
    );

    tr.appendChild(ul);
}

function addUserDropdownItem(
    ul: HTMLUListElement,
    text: string,
    onClick: () => void,
    className: string
) {
    const li = document.createElement('li');
    const a  = document.createElement('a');

    a.href = '#';
    a.classList.add('dropdown-item', className);
    a.innerHTML = text;
    a.addEventListener('click', onClick);

    li.append(a);
    ul.append(li);
}

// Admin buttons
elements.restoreBtn.addEventListener('click', () => {
    if (window.confirm(
        TheI18n.GetString(I18nStringKey.kVMPrompts_AdminRestoreVMPrompt)
    )) {
        getActiveVM()?.restore();
    }
});

elements.rebootBtn.addEventListener('click', () =>
    getActiveVM()?.reboot()
);

elements.clearQueueBtn.addEventListener('click', () =>
    getActiveVM()?.clearQueue()
);

elements.bypassTurnBtn.addEventListener('click', () =>
    getActiveVM()?.bypassTurn()
);

elements.endTurnBtn.addEventListener('click', () => {
    const user = getActiveVM()?.getUsers().find(u => u.turn === 0);
    if (user) getActiveVM()?.endTurn(user.username);
});

elements.forceVoteNoBtn.addEventListener('click', () =>
    getActiveVM()?.forceVote(false)
);

elements.forceVoteYesBtn.addEventListener('click', () =>
    getActiveVM()?.forceVote(true)
);

elements.indefTurnBtn.addEventListener('click', () =>
    getActiveVM()?.indefiniteTurn()
);

// Ghost-turn toggle
elements.ghostTurnBtn.addEventListener('click', () => {
    const state = w.collabvm;
    state.ghostTurn = !state.ghostTurn;
    elements.ghostTurnBtnText.innerText = TheI18n.GetString(
        state.ghostTurn
            ? I18nStringKey.kAdminVMButtons_GhostTurnOn
            : I18nStringKey.kAdminVMButtons_GhostTurnOff
    );
});

elements.osk.addEventListener('click', () =>
    elements.oskContainer.classList.toggle('d-none')
);

elements.toggleThemeBtn.addEventListener("click", e => {
    e.preventDefault();
    loadColorTheme(!getDarkTheme());
    localStorage.setItem("cvm-dark-theme", getDarkTheme() ? "1" : "0");
    return false;
});
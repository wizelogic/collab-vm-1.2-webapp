import { Rank } from './protocol/Permissions.js';
import { User } from './protocol/User.js';
import { TheI18n } from './i18n.js';
import { elements } from './dom.js';
import { getActiveVM, getRank, users, w } from './state'
import { userModOptions } from './uiBindings.js';

function getFlagEmoji(countryCode: string) {
    if (countryCode.length !== 2) {
        throw new Error('Invalid country code');
    }
    return String.fromCodePoint(
        ...[...countryCode.toUpperCase()].map(char =>
            127397 + char.charCodeAt(0)
        )
    );
}

export function addUser(user: User) {
    // Remove any existing entry for this user
    const existing = users.find(u => u.user === user);
    if (existing) {
        elements.userlist.removeChild(existing.element);
    }

    // Build the row
    const tr = document.createElement('tr');
    tr.dataset.cvmTurn = '-1';

    const td = document.createElement('td');

    // Flag
    const flagSpan = document.createElement('span');
    flagSpan.classList.add('userlist-flag');
    if (user.countryCode !== null) {
        flagSpan.innerHTML = getFlagEmoji(user.countryCode);
        flagSpan.title = TheI18n.getCountryName(user.countryCode);
    }

    // Username
    const usernameSpan = document.createElement('span');
    usernameSpan.classList.add('userlist-username');
    usernameSpan.innerText = user.username;

    td.append(flagSpan, usernameSpan);
    tr.append(td);

    // Rank-based styling
    switch (user.rank) {
        case Rank.Admin:
            tr.classList.add('user-admin');
            break;
        case Rank.Moderator:
            tr.classList.add('user-moderator');
            break;
        case Rank.Registered:
            tr.classList.add('user-registered');
            break;
        default:
            tr.classList.add('user-unregistered');
    }

    // Highlight the current user
    if (user.username === w.username) {
        tr.classList.add('user-current');
    }

    // Prepare the entry object
    const entry = {
        user,
        element: tr,
        usernameElement: usernameSpan,
        flagElement: flagSpan
    };

    // If we have mod/admin powers, add options
    if (getRank() === Rank.Admin || getRank() === Rank.Moderator) {
        userModOptions(entry);
    }

    // Append to list & update users array
    elements.userlist.appendChild(tr);
    if (existing) {
        existing.element = tr;
    } else {
        users.push(entry);
    }

    // Update online count
    elements.onlineusercount.innerText = getActiveVM()!.getUsers().length.toString();
}

export function remUser(user: User) {
    // Find the index of the user entry
    const idx = users.findIndex(u => u.user === user);

    // If found, remove from DOM and from the array
    if (idx > -1) {
        elements.userlist.removeChild(users[idx].element);
        users.splice(idx, 1);
    }

    // Update the online count
    elements.onlineusercount.innerHTML = getActiveVM()!.getUsers().length.toString();
}

export function flag() {
    // Update flags for users with a country code
    for (const entry of users) {
        const code = entry.user.countryCode;
        if (!code) continue;

        entry.flagElement.innerHTML = getFlagEmoji(code);
        entry.flagElement.title     = TheI18n.getCountryName(code);
    }
}

export function sortUserList() {
    // Cache the list container
    const ul = elements.userlist;
    const me = w.username;

    users.sort((a, b) => {
        // Always keep the current user at the front when they have a turn
        if (a.user.username === me && a.user.turn >= b.user.turn && b.user.turn !== 0) return -1;
        if (b.user.username === me && b.user.turn >= a.user.turn && a.user.turn !== 0) return 1;

        // Same turn number → no change
        if (a.user.turn === b.user.turn) return 0;
        // “Offline” (-1) always goes last
        if (a.user.turn === -1) return 1;
        if (b.user.turn === -1) return -1;

        // Otherwise, lower turn number sorts first
        return a.user.turn < b.user.turn ? -1 : 1;
    });

    // Rebuild the DOM in the new order
    for (const user of users) {
        ul.removeChild(user.element);
        ul.appendChild(user.element);
    }
}

export function userRenamed(oldname: string, newname: string, selfrename: boolean) {
    const entry = users.find(u => u.user.username === newname);
    if (entry) {
        entry.usernameElement.innerHTML = newname;
    }
    if (selfrename) {
        w.username = newname;
        elements.username.innerText = newname;
        localStorage.setItem('username', newname);
    }
}
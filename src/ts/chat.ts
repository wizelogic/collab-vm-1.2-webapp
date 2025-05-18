import Config from '../../config.json';
import { Rank } from './protocol/Permissions.js';
import * as dompurify from 'dompurify';
import { elements } from './dom.js';
import { getActiveVM } from './state';

const chatsound = new Audio(Config.ChatSound);

export function sendChat() {
    if (!getActiveVM()) return;
    const { value } = elements.chatinput;
    if (elements.xssCheckbox.checked) {
        getActiveVM()!.xss(value);
    } else {
        getActiveVM()!.chat(value);
    }
    elements.chatinput.value = '';
}

export function chatMessage(username: string, message: string) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');

    // Sanitize unless raw messages are allowed
    if (!Config.RawMessages.Messages) {
        message = dompurify.sanitize(message);
    }

    // System message
    if (!username) {
        td.innerHTML = message;
    } else {
        const user = getActiveVM()!.getUsers().find(u => u.username === username);
        const rank = user?.rank ?? Rank.Unregistered;

        let userClass: string;
        let msgClass: string;
        switch (rank) {
            case Rank.Registered:
                userClass = 'chat-username-registered';
                msgClass  = 'chat-registered';
                break;
            case Rank.Admin:
                userClass = 'chat-username-admin';
                msgClass  = 'chat-admin';
                break;
            case Rank.Moderator:
                userClass = 'chat-username-moderator';
                msgClass  = 'chat-moderator';
                break;
            default:
                userClass = 'chat-username-unregistered';
                msgClass  = 'chat-unregistered';
        }

        tr.classList.add(msgClass);
        td.innerHTML = `<b class="${userClass}">${username}▸</b> ${message}`;

        // Execute any <script> children if raw messages are allowed
        if (Config.RawMessages.Messages) {
            Array.from(td.children).forEach(node => {
                if (node.nodeName === 'SCRIPT') {
                    eval((node as HTMLScriptElement).text);
                }
            });
        }
    }

    tr.appendChild(td);
    elements.chatList.appendChild(tr);
    elements.chatListDiv.scrollTop = elements.chatListDiv.scrollHeight;
    chatsound.play();
}
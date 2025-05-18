import TurnStatus from './protocol/TurnStatus.js';
import 'simple-keyboard/build/css/index.css';
import VoteStatus from './protocol/VoteStatus.js';
import { I18nStringKey, TheI18n } from './i18n.js';
import { elements } from './dom.js';
import { enableOSK } from './osk';
import { sortUserList } from './userList.js';
import { getActiveVM, users, w } from './state.js';

export let turn = -1;
export let turnInterval: number | undefined = undefined;
export let voteInterval: number | undefined = undefined;
export let turnTimer = 0;
export let voteTimer = 0;

export function setTurn(newTurn : number) {
    turn = newTurn;
}

export function voteEnd() {
    clearInterval(voteInterval);
    elements.voteResetPanel.style.display = 'none';
}

export function turnIntervalCb() {
    turnTimer--;
    setTurnStatus();
}

export function setTurnStatus() {
    const key = turn === 0
        ? I18nStringKey.kVM_TurnTimeTimer
        : I18nStringKey.kVM_WaitingTurnTimer;
    elements.turnstatus.innerText = TheI18n.GetString(key, turnTimer);
}

export function updateVoteEndTime() {
    voteTimer--;
    elements.voteTimeText.innerText = TheI18n.GetString(
        I18nStringKey.kVM_VoteForResetTimer,
        voteTimer
    );
    if (voteTimer <= 0) {
        clearInterval(voteInterval);
    }
}

export function turnUpdate(status: TurnStatus) {
    // Reset turn state
    turn = -1;
    getActiveVM()!.canvas.classList.remove('focused', 'waiting');
    clearInterval(turnInterval);
    turnTimer = 0;

    // Clear user indicators
    for (const entry of users) {
        entry.element.classList.remove('user-turn', 'user-waiting');
        entry.element.dataset.cvmTurn = '-1';
    }

    elements.turnBtnText.innerHTML = TheI18n.GetString(I18nStringKey.kVMButtons_TakeTurn);
    enableOSK(false);

    // Mark current turn
    if (status.user) {
        const current = users.find(u => u.user === status.user);
        if (current) {
            current.element.classList.add('user-turn');
            current.element.dataset.cvmTurn = '0';
        }
    }

    // Mark queue
    status.queue.forEach((u, idx) => {
        const queued = users.find(entry => entry.user === u);
        if (queued) {
            queued.element.classList.add('user-waiting');
            queued.element.dataset.cvmTurn = String(idx);
        }
    });

    // If it's my turn
    if (status.user?.username === w.username) {
        turn = 0;
        turnTimer = (status.turnTime ?? 0) / 1000;
        elements.turnBtnText.innerHTML = TheI18n.GetString(I18nStringKey.kVMButtons_EndTurn);
        getActiveVM()!.canvas.classList.add('focused');
        enableOSK(true);
    }

    // If I'm in queue
    if (status.queue.some(u => u.username === w.username)) {
        turn = status.queue.findIndex(u => u.username === w.username) + 1;
        turnTimer = (status.queueTime ?? 0) / 1000;
        elements.turnBtnText.innerHTML = TheI18n.GetString(I18nStringKey.kVMButtons_EndTurn);
        getActiveVM()!.canvas.classList.add('waiting');
    }

    // Start timer if needed
    if (turn === -1) {
        elements.turnstatus.innerText = '';
    } else {
        //@ts-ignore
        turnInterval = setInterval(turnIntervalCb, 1000);
        setTurnStatus();
    }

    sortUserList();
}

export function voteUpdate(status: VoteStatus) {
    clearInterval(voteInterval);

    const { yesVotes, noVotes, timeToEnd } = status;
    elements.voteResetPanel.style.display = 'block';
    elements.voteYesLabel.innerText = yesVotes.toString();
    elements.voteNoLabel.innerText  = noVotes.toString();

    voteTimer = Math.floor(timeToEnd / 1000);

    //@ts-ignore
    voteInterval = setInterval(updateVoteEndTime, 1000);
    updateVoteEndTime();
}
import CollabVMClient from './protocol/CollabVMClient.js';
import VM from './protocol/VM.js';
import Config from '../../config.json';
import { Permissions, Rank } from './protocol/Permissions.js';
import 'simple-keyboard/build/css/index.css';
import VoteStatus from './protocol/VoteStatus.js';
import { I18nStringKey, TheI18n } from './i18n.js';
import { Format } from './format.js';
import AuthManager from './AuthManager.js';
import { elements } from './dom.js';
import { onLogin, renderAuth } from './auth'
import { chatMessage } from './chat.js';
import { addUser, flag, remUser, userRenamed } from './userList.js';
import { setTurn, turnUpdate, voteEnd, voteUpdate } from './turnAndVote.js';
import { getActiveVM, getAuth, getPerms, setActiveVM, setAuth, setRank, users, w } from './state.js';

let expectedClose = false;

export async function openVM(vm: VM): Promise<void> {
    // If there's an active VM it must be closed before opening another
    if (getActiveVM()) return;
    expectedClose = false;

    // Set hash
    location.hash = vm.id;

    // Create the client

    const newVM = new CollabVMClient(vm.url);
    setActiveVM(newVM);
    const client = getActiveVM()!;

    // Register event listeners
    client.on('chat',       (username, message) => chatMessage(username, message));
    client.on('adduser',    user             => addUser(user));
    client.on('flag',       ()               => flag());
    client.on('remuser',    user             => remUser(user));
    client.on('rename',     (o, n, s)        => userRenamed(o, n, s));

    client.on('renamestatus', status => {
        // TODO: i18n these
        switch (status) {
            case 'taken':
                alert(TheI18n.GetString(I18nStringKey.kError_UsernameTaken));
                break;
            case 'invalid':
                alert(TheI18n.GetString(I18nStringKey.kError_UsernameInvalid));
                break;
            case 'blacklisted':
                alert(TheI18n.GetString(I18nStringKey.kError_UsernameBlacklisted));
                break;
        }
    });

    client.on('turn',    status          => turnUpdate(status));
    client.on('vote',    (st: VoteStatus) => voteUpdate(st));
    client.on('voteend', ()               => voteEnd());
    client.on('votecd',  cd               => window.alert(TheI18n.GetString(I18nStringKey.kVM_VoteCooldownTimer, cd)));
    client.on('login',   (r: Rank, p: Permissions) => onLogin(r, p));

    client.on('close', () => {
        if (!expectedClose) alert(TheI18n.GetString(I18nStringKey.kError_UnexpectedDisconnection));
        closeVM();
    });

    // auth
    client.on('auth', async server => {
        elements.changeUsernameBtn.style.display = "none";
    
        if (Config.Auth.Enabled && Config.Auth.APIEndpoint === server && getAuth()!.account) {
            // same endpoint & we already have credentials: just re-login
            client.loginAccount(getAuth()!.account!.sessionToken);
        } else if (Config.Auth.Enabled) {
            // always re-use the configured API endpoint
            setAuth(new AuthManager(Config.Auth.APIEndpoint));
            await renderAuth();
        }
    });    

    // Wait for the client to open
    await client.WaitForOpen();

    // Connect to node
    chatMessage('', `<b>${vm.id}</b><hr>`);
    let username = Config.Auth.Enabled
        ? (getAuth()!.account?.username ?? null)
        : localStorage.getItem('username');
    const connected = await client.connect(vm.id, username);

    elements.adminInputVMID.value = vm.id;
    w.VMName = vm.id;

    if (!connected) {
        closeVM();
        throw new Error('Failed to connect to node');
    }

    // Set the title
    document.title = Format(
        '{0} - {1}',
        vm.id,
        TheI18n.GetString(I18nStringKey.kGeneric_CollabVM)
    );

    // Append canvas
    elements.vmDisplay.appendChild(client.canvas);

    // Switch to the VM view
    elements.vmlist.style.display = 'none';
    elements.vmview.style.display = 'block';
}

export function closeVM() {
    if (!getActiveVM()) return;
    expectedClose = true;
    getActiveVM()!.close();
    setActiveVM(null);

    document.title = TheI18n.GetString(I18nStringKey.kGeneric_CollabVM);
    setTurn(-1)

    elements.vmDisplay.innerHTML = '';
    elements.vmlist.style.display = 'block';
    elements.vmview.style.display = 'none';

    users.splice(0);
    elements.userlist.innerHTML = '';

    setRank(Rank.Unregistered);
    getPerms().set(0);
    w.VMName = null;

    // Hide admin & vote panels in one go
    elements.staffbtns.style.display =
    elements.restoreBtn.style.display =
    elements.rebootBtn.style.display =
    elements.bypassTurnBtn.style.display =
    elements.endTurnBtn.style.display =
    elements.clearQueueBtn.style.display =
    elements.qemuMonitorBtn.style.display =
    elements.indefTurnBtn.style.display =
    elements.ghostTurnBtn.style.display =
    elements.xssCheckboxContainer.style.display =
    elements.forceVotePanel.style.display =
    elements.voteResetPanel.style.display = 'none';

    elements.voteYesLabel.innerText = '0';
    elements.voteNoLabel.innerText  = '0';
    elements.xssCheckbox.checked    = false;

    elements.username.classList.remove(
        'username-admin',
        'username-moderator',
        'username-registered'
    );
    elements.username.classList.add('username-unregistered');

    // Reset rename button
    elements.changeUsernameBtn.style.display = 'inline-block';

    // Reset auth if needed
    if (Config.Auth.Enabled && getAuth()?.apiEndpoint !== Config.Auth.APIEndpoint) {
        setAuth(new AuthManager(Config.Auth.APIEndpoint));
        renderAuth();
    } else if (getAuth() && !Config.Auth.Enabled) {
        setAuth(null);
        elements.accountDropdownMenuLink.style.display = 'none';
    }
}
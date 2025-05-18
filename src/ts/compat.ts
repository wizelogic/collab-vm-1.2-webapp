import { getActiveVM, w } from "./state";
import { multicollab } from "./vmList";

// Backwards-compat
w.multicollab = multicollab;
w.GetAdmin = () => {
    const client = getActiveVM();
    if (!client) return;
    return {
        adminInstruction: (...args: string[]) => client.send('admin', ...args),
        restore:        ()                => client.restore(),
        reboot:         ()                => client.reboot(),
        clearQueue:     ()                => client.clearQueue(),
        bypassTurn:     ()                => client.bypassTurn(),
        endTurn:        (username: string) => client.endTurn(username),
        ban:            (username: string) => client.ban(username),
        kick:           (username: string) => client.kick(username),
        renameUser:     (oldname: string, newname: string) => client.renameUser(oldname, newname),
        mute:           (username: string, state: number)   => client.mute(username, state),
        getip:          (username: string)                  => client.getip(username),
        qemuMonitor:    (cmd: string)                      => { client.qemuMonitor(cmd); },
        globalXss:      (msg: string)                      => client.xss(msg),
        forceVote:      (result: boolean)                  => client.forceVote(result)
    };
};

// More backwards-compat
w.cvmEvents = {
    on: (event: string|number, cb: (...args: any[]) => void) =>
        getActiveVM()?.on('message', (...args: any[]) => cb(...args))
};
w.VMName = null;
import { getActiveVM, w } from "./state";
import { closeVM, openVM } from "./vmController";
import { loadList, multicollab } from "./vmList";

// Public API
w.collabvm = {
    openVM,
    closeVM,
    loadList,
    multicollab,
    getVM: () => getActiveVM(),
    ghostTurn: false
};
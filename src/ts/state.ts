import CollabVMClient from './protocol/CollabVMClient.js';
import VM from './protocol/VM.js';
import { Permissions, Rank } from './protocol/Permissions.js';
import { User } from './protocol/User.js';
import AuthManager from './AuthManager.js';

export const w = window as any;

// Auth
let auth: AuthManager | null = null;
export function getAuth() { return auth; }
export function setAuth(a: AuthManager | null) { auth = a; }

// VM lists
export const vms: VM[] = [];
export const cards: HTMLDivElement[] = [];
export const users: {
  user: User;
  usernameElement: HTMLSpanElement;
  flagElement: HTMLSpanElement;
  element: HTMLTableRowElement;
}[] = [];

// Rank
let rank: Rank = Rank.Unregistered;
export function getRank() { return rank; }
export function setRank(r: Rank) { rank = r; }

// Perms
let perms: Permissions = new Permissions(0);
export function getPerms() { return perms; }
export function setPerms(p: Permissions) { perms = p; }

// Active VM
let activeVM: CollabVMClient | null = null;
export function getActiveVM() { return activeVM; }
export function setActiveVM(vm: CollabVMClient | null) { activeVM = vm; }
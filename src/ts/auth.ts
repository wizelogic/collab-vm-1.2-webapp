import * as bootstrap from 'bootstrap';
import { I18nStringKey, TheI18n } from './i18n.js';
import dayjs from 'dayjs';
import { elements } from './dom.js';
import { closeVM } from './vmController.js';
import { Rank } from './protocol/Permissions.js';
import { Permissions } from './protocol/Permissions.js';
import { loginModal, userModOptions } from './uiBindings.js';
import { getActiveVM, getAuth, setPerms, setRank, users } from './state.js';

export async function renderAuth() {
    // Debug log to indicate rendering of authentication UI
	//console.log("Authentication UI rendering...");

    // Ensure auth manager is initialized
    if (!getAuth()) throw new Error("Cannot renderAuth when auth is null.");

    // Fetch the latest API information (e.g., captcha requirements, registration status)
    const info = await getAuth()!.getAPIInformation();
	if(!info) {
		console.log("fuck this shit im out");
		return;
	}

    // Reset dropdown to “not logged in” state
    elements.accountDropdownUsername.innerText = TheI18n.GetString(I18nStringKey.kNotLoggedIn);
    elements.accountDropdownMenuLink.style.display   = 'block';
    elements.accountRegisterButton.style.display    = info.registrationOpen ? 'block' : 'none';  // show register only if open
    elements.accountLoginButton.style.display       = 'block';  // always allow login
    elements.accountSettingsButton.style.display    = 'none';   // hide settings until logged in
    elements.accountLogoutButton.style.display      = 'none';   // hide logout until logged in

    // Remove any existing hCaptcha widgets and their containers
    Array.from(document.querySelectorAll(
        "[id^=accountRegisterCaptcha-]," +
        "[id^=accountLoginCaptcha-]," +
        "[id^=accountResetPasswordCaptcha-]"
    )).forEach(el => {
        const id = el.parentElement?.getAttribute("data-hcaptcha-widget-id");
        if (id) hcaptcha.remove(id);  // remove widget
        el.remove();                  // remove placeholder div
    });

    // Remove any existing Turnstile widgets and their containers
    Array.from(document.querySelectorAll(
        "[id^=accountRegisterTurnstile-]," +
        "[id^=accountLoginTurnstile-]," +
        "[id^=accountResetPasswordTurnstile-]"
    )).forEach(el => {
        const id = el.parentElement?.getAttribute("data-turnstile-widget-id");
        if (id) turnstile.remove(id);  // remove widget
        el.remove();                   // remove placeholder div
    });

    // Remove any existing reCAPTCHA widgets and their containers
    Array.from(document.querySelectorAll(
        "[id^=accountRegisterRecaptcha-]," +
        "[id^=accountLoginRecaptcha-]," +
        "[id^=accountResetPasswordRecaptcha-]"
    )).forEach(el => {
        const id = el.parentElement?.getAttribute("data-recaptcha-widget-id");
        if (id) grecaptcha.reset(parseInt(id, 10));  // reset widget if present
        el.remove();                                // remove placeholder div
    });

    // Helper to dynamically load a captcha script and invoke a callback on load
    const loadScript = (src: string, cbName: string, fn: () => void) => {
        (window as any)[cbName] = fn;            // assign onload callback
        const s = document.createElement('script');
        s.src = src;                              
        document.head.appendChild(s);            // insert script tag
    };

    // Render hCaptcha on Register/Login/Reset forms if required
    if (info.hcaptcha?.required) {
        const cfg = { sitekey: info.hcaptcha.siteKey! };  // configuration object
        const render = () => {
            const uuid = Math.random().toString(36).substr(2, 7); // unique suffix
            ['Register', 'Login', 'ResetPassword'].forEach(type => {
                const div = document.createElement('div');
                div.id = `account${type}Captcha-${uuid}`;        // e.g. accountLoginCaptcha-abc123
                const container = (elements as any)[`account${type}CaptchaContainer`];
                container.appendChild(div);
                const wid = hcaptcha.render(div, cfg)!;          // render widget
                container.setAttribute("data-hcaptcha-widget-id", wid);
            });
        };
        // Load hCaptcha API script if not already loaded
        if (typeof hcaptcha === 'undefined') {
            loadScript(
                "https://js.hcaptcha.com/1/api.js?render=explicit&recaptchacompat=off&onload=hCaptchaLoad",
                "hCaptchaLoad",
                render
            );
        } else {
            render();
        }
    }

    // Render Cloudflare Turnstile on Register/Login/Reset forms if required
    if (info.turnstile?.required) {
        const cfg = { sitekey: info.turnstile.siteKey! };
        const render = () => {
            const uuid = Math.random().toString(36).substr(2, 7);
            ['Register', 'Login', 'ResetPassword'].forEach(type => {
                const div = document.createElement('div');
                div.id = `account${type}Turnstile-${uuid}`;
                const container = (elements as any)[`account${type}TurnstileContainer`];
                container.appendChild(div);
                const wid = turnstile.render(div, cfg)!;
                container.setAttribute("data-turnstile-widget-id", wid);
            });
        };
        if (typeof turnstile === 'undefined') {
            loadScript(
                "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=turnstileLoad",
                "turnstileLoad",
                render
            );
        } else {
            render();
        }
    }

    // Render Google reCAPTCHA on Register/Login/Reset forms if required
    if (info.recaptcha?.required) {
        const cfg = { sitekey: info.recaptcha.siteKey! };
        const render = () => {
            const uuid = Math.random().toString(36).substr(2, 7);
            ['Register', 'Login', 'ResetPassword'].forEach(type => {
                const div = document.createElement('div');
                div.id = `account${type}Recaptcha-${uuid}`;
                const container = (elements as any)[`account${type}RecaptchaContainer`];
                container.appendChild(div);
                const wid = grecaptcha.render(div, cfg);
                container.setAttribute("data-recaptcha-widget-id", wid.toString());
            });
        };
        if (typeof grecaptcha === 'undefined') {
            loadScript(
                "https://www.google.com/recaptcha/api.js?render=explicit&onload=recaptchaLoad",
                "recaptchaLoad",
                render
            );
        } else {
            grecaptcha.ready(render);
        }
    }

    // Check for an existing session token in localStorage
    const host  = new URL(getAuth()!.apiEndpoint).host;
    const token = localStorage.getItem(`collabvm_session_${host}`);
    if (token) {
        // Attempt to load session from token
        const result = await getAuth()!.loadSession(token);
        if (result!.success) {
            loadAccount();  // successful login, update UI
        } else {
            localStorage.removeItem(`collabvm_session_${host}`); // invalid token, clean up
        }
    }
}

export function loadAccount() {
	const auth = getAuth();
    // Ensure we have an authenticated account
    if (!auth?.account) {
        throw new Error("Cannot loadAccount when auth or auth.account is null.");
    }

    // Extract username and session token from the authenticated account
    const { username, sessionToken } = auth.account;

    // Pull relevant DOM elements from the shared elements object
    const {
        accountDropdownUsername,
        accountLoginButton,
        accountRegisterButton,
        accountSettingsButton,
        accountLogoutButton
    } = elements;

    // Update the account dropdown to show the current username
    accountDropdownUsername.innerText = username;

    // Hide login/register buttons, show settings/logout buttons
    accountLoginButton.style.display      = 'none';
    accountRegisterButton.style.display   = 'none';
    accountSettingsButton.style.display   = 'block';
    accountLogoutButton.style.display     = 'block';

    // If the VM is already instantiated, automatically log in using the session token
    getActiveVM()?.loginAccount(sessionToken);
}

// Initialize the Bootstrap modal instance for account dialogs
const accountModal = new bootstrap.Modal(elements.accountModal);

// Dismiss error message on click
elements.accountModalErrorDismiss.addEventListener('click', () => elements.accountModalError.style.display = "none");

// Dismiss success message on click
elements.accountModalSuccessDismiss.addEventListener('click', () => elements.accountModalSuccess.style.display = "none");

// Show login section in modal
elements.accountLoginButton.addEventListener("click", () => {
	elements.accountModalTitle.innerText = TheI18n.GetString(I18nStringKey.kGeneric_Login);
	elements.accountRegisterSection.style.display = "none";
	elements.accountVerifyEmailSection.style.display = "none";
	elements.accountLoginSection.style.display = "block";
	elements.accountSettingsSection.style.display = "none";
	elements.accountResetPasswordSection.style.display = "none";
	elements.accountResetPasswordVerifySection.style.display = "none";
	elements.accountModalError.style.display = 'none';
	accountModal.show();
});

// Show registration section in modal
elements.accountRegisterButton.addEventListener("click", () => {
	elements.accountModalTitle.innerText = TheI18n.GetString(I18nStringKey.kGeneric_Register);
	elements.accountRegisterSection.style.display = "block";
	elements.accountVerifyEmailSection.style.display = "none";
	elements.accountLoginSection.style.display = "none";
	elements.accountSettingsSection.style.display = "none";
	elements.accountResetPasswordSection.style.display = "none";
	elements.accountResetPasswordVerifySection.style.display = "none";
	elements.accountModalError.style.display = 'none';
	accountModal.show();
});

// Show account settings section in modal
elements.accountSettingsButton.addEventListener("click", () => {
	elements.accountModalTitle.innerText = TheI18n.GetString(I18nStringKey.kAccountModal_AccountSettings);
	elements.accountRegisterSection.style.display = "none";
	elements.accountVerifyEmailSection.style.display = "none";
	elements.accountLoginSection.style.display = "none";
	elements.accountSettingsSection.style.display = "block";
	elements.accountResetPasswordSection.style.display = "none";
	elements.accountResetPasswordVerifySection.style.display = "none";
	// Fill the settings fields with current user info
	elements.accountSettingsUsername.value = getAuth()!.account!.username;
	elements.accountSettingsEmail.value = getAuth()!.account!.email;
	accountModal.show();
});

// Handle logout functionality
elements.accountLogoutButton.addEventListener('click', async () => {
	if (!getAuth()?.account) return;
	await getAuth()!.logout();
	localStorage.removeItem("collabvm_session_" + new URL(getAuth()!.apiEndpoint).host);
	if (getAuth()) closeVM();
	renderAuth();
});

// Show password reset section in modal
elements.accountForgotPasswordButton.addEventListener('click', () => {
	elements.accountModalTitle.innerText = TheI18n.GetString(I18nStringKey.kAccountModal_ResetPassword);
	elements.accountLoginSection.style.display = "none";
	elements.accountResetPasswordSection.style.display = "block";
});

// Track which account is currently in the email verification step
let accountBeingVerified;

elements.accountLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Prepare hCaptcha
    var hcaptchaToken = undefined;
    var hcaptchaID = undefined;
    if (getAuth()!.info!.hcaptcha?.required) {
        hcaptchaID = elements.accountLoginCaptchaContainer.getAttribute("data-hcaptcha-widget-id")!;
        var response = hcaptcha.getResponse(hcaptchaID);
        if (response === "") {
            // Show error if hCaptcha not completed
            elements.accountModalErrorText.innerHTML = TheI18n.GetString(I18nStringKey.kMissingCaptcha);
            elements.accountModalError.style.display = "block";
            return false;
        }
        hcaptchaToken = response;
    }

    // Prepare Turnstile captcha
    var turnstileToken = undefined;
    var turnstileID = undefined;
    if (getAuth()!.info!.turnstile?.required) {
        turnstileID = elements.accountLoginTurnstileContainer.getAttribute("data-turnstile-widget-id")!;
        var response: string = turnstile.getResponse(turnstileID) || "";
        if (response === "") {
            // Show error if Turnstile not completed
            elements.accountModalErrorText.innerHTML = TheI18n.GetString(I18nStringKey.kMissingCaptcha);
            elements.accountModalError.style.display = "block";
            return false;
        }
        turnstileToken = response;
    }

    // Prepare reCAPTCHA
    var recaptchaToken = undefined;
    var recaptchaID = undefined;
    if (getAuth()!.info!.recaptcha?.required) {
        recaptchaID = parseInt(elements.accountLoginRecaptchaContainer.getAttribute("data-recaptcha-widget-id")!);
        var response = grecaptcha.getResponse(recaptchaID);
        if (response === "") {
            // Show error if reCAPTCHA not completed
            elements.accountModalErrorText.innerHTML = TheI18n.GetString(I18nStringKey.kMissingCaptcha);
            elements.accountModalError.style.display = "block";
            return false;
        }
        recaptchaToken = response;
    }

    // Gather credentials
    var username = elements.accountLoginUsername.value;
    var password = elements.accountLoginPassword.value;

    // Attempt login
    var result = await getAuth()!.login(username, password, hcaptchaToken, turnstileToken, recaptchaToken);

    // Reset captchas if used
    if (getAuth()!.info!.hcaptcha?.required) hcaptcha.reset(hcaptchaID);
    if (getAuth()!.info!.turnstile?.required) turnstile.reset(turnstileID);
    if (getAuth()!.info!.recaptcha?.required) grecaptcha.reset(recaptchaID);

    if (result.success) {
        // Clear input fields on success
        elements.accountLoginUsername.value = "";
        elements.accountLoginPassword.value = "";
        if (result.verificationRequired) {
            // Show email verification step
            accountBeingVerified = result.username;
            elements.accountVerifyEmailText.innerText = TheI18n.GetString(I18nStringKey.kAccountModal_VerifyText, result.email!);
            elements.accountLoginSection.style.display = "none";
            elements.accountVerifyEmailSection.style.display = "block";
            return false;
        }
        // Save session token and finalize login
        localStorage.setItem("collabvm_session_" + new URL(getAuth()!.apiEndpoint).host, result.token!);
        loadAccount();
        accountModal.hide();
    } else {
        // Display login error
        elements.accountModalErrorText.innerHTML = result.error!;
        elements.accountModalError.style.display = "block";
    }

    return false;
});

elements.accountRegisterForm.addEventListener('submit', async (e) => {
	e.preventDefault();

	if (!getAuth()) {
	  elements.accountModalErrorText.innerHTML =
		TheI18n.GetString(I18nStringKey.kGeneric_No) ||
		"An unexpected error occurred.";
	  elements.accountModalError.style.display = 'block';
	  return false;
	}

	if (!getAuth()!.info) {
	  await getAuth()!.getAPIInformation();
	}
	const info = getAuth()!.info!;
  
	// hCaptcha
	let hcaptchaToken: string | undefined;
	if (info.hcaptcha?.required) {
	  const widgetId = elements.accountRegisterCaptchaContainer
		.getAttribute('data-hcaptcha-widget-id');
	  if (!widgetId) {
		elements.accountModalErrorText.innerHTML =
		  TheI18n.GetString(I18nStringKey.kMissingCaptcha);
		elements.accountModalError.style.display = 'block';
		return false;
	  }
	  const resp = (window as any).hcaptcha.getResponse(widgetId) || '';
	  if (!resp) {
		elements.accountModalErrorText.innerHTML =
		  TheI18n.GetString(I18nStringKey.kMissingCaptcha);
		elements.accountModalError.style.display = 'block';
		return false;
	  }
	  hcaptchaToken = resp;
	}
  
	// Turnstile
	let turnstileToken: string | undefined;
	if (info.turnstile?.required) {
	  const widgetId = elements.accountRegisterTurnstileContainer
		.getAttribute('data-turnstile-widget-id');
	  if (!widgetId) {
		elements.accountModalErrorText.innerHTML =
		  TheI18n.GetString(I18nStringKey.kMissingCaptcha);
		elements.accountModalError.style.display = 'block';
		return false;
	  }
	  const resp = (window as any).turnstile.getResponse(widgetId) || '';
	  if (!resp) {
		elements.accountModalErrorText.innerHTML =
		  TheI18n.GetString(I18nStringKey.kMissingCaptcha);
		elements.accountModalError.style.display = 'block';
		return false;
	  }
	  turnstileToken = resp;
	}
  
	// reCAPTCHA
	let recaptchaToken: string | undefined;
	if (info.recaptcha?.required) {
	  const idAttr = elements.accountRegisterRecaptchaContainer
		.getAttribute('data-recaptcha-widget-id');
	  const widgetNum = idAttr ? parseInt(idAttr, 10) : NaN;
	  if (isNaN(widgetNum)) {
		elements.accountModalErrorText.innerHTML =
		  TheI18n.GetString(I18nStringKey.kMissingCaptcha);
		elements.accountModalError.style.display = 'block';
		return false;
	  }
	  const resp = (window as any).grecaptcha.getResponse(widgetNum) || '';
	  if (!resp) {
		elements.accountModalErrorText.innerHTML =
		  TheI18n.GetString(I18nStringKey.kMissingCaptcha);
		elements.accountModalError.style.display = 'block';
		return false;
	  }
	  recaptchaToken = resp;
	}
  
	// Collect form inputs and validate that password and confirmation match
	const username = elements.accountRegisterUsername.value;
	const password = elements.accountRegisterPassword.value;
	const email    = elements.accountRegisterEmail.value;
	const dob      = dayjs(elements.accountRegisterDateOfBirth.valueAsDate);
	if (password !== elements.accountRegisterConfirmPassword.value) {
	  elements.accountModalErrorText.innerHTML =
		TheI18n.GetString(I18nStringKey.kPasswordsMustMatch);
	  elements.accountModalError.style.display = 'block';
	  return false;
	}
  
	const result = await getAuth()!.register(
	  username, password, email, dob,
	  hcaptchaToken, turnstileToken, recaptchaToken
	);
  
	// reset captchas, handle success/error…
	return false;
  });
  
// Handle email verification form submission
elements.accountVerifyEmailForm.addEventListener('submit', async e => {
	e.preventDefault(); // prevent default form post
	var username = accountBeingVerified!; // use the account pending verification
	var code = elements.accountVerifyEmailCode.value; // get the verification code
	var password = elements.accountVerifyEmailPassword.value; // get the chosen password
	var result = await getAuth()!.verifyEmail(username, password, code); // call API to verify
	if (result!.success) {
		// clear input fields on success
		elements.accountVerifyEmailCode.value = "";
		elements.accountVerifyEmailPassword.value = "";
		// store session token and load session
		localStorage.setItem("collabvm_session_" + new URL(getAuth()!.apiEndpoint).host, result!.sessionToken!);
		await getAuth()!.loadSession(result!.sessionToken!);
		loadAccount(); // update UI for logged-in account
		accountModal.hide(); // close the modal
	} else {
		// show error message
		elements.accountModalErrorText.innerHTML = result!.error!;
		elements.accountModalError.style.display = "block";
	}
	return false; // prevent further handling
});

// Handle account settings update form submission
elements.accountSettingsForm.addEventListener('submit', async e => {
	e.preventDefault(); // prevent default form post
	var oldUsername = getAuth()!.account!.username; // current username
	var oldEmail = getAuth()!.account!.email;       // current email
	// determine if username/email/password fields changed
	var username = elements.accountSettingsUsername.value === getAuth()!.account!.username
		? undefined
		: elements.accountSettingsUsername.value;
	var email = elements.accountSettingsEmail.value === getAuth()!.account!.email
		? undefined
		: elements.accountSettingsEmail.value;
	var password = elements.accountSettingsNewPassword.value === ""
		? undefined
		: elements.accountSettingsNewPassword.value;
	var currentPassword = elements.accountSettingsCurrentPassword.value; // required to authorize update
	// validate new password match
	if (password && password !== elements.accountSettingsConfirmNewPassword.value) {
		elements.accountModalErrorText.innerHTML = TheI18n.GetString(I18nStringKey.kPasswordsMustMatch);
		elements.accountModalError.style.display = "block";
		return false;
	}
	// remember hide-flag setting
	localStorage.setItem("collabvm-hide-flag", JSON.stringify(elements.hideFlagCheckbox.checked));
	// if nothing changed, just close modal
	if (!password && !email && !username) {
		accountModal.hide();
		return false;
	}
	// attempt account update
	var result = await getAuth()!.updateAccount(currentPassword, email, username, password);
	if (result!.success) {
		// clear password inputs
		elements.accountSettingsNewPassword.value = "";
		elements.accountSettingsConfirmNewPassword.value = "";
		elements.accountSettingsCurrentPassword.value = "";
		if (result!.verificationRequired) {
			// if email change needs verification, show verify step
			renderAuth();
			accountBeingVerified = username ?? oldUsername;
			elements.accountVerifyEmailText.innerText = TheI18n.GetString(
				I18nStringKey.kAccountModal_VerifyText,
				email ?? oldEmail
			);
			elements.accountSettingsSection.style.display = "none";
			elements.accountVerifyEmailSection.style.display = "block";
			return false;
		} else if (result!.sessionExpired) {
			// if session expired, log out and refresh UI
			accountModal.hide();
			localStorage.removeItem("collabvm_session_" + new URL(getAuth()!.apiEndpoint).host);
			if (getActiveVM()) closeVM();
			renderAuth();
		} else {
			// nothing special, just close modal
			accountModal.hide();
		}
	} else {
		// show update error
		elements.accountModalErrorText.innerHTML = result!.error!;
		elements.accountModalError.style.display = "block";
	}
	return false;
});

// Track username/email used for password reset
let resetPasswordUsername;
let resetPasswordEmail;

// Handle reset password email request form submission
elements.accountResetPasswordForm.addEventListener('submit', async e => {
	e.preventDefault(); // prevent default form post

	// prepare hCaptcha token if required
	var hcaptchaToken = undefined;
	var hcaptchaID = undefined;
	if (getAuth()!.info!.hcaptcha?.required) {
		hcaptchaID = elements.accountResetPasswordCaptchaContainer.getAttribute("data-hcaptcha-widget-id")!;
		var response = hcaptcha.getResponse(hcaptchaID);
		if (response === "") {
			elements.accountModalErrorText.innerHTML = TheI18n.GetString(I18nStringKey.kMissingCaptcha);
			elements.accountModalError.style.display = "block";
			return false;
		}
		hcaptchaToken = response;
	}

	// prepare Turnstile if required
	var turnstileToken = undefined;
	var turnstileID = undefined;
	if (getAuth()!.info!.turnstile?.required) {
		turnstileID = elements.accountResetPasswordTurnstileContainer.getAttribute("data-turnstile-widget-id")!;
		var response: string = turnstile.getResponse(turnstileID) || "";
		if (response === "") {
			elements.accountModalErrorText.innerHTML = TheI18n.GetString(I18nStringKey.kMissingCaptcha);
			elements.accountModalError.style.display = "block";
			return false;
		}
		turnstileToken = response;
	}

	// prepare reCAPTCHA if required
	var recaptchaToken = undefined;
	var recaptchaID = undefined;
	if (getAuth()!.info!.recaptcha?.required) {
		recaptchaID = parseInt(elements.accountResetPasswordRecaptchaContainer.getAttribute("data-recaptcha-widget-id")!);
		var response = grecaptcha.getResponse(recaptchaID);
		if (response === "") {
			elements.accountModalErrorText.innerHTML = TheI18n.GetString(I18nStringKey.kMissingCaptcha);
			elements.accountModalError.style.display = "block";
			return false;
		}
		recaptchaToken = response;
	}

	// gather reset request data
	var username = elements.accountResetPasswordUsername.value;
	var email = elements.accountResetPasswordEmail.value;
	var result = await getAuth()!.sendPasswordResetEmail(username, email, hcaptchaToken, turnstileToken, recaptchaToken);

	// reset captchas if used
	if (getAuth()!.info!.hcaptcha?.required) hcaptcha.reset(hcaptchaID);
	if (getAuth()!.info!.turnstile?.required) turnstile.reset(turnstileID);
	if (getAuth()!.info!.recaptcha?.required) grecaptcha.reset(recaptchaID);

	if (result!.success) {
		// store for verification step
		resetPasswordUsername = username;
		resetPasswordEmail = email;
		// clear inputs
		elements.accountResetPasswordUsername.value = "";
		elements.accountResetPasswordEmail.value = "";
		// show verify-reset step
		elements.accountVerifyPasswordResetText.innerText = TheI18n.GetString(
			I18nStringKey.kAccountModal_VerifyPasswordResetText,
			email
		);
		elements.accountResetPasswordSection.style.display = "none";
		elements.accountResetPasswordVerifySection.style.display = "block";
	} else {
		// show error
		elements.accountModalErrorText.innerHTML = result!.error!;
		elements.accountModalError.style.display = "block";
	}
	return false;
});

// Handle password reset verification form submission
elements.accountResetPasswordVerifyForm.addEventListener('submit', async e => {
	e.preventDefault(); // prevent default form post
	var code = elements.accountResetPasswordCode.value; // get code
	var password = elements.accountResetPasswordNewPassword.value; // new password
	// validate password confirmation
	if (password !== elements.accountResetPasswordConfirmNewPassword.value) {
		elements.accountModalErrorText.innerHTML = TheI18n.GetString(I18nStringKey.kPasswordsMustMatch);
		elements.accountModalError.style.display = "block";
		return false;
	}
	// attempt final password reset
	var result = await getAuth()!.resetPassword(resetPasswordUsername!, resetPasswordEmail!, code, password);
	if (result!.success) {
		// clear fields on success
		elements.accountResetPasswordCode.value = "";
		elements.accountResetPasswordNewPassword.value = "";
		elements.accountResetPasswordConfirmNewPassword.value = "";
		// show success message and return to login
		elements.accountModalSuccessText.innerHTML = TheI18n.GetString(I18nStringKey.kAccountModal_PasswordResetSuccess);
		elements.accountModalSuccess.style.display = "block";
		elements.accountResetPasswordVerifySection.style.display = "none";
		elements.accountLoginSection.style.display = "block";
	} else {
		// show reset error
		elements.accountModalErrorText.innerHTML = result!.error!;
		elements.accountModalError.style.display = "block";
	}
	return false;
});

export function onLogin(_rank: Rank, _perms: Permissions) {
    // Update globals
    setRank(_rank);
    setPerms(_perms);

    // Cache commonly used elements
    const { username: userEl, staffbtns, restoreBtn, rebootBtn,
            bypassTurnBtn, endTurnBtn, clearQueueBtn,
            qemuMonitorBtn, indefTurnBtn, ghostTurnBtn,
            xssCheckboxContainer, forceVotePanel } = elements;

    // Update user class
    userEl.classList.remove('username-unregistered', 'username-registered');
    if (_rank === Rank.Admin) {
        userEl.classList.add('username-admin');
    } else if (_rank === Rank.Moderator) {
        userEl.classList.add('username-moderator');
    } else if (_rank === Rank.Registered) {
        userEl.classList.add('username-registered');
    }

    // Show staff controls
    staffbtns.style.display = 'block';

    // Permission buttons
    if (_perms.restore)    restoreBtn.style.display = 'inline-block';
    if (_perms.reboot)     rebootBtn.style.display = 'inline-block';
    if (_perms.bypassturn) {
        [bypassTurnBtn, endTurnBtn, clearQueueBtn]
            .forEach(btn => btn.style.display = 'inline-block');
    }
    if (_rank === Rank.Admin) {
        [qemuMonitorBtn, indefTurnBtn, ghostTurnBtn]
            .forEach(btn => btn.style.display = 'inline-block');
    }
    if (_perms.xss)        xssCheckboxContainer.style.display = 'inline-block';
    if (_perms.forcevote)  forceVotePanel.style.display = 'block';

    // Enable mod options on all users if not just a simple Registered
    if (_rank !== Rank.Registered) {
        users.forEach(entry => userModOptions(entry));
    }
}

export function doLogin() {
	const activeVM = getActiveVM();
    const pass = elements.adminPassword.value;
    if (!pass) return;

    activeVM?.login(pass);
    elements.adminPassword.value = '';

    const offLogin = activeVM?.on('login', () => {
        offLogin?.();
        loginModal.hide();
        elements.badPasswordAlert.style.display = 'none';
    });

    const offBadPw = activeVM?.on('badpw', () => {
        offBadPw?.();
        elements.badPasswordAlert.style.display = 'block';
    });
}
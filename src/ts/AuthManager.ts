import * as dayjs from 'dayjs';
import { elements } from './dom';

export default class AuthManager {
    apiEndpoint : string;
    info : AuthServerInformation | null;
    account : Account | null;
    constructor(apiEndpoint : string) {
        this.apiEndpoint = apiEndpoint;
        this.info = null;
        this.account = null;
    }

    public async getAPIInformation(): Promise<AuthServerInformation | null> {
        try {
          const res = await fetch(`${this.apiEndpoint}/api/v1/info`);
          const contentType = res.headers.get('Content-Type') ?? '';
          if (!res.ok || !contentType.includes('application/json')) {
            console.warn(
              `Expected JSON at ${res.url} but got ${contentType} [${res.status}]`
            );
            return null;
          }
          const info = (await res.json()) as AuthServerInformation;
          this.info = info;
          return info;
        } catch (err) {
          console.warn('Error fetching API information:', err);
          return null;
        }
      }      

      public async login(
        username: string,
        password: string,
        captchaToken?: string,
        turnstileToken?: string,
        recaptchaToken?: string
      ): Promise<AccountLoginResult> {
        if (!this.info) {
          throw new Error("Cannot login before fetching API information.");
        }
        if (!captchaToken && this.info.hcaptcha?.required) {
          throw new Error("This API requires a valid hCaptcha token.");
        }
        if (!turnstileToken && this.info.turnstile?.required) {
          throw new Error("This API requires a valid Turnstile token.");
        }
        if (!recaptchaToken && this.info.recaptcha?.required) {
          throw new Error("This API requires a valid reCAPTCHA token.");
        }
      
        const res = await fetch(`${this.apiEndpoint}/api/v1/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username,
            password,
            captchaToken,
            turnstileToken,
            recaptchaToken
          })
        });
      
        const result = (await res.json()) as AccountLoginResult;
      
        if (!result.success) {
          // server rejected credentials or other error
          console.error(`API returned ${res.status}: ${result.error}`);
          elements.accountModalErrorText.innerText = result.error || "Login failed";
          elements.accountModalError.style.display = "block";
        } else if (!result.verificationRequired) {
          this.account = {
            username:     result.username!,
            email:        result.email!,
            sessionToken: result.token!
          };
        }
      
        return result;
      }                

      public async loadSession(token: string): Promise<SessionResult | null> {
        try {
          const res = await fetch(`${this.apiEndpoint}/api/v1/session`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token })
          });
      
          const ct = res.headers.get("Content-Type") ?? "";
          if (!res.ok || !ct.includes("application/json")) {
            console.warn(
              `loadSession expected JSON but got [${ct}] with status ${res.status}`
            );
            return null;
          }
      
          const json = (await res.json()) as SessionResult;
          if (json.success) {
            this.account = {
              sessionToken: token,
              username:     json.username!,
              email:        json.email!
            };
          }
          return json;
        } catch (err) {
          console.warn("Error in loadSession:", err);
          return null;
        }
      }      

      public async register(
        username: string,
        password: string,
        email: string,
        dateOfBirth: dayjs.Dayjs,
        captchaToken?: string,
        turnstileToken?: string,
        recaptchaToken?: string
      ): Promise<AccountRegisterResult | null> {
        if (!this.info) {
          throw new Error("Cannot register before fetching API information.");
        }
        if (!captchaToken && this.info.hcaptcha?.required) {
          throw new Error("This API requires a valid hCaptcha token.");
        }
        if (!turnstileToken && this.info.turnstile?.required) {
          throw new Error("This API requires a valid Turnstile token.");
        }
        if (!recaptchaToken && this.info.recaptcha?.required) {
          throw new Error("This API requires a valid reCAPTCHA token.");
        }
      
        const res = await fetch(`${this.apiEndpoint}/api/v1/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username,
            password,
            email,
            dateOfBirth: dateOfBirth.format("YYYY-MM-DD"),
            captchatoken: captchaToken,
            turnstiletoken: turnstileToken,
            recaptchaToken
          })
        });
      
        // parse the JSON even if res.ok is false
        const result = (await res.json()) as AccountRegisterResult;
      
        // server rejected credentials or other error
        if (!res.ok) {
          console.error(`API returned ${res.status}: ${result.error}`);
          elements.accountModalErrorText.innerText = result.error || "Registration failed";
          elements.accountModalError.style.display = "block";
          return result;
        }
      
        // at this point result.success should be true
        return result;
      }          

      public async logout(): Promise<LogoutResult | null> {
        if (!this.account) {
          throw new Error("Cannot log out without logging in first");
        }
      
        try {
          const res = await fetch(`${this.apiEndpoint}/api/v1/logout`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: this.account.sessionToken })
          });
      
          const result = (await res.json()) as LogoutResult;
          this.account = null;
          return result;
        } catch (err) {
          console.warn("Error during logout:", err);
          return null;
        }
      }
      
      public async verifyEmail(
        username: string,
        password: string,
        code: string
      ): Promise<VerifyEmailResult | null> {
        try {
          const res = await fetch(`${this.apiEndpoint}/api/v1/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password, code })
          });
      
          const ct = res.headers.get("Content-Type") ?? "";
          if (!res.ok || !ct.includes("application/json")) {
            console.warn(
              `VerifyEmail expected JSON but got [${ct}] with status ${res.status}`
            );
            return null;
          }
      
          return (await res.json()) as VerifyEmailResult;
        } catch (err) {
          console.warn("Error during email verification:", err);
          return null;
        }
      }      

      public async updateAccount(
        currentPassword: string,
        newEmail?: string,
        newUsername?: string,
        newPassword?: string
      ): Promise<UpdateAccountResult | null> {
        if (!this.account) {
          throw new Error("Cannot update account without being logged in.");
        }
        if (!newEmail && !newUsername && !newPassword) {
          throw new Error("Cannot update account without any new information.");
        }
      
        try {
          const res = await fetch(`${this.apiEndpoint}/api/v1/update`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              token:           this.account.sessionToken,
              currentPassword,
              newPassword,
              username:        newUsername,
              email:           newEmail,
            })
          });
      
          const ct = res.headers.get("Content-Type") ?? "";
          if (!res.ok || !ct.includes("application/json")) {
            console.warn(
              `updateAccount expected JSON but got [${ct}] with status ${res.status}`
            );
            return null;
          }
      
          const json = (await res.json()) as UpdateAccountResult;
          if (json.success) {
            if (newEmail && this.account.email !== newEmail) {
              this.account.email = newEmail;
            }
            if (newUsername && this.account.username !== newUsername) {
              this.account.username = newUsername;
            }
            if (json.sessionExpired || json.verificationRequired) {
              this.account = null;
            }
          }
          return json;
        } catch (err) {
          console.warn("Error in updateAccount:", err);
          return null;
        }
      }      

      public async sendPasswordResetEmail(
        username: string,
        email: string,
        captchaToken?: string,
        turnstileToken?: string,
        recaptchaToken?: string
      ): Promise<PasswordResetResult | null> {
        if (!this.info) {
          throw new Error("Cannot send password reset email without fetching API information.");
        }
        if (!captchaToken && this.info.hcaptcha?.required) {
          throw new Error("This API requires a valid hCaptcha token.");
        }
        if (!turnstileToken && this.info.turnstile?.required) {
          throw new Error("This API requires a valid Turnstile token.");
        }
        if (!recaptchaToken && this.info.recaptcha?.required) {
          throw new Error("This API requires a valid reCAPTCHA token.");
        }
      
        try {
          const res = await fetch(`${this.apiEndpoint}/api/v1/sendreset`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              username,
              email,
              captchaToken,
              turnstileToken,
              recaptchaToken
            })
          });
      
          const ct = res.headers.get("Content-Type") ?? "";
          if (!res.ok || !ct.includes("application/json")) {
            console.warn(
              `sendPasswordResetEmail expected JSON but got [${ct}] with status ${res.status}`
            );
            return null;
          }
      
          return (await res.json()) as PasswordResetResult;
        } catch (err) {
          console.warn("Error sending password reset email:", err);
          return null;
        }
      }

      public async resetPassword(
        username: string,
        email: string,
        code: string,
        newPassword: string
      ): Promise<PasswordResetResult | null> {
        try {
          const res = await fetch(`${this.apiEndpoint}/api/v1/reset`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, email, code, newPassword })
          });
      
          const ct = res.headers.get("Content-Type") ?? "";
          if (!res.ok || !ct.includes("application/json")) {
            console.warn(
              `resetPassword expected JSON but got [${ct}] with status ${res.status}`
            );
            return null;
          }
      
          return (await res.json()) as PasswordResetResult;
        } catch (err) {
          console.warn("Error resetting password:", err);
          return null;
        }
      }
    }

export interface AuthServerInformation {
    registrationOpen : boolean;
    hcaptcha : {
        required : boolean;
        siteKey : string | undefined;
    };
    turnstile : {
        required : boolean;
        siteKey : string | undefined;
    };
    recaptcha : {
        required : boolean;
        siteKey : string | undefined;
    }
}

export interface AccountRegisterResult {
    success : boolean;
    error : string | undefined;
    verificationRequired : boolean | undefined;
    username : string | undefined;
    email : string | undefined;
    sessionToken : string | undefined;
}

export interface AccountLoginResult {
    success : boolean;
    token : string | undefined;
    error : string | undefined;
    verificationRequired : boolean | undefined;
    email : string | undefined;
    username : string | undefined;
}

export interface SessionResult {
    success : boolean;
    error : string | undefined;
    banned : boolean;
    username : string | undefined;
    email : string | undefined;
}

export interface VerifyEmailResult {
    success : boolean;
    error : string | undefined;
    sessionToken : string | undefined;
}

export interface LogoutResult {
    success : boolean;
    error : string | undefined;
}

export interface Account {
    username : string;
    email : string;
    sessionToken : string;
}

export interface UpdateAccountResult {
    success : boolean;
    error : string | undefined;
    verificationRequired : boolean | undefined;
    sessionExpired : boolean | undefined;
}

export interface PasswordResetResult {
    success : boolean;
    error : string | undefined;
}

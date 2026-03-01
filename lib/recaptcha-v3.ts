"use client";

type RecaptchaV3Api = {
  ready: (cb: () => void) => void;
  execute: (siteKey: string, options: { action: string }) => Promise<string>;
};

const RECAPTCHA_V3_SCRIPT_ID = "recaptcha-v3-script";
let scriptLoadPromise: Promise<void> | null = null;
let loadedSiteKey: string | null = null;

function hasExecutableGrecaptcha() {
  const grecaptcha = (window as Window & { grecaptcha?: RecaptchaV3Api }).grecaptcha;

  return Boolean(
    typeof window !== "undefined" &&
      grecaptcha &&
      typeof grecaptcha.ready === "function" &&
      typeof grecaptcha.execute === "function"
  );
}

function waitForExecutableGrecaptcha(timeoutMs = 5000) {
  return new Promise<void>((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (hasExecutableGrecaptcha()) {
        resolve();
        return;
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error("Timeout ao carregar reCAPTCHA v3."));
        return;
      }
      setTimeout(check, 50);
    };
    check();
  });
}

async function ensureRecaptchaScript(siteKey: string) {
  if (hasExecutableGrecaptcha() && loadedSiteKey === siteKey) {
    return;
  }

  if (!scriptLoadPromise || loadedSiteKey !== siteKey) {
    scriptLoadPromise = new Promise<void>((resolve, reject) => {
      const existingScript = document.getElementById(RECAPTCHA_V3_SCRIPT_ID) as HTMLScriptElement | null;

      if (existingScript) {
        loadedSiteKey = siteKey;
        waitForExecutableGrecaptcha().then(resolve).catch(reject);
        return;
      }

      const script = document.createElement("script");
      script.id = RECAPTCHA_V3_SCRIPT_ID;
      script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
      script.async = true;
      script.defer = true;
      script.onload = async () => {
        try {
          loadedSiteKey = siteKey;
          await waitForExecutableGrecaptcha();
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      script.onerror = () => {
        reject(new Error("Falha ao carregar script do reCAPTCHA."));
      };
      document.head.appendChild(script);
    });
  }

  await scriptLoadPromise;
}

export async function getRecaptchaV3Token(siteKey: string, action: string) {
  await ensureRecaptchaScript(siteKey);

  return await new Promise<string>((resolve, reject) => {
    const grecaptcha = (window as Window & { grecaptcha?: RecaptchaV3Api }).grecaptcha;

    if (!grecaptcha) {
      reject(new Error("reCAPTCHA indisponível."));
      return;
    }

    grecaptcha.ready(() => {
      grecaptcha
        .execute(siteKey, { action })
        .then(resolve)
        .catch((error) => {
          reject(error);
        });
    });
  });
}

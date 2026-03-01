"use client";

import { useEffect, useRef, useState, useCallback } from "react";

type RecaptchaV2Api = {
  ready?: (cb: () => void) => void;
  render: (
    container: HTMLElement,
    params: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback"?: () => void;
      theme?: string;
      size?: string;
    }
  ) => number;
  reset: (widgetId: number) => void;
};

interface CaptchaWidgetProps {
  siteKey: string;
  onVerify: (token: string) => void;
  onExpire?: () => void;
  theme?: "light" | "dark";
}

const RECAPTCHA_SCRIPT_ID = "recaptcha-script";

function isRecaptchaRenderable() {
  const grecaptcha = (window as Window & { grecaptcha?: RecaptchaV2Api }).grecaptcha;

  return Boolean(
    typeof window !== "undefined" &&
      grecaptcha &&
      typeof grecaptcha.render === "function"
  );
}

export function CaptchaWidget({ siteKey, onVerify, onExpire, theme = "dark" }: CaptchaWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  const renderCaptcha = useCallback(() => {
    if (!containerRef.current || !isRecaptchaRenderable() || widgetIdRef.current !== null) return;
    const grecaptcha = (window as Window & { grecaptcha?: RecaptchaV2Api }).grecaptcha;

    if (!grecaptcha) return;

    try {
      widgetIdRef.current = grecaptcha.render(containerRef.current, {
        sitekey: siteKey,
        callback: onVerify,
        "expired-callback": onExpire,
        theme,
      });
    } catch (error) {
      console.error("Erro ao renderizar reCAPTCHA:", error);
    }
  }, [siteKey, onVerify, onExpire, theme]);

  useEffect(() => {
    // Check if already loaded
    if (isRecaptchaRenderable()) {
      setLoaded(true);
      return;
    }

    // Check if script already exists
    if (document.getElementById(RECAPTCHA_SCRIPT_ID)) {
      const checkInterval = setInterval(() => {
        if (isRecaptchaRenderable()) {
          setLoaded(true);
          clearInterval(checkInterval);
        }
      }, 100);
      return () => clearInterval(checkInterval);
    }

    // Load reCAPTCHA script
    (window as Window & { onRecaptchaLoad?: () => void }).onRecaptchaLoad = () => {
      if (isRecaptchaRenderable()) {
        setLoaded(true);
        return;
      }

      const checkInterval = setInterval(() => {
        if (isRecaptchaRenderable()) {
          setLoaded(true);
          clearInterval(checkInterval);
        }
      }, 100);
    };

    const script = document.createElement("script");
    script.id = RECAPTCHA_SCRIPT_ID;
    script.src = "https://www.google.com/recaptcha/api.js?onload=onRecaptchaLoad&render=explicit";
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    return () => {
      delete (window as Window & { onRecaptchaLoad?: () => void }).onRecaptchaLoad;
    };
  }, []);

  useEffect(() => {
    if (loaded) {
      renderCaptcha();
    }
  }, [loaded, renderCaptcha]);

  return (
    <div>
      <div ref={containerRef} />
      {!loaded && (
        <p className="text-xs text-muted-foreground">A carregar CAPTCHA...</p>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, useCallback } from "react";

declare global {
  interface Window {
    grecaptcha?: {
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
    onRecaptchaLoad?: () => void;
  }
}

interface CaptchaWidgetProps {
  siteKey: string;
  onVerify: (token: string) => void;
  onExpire?: () => void;
  theme?: "light" | "dark";
}

const RECAPTCHA_SCRIPT_ID = "recaptcha-script";

export function CaptchaWidget({ siteKey, onVerify, onExpire, theme = "dark" }: CaptchaWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  const renderCaptcha = useCallback(() => {
    if (!containerRef.current || !window.grecaptcha || widgetIdRef.current !== null) return;

    widgetIdRef.current = window.grecaptcha.render(containerRef.current, {
      sitekey: siteKey,
      callback: onVerify,
      "expired-callback": onExpire,
      theme,
    });
  }, [siteKey, onVerify, onExpire, theme]);

  useEffect(() => {
    // Check if already loaded
    if (window.grecaptcha) {
      setLoaded(true);
      return;
    }

    // Check if script already exists
    if (document.getElementById(RECAPTCHA_SCRIPT_ID)) {
      const checkInterval = setInterval(() => {
        if (window.grecaptcha) {
          setLoaded(true);
          clearInterval(checkInterval);
        }
      }, 100);
      return () => clearInterval(checkInterval);
    }

    // Load reCAPTCHA script
    window.onRecaptchaLoad = () => {
      setLoaded(true);
    };

    const script = document.createElement("script");
    script.id = RECAPTCHA_SCRIPT_ID;
    script.src = "https://www.google.com/recaptcha/api.js?onload=onRecaptchaLoad&render=explicit";
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    return () => {
      delete window.onRecaptchaLoad;
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

"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function shouldShowRecaptchaBadge(pathname: string) {
  return pathname === "/login" || pathname.startsWith("/register");
}

export function RecaptchaBadgeController() {
  const pathname = usePathname();

  useEffect(() => {
    const visible = shouldShowRecaptchaBadge(pathname);

    if (visible) {
      document.body.classList.add("recaptcha-badge-visible");
    } else {
      document.body.classList.remove("recaptcha-badge-visible");
    }
  }, [pathname]);

  return null;
}

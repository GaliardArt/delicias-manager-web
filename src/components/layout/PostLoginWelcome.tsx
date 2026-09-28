"use client";

import { useEffect, useState } from "react";
import { WelcomeScreen } from "./WelcomeScreen";

export const POST_LOGIN_WELCOME_KEY = "delicias-manager:post-login-welcome";

export function PostLoginWelcome() {
  const [name, setName] = useState<string | null>(null);
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    try {
      const pendingName = sessionStorage.getItem(POST_LOGIN_WELCOME_KEY);
      if (!pendingName) return;

      sessionStorage.removeItem(POST_LOGIN_WELCOME_KEY);
      setName(pendingName);

      const fadeTimer = window.setTimeout(() => setFadingOut(true), 1250);
      return () => window.clearTimeout(fadeTimer);
    } catch (error) {
      console.error(error);
    }
  }, []);

  if (!name) return null;

  return <WelcomeScreen name={name} fadingOut={fadingOut} />;
}

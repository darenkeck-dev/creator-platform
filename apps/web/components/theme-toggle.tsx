"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

type Theme = "dark" | "light";

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") {
      return "dark";
    }

    return localStorage.getItem("mm_theme") === "light" ? "light" : "dark";
  });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = () => {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    applyTheme(nextTheme);
    localStorage.setItem("mm_theme", nextTheme);
  };

  return (
    <Button variant="outline" size="sm" onClick={toggleTheme}>
      {theme === "dark" ? "Light mode" : "Dark mode"}
    </Button>
  );
}

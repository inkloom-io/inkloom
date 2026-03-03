import { useEffect, useState, useCallback } from "react";
import { useLocation } from "react-router";

export function ReadingProgress() {
  const { pathname } = useLocation();
  const [progress, setProgress] = useState(0);

  const updateProgress = useCallback(() => {
    const scrollTop = window.scrollY;
    const docHeight =
      document.documentElement.scrollHeight - window.innerHeight;
    setProgress(docHeight > 0 ? Math.min((scrollTop / docHeight) * 100, 100) : 0);
  }, []);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          updateProgress();
          ticking = false;
        });
        ticking = true;
      }
    };

    updateProgress();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", updateProgress, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", updateProgress);
    };
  }, [updateProgress]);

  // Recalculate when route changes
  useEffect(() => {
    updateProgress();
  }, [pathname, updateProgress]);

  return (
    <div
      className="fixed top-0 left-0 z-[100] h-[3px]"
      style={{
        width: `${progress}%`,
        background:
          "linear-gradient(to right, var(--color-primary), color-mix(in srgb, var(--color-primary) 60%, white))",
        opacity: progress > 0 ? 1 : 0,
      }}
    />
  );
}

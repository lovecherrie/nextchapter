"use client";

import { useEffect } from "react";

const controls = 'button, a.aepilog-pressable, a[href][class*="rounded-full"]';

export default function ClickFeedback() {
  useEffect(() => {
    const running = new WeakMap<HTMLElement, Animation>();
    const active = new Set<Animation>();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    function click(event: MouseEvent) {
      if (event.button !== 0 || reduced.matches || !(event.target instanceof Element)) return;
      const target = event.target.closest(controls);
      if (!(target instanceof HTMLElement) || target.matches(':disabled, [aria-disabled="true"]') || !target.animate) return;
      running.get(target)?.cancel();
      const rest = window.matchMedia("(hover: hover) and (pointer: fine)").matches && target.matches(":hover") ? "1.015" : "1";
      const animation = target.animate([
        { scale: ".95" },
        { scale: "1.035", offset: .55 },
        { scale: rest },
      ], { duration: 240, easing: "cubic-bezier(.2,.8,.2,1)" });
      running.set(target, animation);
      active.add(animation);
      void animation.finished.catch(() => {}).finally(() => active.delete(animation));
    }
    const motionChanged = () => { if (reduced.matches) active.forEach((animation) => animation.cancel()); };
    document.addEventListener("click", click, true);
    reduced.addEventListener("change", motionChanged);
    return () => { document.removeEventListener("click", click, true); reduced.removeEventListener("change", motionChanged); active.forEach((animation) => animation.cancel()); };
  }, []);
  return null;
}

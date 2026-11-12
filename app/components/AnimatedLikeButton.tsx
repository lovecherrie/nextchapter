"use client";

import { useEffect, useRef, type ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { liked: boolean };

export default function AnimatedLikeButton({ liked, children, onClick, className = "", ...props }: Props) {
  const heart = useRef<HTMLSpanElement>(null);
  const animation = useRef<Animation | null>(null);
  useEffect(() => () => animation.current?.cancel(), []);

  return <button type="button" {...props} aria-pressed={liked}
    aria-label={props["aria-label"] || (liked ? "Unlike discussion" : "Like discussion")}
    className={`inline-flex items-center gap-1.5 ${className}`}
    onClick={(event) => {
      // Respond to the tap immediately; the existing handler still owns saving.
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches && heart.current?.animate) {
        animation.current?.cancel();
        animation.current = heart.current.animate(liked ? [
          { transform: "scale(1)" }, { transform: "scale(.8)" }, { transform: "scale(1)" },
        ] : [
          { transform: "scale(.65) rotate(-12deg)" },
          { transform: "scale(1.35) rotate(5deg)", offset: .4 },
          { transform: "scale(.94) rotate(-2deg)", offset: .75 },
          { transform: "scale(1) rotate(0)" },
        ], { duration: liked ? 180 : 280, easing: "ease-out" });
      }
      onClick?.(event);
    }}>
    <span ref={heart} aria-hidden="true" className="inline-flex shrink-0">
      <svg viewBox="0 0 24 24" className="h-[19px] w-[19px]" fill={liked ? "currentColor" : "none"}>
        <path d="M12 20.25C10.6 19.04 3 14.15 2.35 9.05C1.9 5.5 4.45 2.75 7.55 2.75C9.55 2.75 11.05 3.8 12 5.15C12.95 3.8 14.45 2.75 16.45 2.75C19.55 2.75 22.1 5.5 21.65 9.05C21 14.15 13.4 19.04 12 20.25Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
    {children}
  </button>;
}

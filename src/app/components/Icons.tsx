import type { SVGProps } from "react";

export function Mark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <rect
        x="1.1"
        y="1.1"
        width="21.8"
        height="21.8"
        rx="6.4"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="8.2" cy="12" r="2.4" fill="currentColor" />
      <circle cx="15.8" cy="12" r="2.4" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10.7 12h2.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function Play(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path d="M4.5 3.2v9.6L12.8 8 4.5 3.2Z" fill="currentColor" />
    </svg>
  );
}

export function Pause(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <rect x="4" y="3" width="2.6" height="10" fill="currentColor" />
      <rect x="9.4" y="3" width="2.6" height="10" fill="currentColor" />
    </svg>
  );
}

export function ArrowRight(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path d="M2.5 8h10M9 4.5 12.5 8 9 11.5" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

export function ArrowDown(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path d="M8 2.5v10M4.5 9 8 12.5 11.5 9" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

export function Lock(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <rect x="3.2" y="7" width="9.6" height="6.4" stroke="currentColor" strokeWidth="1.1" />
      <path d="M5.4 7V5.2a2.6 2.6 0 0 1 5.2 0V7" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

export function Sprig(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M12 21V7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path
        d="M12 14.6c-3.5 0-5.4-2.1-5.4-5.6 3.5 0 5.4 2.1 5.4 5.6Z"
        fill="currentColor"
        opacity="0.85"
      />
      <path d="M12 11.6c0-3.5 1.9-5.6 5.4-5.6 0 3.5-1.9 5.6-5.4 5.6Z" fill="currentColor" />
    </svg>
  );
}

export function Check(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path d="m3.2 8.4 3.2 3.2 6.4-7" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function PlusMinus({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8h10" stroke="currentColor" strokeWidth="1.2" />
      {!open && <path d="M8 3v10" stroke="currentColor" strokeWidth="1.2" />}
    </svg>
  );
}

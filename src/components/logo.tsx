export function Logo({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={`fill-current ${className}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M 40 80 L 100 60 L 120 140 L 80 160 Z" />
      <circle cx="110" cy="85" r="12" fill="#ff7a1a" />
    </svg>
  );
}

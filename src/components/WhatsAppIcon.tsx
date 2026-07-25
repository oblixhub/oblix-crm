interface WhatsAppIconProps {
  size?: number;
}

export function WhatsAppIcon({ size = 18 }: WhatsAppIconProps) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M20.5 11.7a8.5 8.5 0 0 1-12.6 7.45L3 20.45l1.3-4.73A8.5 8.5 0 1 1 20.5 11.7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.15 7.55c.2-.45.42-.46.7-.47h.6c.17 0 .36.05.45.34l.68 1.65c.08.2.03.38-.1.55l-.52.65c-.14.16-.12.31-.03.48.58 1.02 1.42 1.84 2.45 2.4.18.1.33.1.47-.07l.72-.83c.15-.18.35-.22.55-.14l1.7.8c.2.1.34.18.38.34.04.16.04.93-.27 1.62-.3.7-1.42 1.3-2.3 1.34-.6.03-1.35.12-3.66-.86-3.08-1.3-5.08-4.5-5.23-4.7-.14-.2-1.23-1.64-1.23-3.12 0-1.47.77-2.2 1.05-2.5Z"
        fill="currentColor"
        transform="translate(2.2 1.2) scale(.82)"
      />
    </svg>
  );
}

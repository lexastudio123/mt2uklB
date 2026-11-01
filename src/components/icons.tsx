// Line icons from the design. Size them with CSS or the width/height props.
import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const base = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'aria-hidden': true } as const;

export const IconMenu = (p: P) => (<svg {...base} strokeWidth={1.8} strokeLinecap="round" {...p}><path d="M4 7h16M4 12h16M4 17h16" /></svg>);
export const IconUser = (p: P) => (<svg {...base} strokeWidth={1.8} {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>);
export const IconSearch = (p: P) => (<svg {...base} strokeWidth={1.8} {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>);
export const IconBag = (p: P) => (<svg {...base} strokeWidth={1.8} {...p}><path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>);
export const IconX = (p: P) => (<svg {...base} strokeWidth={2} {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>);
export const IconLock = (p: P) => (<svg {...base} strokeWidth={1.8} {...p}><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>);
export const IconTruck = (p: P) => (<svg {...base} strokeWidth={1.7} {...p}><rect x="2.5" y="7" width="13" height="10" rx="1.5" /><path d="M15.5 10h3.5l2.5 3v4h-6" /><circle cx="7" cy="18" r="1.8" /><circle cx="18" cy="18" r="1.8" /></svg>);
export const IconBack = (p: P) => (<svg {...base} strokeWidth={1.7} {...p}><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4" /></svg>);
export const IconShield = (p: P) => (<svg {...base} strokeWidth={1.7} {...p}><path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z" /><path d="m8.5 12 2.5 2.5 4.5-5" /></svg>);
export const IconFlask = (p: P) => (<svg {...base} strokeWidth={1.7} {...p}><path d="M9 3v6L4 19a1.5 1.5 0 0 0 1.3 2h13.4a1.5 1.5 0 0 0 1.3-2L15 9V3M8 3h8M7 15h10" /></svg>);
export const IconChat = (p: P) => (<svg {...base} strokeWidth={1.8} {...p}><path d="M4 5h16v11H9l-5 4V5Z" /></svg>);
export const IconBox = (p: P) => (<svg {...base} strokeWidth={1.7} {...p}><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Z" /><path d="m3 7.5 9 4.5 9-4.5M12 12v9" /></svg>);
export const IconClock = (p: P) => (<svg {...base} strokeWidth={1.7} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>);
export const IconSend = (p: P) => (<svg {...base} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>);
export const IconTick = (p: P) => (<svg {...base} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m5 12 4.5 4.5L19 7" /></svg>);
export const IconBank = (p: P) => (<svg {...base} strokeWidth={1.7} {...p}><path d="M3 9.5 12 4l9 5.5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18" /></svg>);
export const IconFile = (p: P) => (<svg {...base} strokeWidth={1.7} {...p}><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5M10 13h6M10 17h6" /></svg>);

const MAP = { lock: IconLock, truck: IconTruck, back: IconBack, shield: IconShield, flask: IconFlask, chat: IconChat, box: IconBox, clock: IconClock } as const;
export type IconName = keyof typeof MAP;
export const Icon = ({ name, ...p }: P & { name: IconName }) => {
  const C = MAP[name] ?? IconShield;
  return <C {...p} />;
};

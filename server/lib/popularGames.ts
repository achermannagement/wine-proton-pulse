export interface PopularGame {
  appid: number;
  name: string;
  isNative?: boolean;
}

export const POPULAR_GAMES: PopularGame[] = [
  { appid: 1245620, name: 'ELDEN RING' },
  { appid: 730, name: 'Counter-Strike 2', isNative: true },
  { appid: 553850, name: 'HELLDIVERS™ 2' },
  { appid: 271590, name: 'Grand Theft Auto V' },
  { appid: 570, name: 'Dota 2', isNative: true },
  { appid: 252490, name: 'Rust' },
  { appid: 1085660, name: 'Destiny 2' },
  { appid: 381210, name: 'Dead by Daylight' },
  { appid: 230410, name: 'Warframe' },
  { appid: 1091500, name: 'Cyberpunk 2077' },
  { appid: 1086940, name: "Baldur's Gate 3" },
  { appid: 292030, name: 'The Witcher 3: Wild Hunt' },
  { appid: 413150, name: 'Stardew Valley', isNative: true },
  { appid: 367520, name: 'Hollow Knight', isNative: true },
  { appid: 1145360, name: 'Hades', isNative: true },
  { appid: 1623730, name: 'Palworld' },
  { appid: 892970, name: 'Valheim', isNative: true },
  { appid: 105600, name: 'Terraria', isNative: true },
  { appid: 427520, name: 'Factorio', isNative: true },
  { appid: 275850, name: "No Man's Sky", isNative: true },
  { appid: 1716740, name: 'Starfield' },
  { appid: 990080, name: 'Hogwarts Legacy' },
  { appid: 2246340, name: 'Monster Hunter Wilds' },
  { appid: 2183900, name: 'Warhammer 40,000: Space Marine 2' },
  { appid: 39210, name: 'Final Fantasy XIV Online' },
];

export function popularHeaderImage(appid: number): string {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`;
}

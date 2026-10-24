import type { CategoryKey, ProtonTier } from './types';

export const CATEGORY_META: Record<
  CategoryKey,
  { label: string; short: string; tone: string; dot: string }
> = {
  'newly-playable': {
    label: 'Newly playable',
    short: 'Playable',
    tone: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    dot: 'bg-emerald-400',
  },
  feature: {
    label: 'Feature',
    short: 'Feature',
    tone: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
    dot: 'bg-sky-400',
  },
  bugfix: {
    label: 'Bug fix',
    short: 'Fix',
    tone: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    dot: 'bg-amber-400',
  },
  compat: {
    label: 'Game compatibility',
    short: 'Compat',
    tone: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
    dot: 'bg-rose-400',
  },
  performance: {
    label: 'Performance',
    short: 'Perf',
    tone: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
    dot: 'bg-violet-400',
  },
  anticheat: {
    label: 'Anti-cheat',
    short: 'Anti-cheat',
    tone: 'border-red-500/30 bg-red-500/10 text-red-300',
    dot: 'bg-red-400',
  },
  release: {
    label: 'Release',
    short: 'Release',
    tone: 'border-proton-500/30 bg-proton-500/10 text-proton-300',
    dot: 'bg-proton-400',
  },
  discussion: {
    label: 'Community',
    short: 'Community',
    tone: 'border-slate-500/30 bg-slate-500/10 text-slate-300',
    dot: 'bg-slate-400',
  },
  other: {
    label: 'Other',
    short: 'Other',
    tone: 'border-ink-600 bg-ink-800 text-mist-400',
    dot: 'bg-mist-500',
  },
};

export const CATEGORY_ORDER: CategoryKey[] = [
  'newly-playable',
  'feature',
  'bugfix',
  'compat',
  'performance',
  'anticheat',
  'release',
  'discussion',
  'other',
];

export const SOURCE_TONE: Record<string, string> = {
  winehq: 'border-wine-500/30 bg-wine-500/10 text-wine-300',
  proton: 'border-proton-500/30 bg-proton-500/10 text-proton-300',
  'ge-proton': 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  dxvk: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
  'vkd3d-proton': 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300',
  gamingonlinux: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  phoronix: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
  boilingsteam: 'border-teal-500/30 bg-teal-500/10 text-teal-300',
  reddit: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
  steam: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  protondb: 'border-lime-500/30 bg-lime-500/10 text-lime-300',
  awa: 'border-red-500/30 bg-red-500/10 text-red-300',
};

export const SOURCE_DESCRIPTIONS: Record<string, string> = {
  winehq: 'Official Wine development releases, including the full bug-fix list.',
  proton: 'Valve’s stable Proton releases, hotfixes, and newly playable games.',
  'ge-proton': 'GloriousEggroll’s community Proton build with fast game fixes.',
  dxvk: 'D3D9/10/11 to Vulkan translation layer releases and game fixes.',
  'vkd3d-proton': 'Direct3D 12 to Vulkan translation layer features and fixes.',
  gamingonlinux: 'Linux gaming news, filtered for Wine, Proton, Steam Deck, and anti-cheat.',
  phoronix: 'Linux hardware and software news, filtered for Wine/Proton/Valve.',
  boilingsteam: 'Linux gaming news and compatibility coverage.',
  reddit: 'Community discussion from r/linux_gaming about Wine and Proton.',
  steam: 'Steam top sellers and new releases used for the compatibility pulse.',
  protondb: 'Crowd-sourced compatibility tiers and report counts.',
  awa: 'Are We Anti-Cheat Yet status for games with kernel/user-space anti-cheat.',
};

export const TIER_META: Record<
  ProtonTier,
  { label: string; tone: string; bar: string; rank: number }
> = {
  platinum: {
    label: 'Platinum',
    tone: 'border-emerald-400/40 bg-emerald-400/15 text-emerald-200',
    bar: 'bg-emerald-400',
    rank: 6,
  },
  gold: {
    label: 'Gold',
    tone: 'border-amber-400/40 bg-amber-400/15 text-amber-200',
    bar: 'bg-amber-400',
    rank: 5,
  },
  silver: {
    label: 'Silver',
    tone: 'border-slate-300/40 bg-slate-300/15 text-slate-200',
    bar: 'bg-slate-300',
    rank: 4,
  },
  bronze: {
    label: 'Bronze',
    tone: 'border-orange-400/40 bg-orange-400/15 text-orange-200',
    bar: 'bg-orange-400',
    rank: 3,
  },
  borked: {
    label: 'Borked',
    tone: 'border-red-400/40 bg-red-400/15 text-red-200',
    bar: 'bg-red-400',
    rank: 2,
  },
  pending: {
    label: 'Pending',
    tone: 'border-ink-600 bg-ink-800 text-mist-400',
    bar: 'bg-mist-500',
    rank: 1,
  },
  unknown: {
    label: 'Unknown',
    tone: 'border-ink-600 bg-ink-800 text-mist-500',
    bar: 'bg-ink-600',
    rank: 0,
  },
};

export const AWA_TONE: Record<string, string> = {
  Supported: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  Running: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  Denied: 'border-red-500/30 bg-red-500/10 text-red-300',
  Broken: 'border-red-500/30 bg-red-500/10 text-red-300',
  Planned: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  Unknown: 'border-ink-600 bg-ink-800 text-mist-400',
};

export const FEED_TABS = [
  { key: 'all', label: 'All' },
  { key: 'feature', label: 'Features' },
  { key: 'gamefix', label: 'Game fixes' },
  { key: 'bugfix', label: 'Bug fixes' },
  { key: 'compat', label: 'Compatibility' },
  { key: 'release', label: 'Releases' },
  { key: 'discussion', label: 'Community' },
] as const;

export const RANGE_OPTIONS = [
  { key: '24h', label: '24h' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: 'all', label: 'All time' },
] as const;

export const GAME_SORTS = [
  { key: 'recent', label: 'Recently updated' },
  { key: 'tier', label: 'Best tier' },
  { key: 'reports', label: 'Most reports' },
  { key: 'score', label: 'Highest score' },
  { key: 'name', label: 'Name A–Z' },
] as const;

export const RELEASE_SOURCE_IDS = ['winehq', 'proton', 'ge-proton', 'dxvk', 'vkd3d-proton'];

export const RELEASE_GROUP_ORDER: CategoryKey[] = [
  'newly-playable',
  'bugfix',
  'feature',
  'performance',
  'anticheat',
  'compat',
  'other',
];

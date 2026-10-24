import {
  Bug,
  CircleDot,
  Gamepad2,
  Gauge,
  MessagesSquare,
  Package,
  Rocket,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Sparkles,
} from 'lucide-react';
import type { CategoryFlags, CategoryKey, ProtonTier } from '../lib/types';
import { AWA_TONE, CATEGORY_META, CATEGORY_ORDER, SOURCE_TONE, TIER_META } from '../lib/constants';

const CATEGORY_ICONS = {
  'newly-playable': Sparkles,
  feature: Rocket,
  bugfix: Bug,
  compat: Gamepad2,
  performance: Gauge,
  anticheat: ShieldAlert,
  release: Package,
  discussion: MessagesSquare,
  other: CircleDot,
} satisfies Record<CategoryKey, typeof Sparkles>;

export function CategoryBadge({
  category,
  label,
  compact = false,
}: {
  category: CategoryKey;
  label?: string;
  compact?: boolean;
}) {
  const meta = CATEGORY_META[category] ?? CATEGORY_META.other;
  const Icon = CATEGORY_ICONS[category] ?? CircleDot;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium tracking-wide ${meta.tone}`}
      title={meta.label}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {!compact && <span>{label ?? meta.short}</span>}
    </span>
  );
}

export function CategoryBadges({
  categories,
  flags,
  max = 3,
}: {
  categories: CategoryKey[];
  flags?: CategoryFlags;
  max?: number;
}) {
  const set = new Set(categories);
  const ordered = CATEGORY_ORDER.filter((category) => set.has(category));
  const shown: { category: CategoryKey; label?: string }[] = [];
  for (const category of ordered) {
    if (shown.length >= max) break;
    if (category === 'bugfix' && flags?.bugfix && flags?.compat) {
      shown.push({ category: 'bugfix', label: 'Game fix' });
      continue;
    }
    if (category === 'release' && shown.length > 0) continue;
    shown.push({ category });
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {shown.map(({ category, label }) => (
        <CategoryBadge key={category} category={category} label={label} />
      ))}
    </span>
  );
}

export function SourceBadge({ sourceId, name }: { sourceId: string; name: string }) {
  const tone = SOURCE_TONE[sourceId] ?? 'border-ink-600 bg-ink-800 text-mist-300';
  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tone}`}
    >
      {name}
    </span>
  );
}

export function TierBadge({
  tier,
  size = 'sm',
}: {
  tier: ProtonTier | null | undefined;
  size?: 'sm' | 'md' | 'lg';
}) {
  const meta = TIER_META[tier ?? 'unknown'] ?? TIER_META.unknown;
  const sizeClass =
    size === 'lg'
      ? 'px-3 py-1 text-sm'
      : size === 'md'
        ? 'px-2 py-0.5 text-xs'
        : 'px-1.5 py-0.5 text-[10px]';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border font-semibold uppercase tracking-wider ${meta.tone} ${sizeClass}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.bar}`} aria-hidden="true" />
      {meta.label}
    </span>
  );
}

export function AwaBadge({ status }: { status: string | null | undefined }) {
  const label = status ?? 'Not tracked';
  const tone = AWA_TONE[label] ?? AWA_TONE.Unknown;
  const Icon =
    label === 'Supported'
      ? ShieldCheck
      : label === 'Denied' || label === 'Broken'
        ? ShieldAlert
        : ShieldQuestion;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${tone}`}
      title={`Are We Anti-Cheat Yet: ${label}`}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {label}
    </span>
  );
}

export function TrendingBadge({
  current,
  trending,
}: {
  current: ProtonTier | null | undefined;
  trending: ProtonTier | null | undefined;
}) {
  if (!trending || !current || trending === current) return null;
  const meta = TIER_META[trending] ?? TIER_META.unknown;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] ${meta.tone}`}
      title="ProtonDB trending tier"
    >
      Trending {meta.label}
    </span>
  );
}

import type { Client } from '@libsql/client';
import { insertCompatEvent } from '../server/db/repository';
import { dayStartSeconds, nowSeconds } from '../server/lib/time';

export async function applyDemoCompatibilityExtras(db: Client): Promise<void> {
  const now = nowSeconds();
  const scenarios = [
    {
      appid: 553850,
      name: 'HELLDIVERS™ 2',
      from: 'silver',
      to: 'gold',
      scoreFrom: 0.58,
      scoreTo: 0.81,
      reportsFrom: 1200,
      reportsTo: 2100,
      changedAt: now - 2 * 3600,
    },
    {
      appid: 730,
      name: 'Counter-Strike 2',
      from: 'gold',
      to: 'platinum',
      scoreFrom: 0.68,
      scoreTo: 0.72,
      reportsFrom: 1800,
      reportsTo: 2100,
      changedAt: now - 30 * 3600,
    },
  ];

  for (const scenario of scenarios) {
    await db.execute({
      sql: `UPDATE games SET tier = ?, previous_tier = ?, tier_changed_at = ?, fetched_at = ?
            WHERE appid = ?`,
      args: [scenario.to, scenario.from, scenario.changedAt, now, scenario.appid],
    });

    const changeDay = dayStartSeconds(scenario.changedAt);
    for (let offset = 12; offset >= 0; offset--) {
      const day = dayStartSeconds(now) - offset * 86_400;
      const before = day < changeDay;
      const tier = before ? scenario.from : scenario.to;
      const score = before ? scenario.scoreFrom : scenario.scoreTo;
      const reports = before
        ? scenario.reportsFrom
        : scenario.reportsTo + (12 - offset) * 20;
      await db.execute({
        sql: `INSERT INTO game_history (appid, day, tier, trending_tier, score, reports, captured_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(appid, day) DO UPDATE SET
                tier = excluded.tier,
                trending_tier = excluded.trending_tier,
                score = excluded.score,
                reports = excluded.reports,
                captured_at = excluded.captured_at`,
        args: [scenario.appid, day, tier, scenario.to, score, reports, now],
      });
    }

    await insertCompatEvent(db, {
      appid: scenario.appid,
      gameName: scenario.name,
      type: 'tier-change',
      fromValue: scenario.from,
      toValue: scenario.to,
      createdAt: scenario.changedAt,
      url: `https://store.steampowered.com/app/${scenario.appid}/`,
    });
  }

  await insertCompatEvent(db, {
    appid: 381210,
    gameName: 'Dead by Daylight',
    type: 'anti-cheat-change',
    fromValue: 'Running',
    toValue: 'Supported',
    createdAt: now - 5 * 3600,
    url: 'https://areweanticheatyet.com/',
  });
}

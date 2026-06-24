const STAGE_LABEL: Record<string, string> = {
  FINAL: 'Final',
  SEMI_FINALS: 'Semi Finals',
  QUARTER_FINALS: 'Quarter Finals',
  LAST_16: 'Round of 16',
  PLAYOFFS: 'Play-offs',
  LEAGUE_STAGE: 'League Stage',
  REGULAR_SEASON: 'Regular Season',
};

export const STAGE_ORDER: Record<string, number> = {
  FINAL: 0,
  SEMI_FINALS: 1,
  QUARTER_FINALS: 2,
  LAST_16: 3,
  PLAYOFFS: 4,
  LEAGUE_STAGE: 5,
};

export function stageLabel(stage: string): string {
  return STAGE_LABEL[stage] ?? stage.replace(/_/g, ' ');
}

export function seasonLabel(season: string): string {
  const year = parseInt(season, 10);
  if (Number.isNaN(year)) return season;
  return `${year}/${String(year + 1).slice(-2)}`;
}

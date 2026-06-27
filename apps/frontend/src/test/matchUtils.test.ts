import { describe, expect, it } from 'vitest';
import { seasonLabel, stageLabel } from '../utils/matchUtils';

describe('stageLabel', () => {
  it('maps known stage keys to readable labels', () => {
    expect(stageLabel('FINAL')).toBe('Final');
    expect(stageLabel('SEMI_FINALS')).toBe('Semi Finals');
    expect(stageLabel('QUARTER_FINALS')).toBe('Quarter Finals');
    expect(stageLabel('LAST_16')).toBe('Round of 16');
    expect(stageLabel('LAST_32')).toBe('Round of 32');
    expect(stageLabel('LEAGUE_STAGE')).toBe('League Stage');
    expect(stageLabel('REGULAR_SEASON')).toBe('Regular Season');
  });

  it('falls back to replacing underscores for unknown stages', () => {
    expect(stageLabel('ROUND_OF_32')).toBe('ROUND OF 32');
    expect(stageLabel('GROUP_STAGE')).toBe('GROUP STAGE');
    expect(stageLabel('KNOCKOUT')).toBe('KNOCKOUT');
  });
});

describe('seasonLabel', () => {
  it('formats a year string as a two-year season', () => {
    expect(seasonLabel('2024')).toBe('2024/25');
    expect(seasonLabel('2023')).toBe('2023/24');
    expect(seasonLabel('2019')).toBe('2019/20');
    expect(seasonLabel('2099')).toBe('2099/00');
  });

  it('returns non-numeric input unchanged', () => {
    expect(seasonLabel('unknown')).toBe('unknown');
    expect(seasonLabel('')).toBe('');
  });
});

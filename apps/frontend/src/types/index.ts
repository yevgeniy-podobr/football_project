export type MatchStatus =
  | 'SCHEDULED'
  | 'TIMED'
  | 'IN_PLAY'
  | 'PAUSED'
  | 'FINISHED'
  | 'POSTPONED'
  | 'CANCELLED';

export type Outcome = 'HOME_WIN' | 'DRAW' | 'AWAY_WIN';

export interface Team {
  id: number;
  externalId: number;
  name: string;
  shortName?: string | null;
  crest?: string | null;
}

export interface User {
  id: number;
  username?: string | null;
  email: string;
  name?: string | null;
  createdAt: string;
}

export interface Goal {
  minute: number;
  injuryTime?: number | null;
  type: 'REGULAR' | 'OWN_GOAL' | 'PENALTY';
  team: { id: number; name: string };
  scorer: { id: number; name: string };
  assist?: { id: number; name: string } | null;
  homeScore: number;
  awayScore: number;
}

export interface Match {
  id: number;
  externalId: number;
  homeTeamId: number;
  awayTeamId: number;
  homeTeam: Team;
  awayTeam: Team;
  matchDate: string;
  status: MatchStatus;
  stage?: string | null;
  group?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  halfTimeHome?: number | null;
  halfTimeAway?: number | null;
  winner?: string | null;
  goals: Goal[];
  competition: string;
  competitionCode: string;
  season: string;
  predictions: Prediction[];
}

export interface Prediction {
  id: number;
  userId: number;
  matchId: number;
  match?: Match;
  user?: User;
  predictedHome: number;
  predictedAway: number;
  outcome: Outcome | null;
  isExactScore: boolean | null;
  createdAt: string;
  updatedAt: string;
}

export interface PredictionStats {
  id: number;
  userId: number;
  total: number;
  correct: number;
  exactScores: number;
  homeWinCorrect: number;
  drawCorrect: number;
  awayWinCorrect: number;
  accuracy: number;
  updatedAt: string;
}

export interface Standing {
  position: number;
  team: {
    id: number;
    name: string;
    shortName?: string | null;
    crest?: string | null;
  };
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  form?: string | null;
}

export interface GlobalStats {
  users: number;
  total: number;
  correct: number;
  exactScores: number;
  averageAccuracy: number;
}

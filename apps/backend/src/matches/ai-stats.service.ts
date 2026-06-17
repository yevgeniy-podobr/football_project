import { GoogleGenAI } from '@google/genai';
import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface GoalEvent {
  scorer: string;
  minute: number;
}

export interface CardEvent {
  player: string;
  minute: number;
  type: 'yellow' | 'red';
}

export interface AiMatchStats {
  goals: { home: GoalEvent[]; away: GoalEvent[] };
  cards: { home: CardEvent[]; away: CardEvent[] };
  possession: { home: number; away: number };
  shots: {
    home: { onTarget: number; total: number };
    away: { onTarget: number; total: number };
  };
}

@Injectable()
export class AiStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrFetchStats(matchId: number): Promise<AiMatchStats> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: { homeTeam: true, awayTeam: true },
    });
    if (!match) throw new NotFoundException(`Match #${matchId} not found`);

    if (match.aiStats !== null) {
      return match.aiStats as unknown as AiMatchStats;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

    const matchDate = new Date(match.matchDate).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const prompt = `Find the detailed statistics for this football match:

${match.homeTeam.name} (home) vs ${match.awayTeam.name} (away)
Competition: ${match.competition}
Season: ${match.season}
Date: ${matchDate}

Return ONLY a valid JSON object — no markdown, no explanation — with this exact structure:
{
  "goals": {
    "home": [{ "scorer": "Player Name", "minute": 45 }],
    "away": [{ "scorer": "Player Name", "minute": 78 }]
  },
  "cards": {
    "home": [{ "player": "Player Name", "minute": 34, "type": "yellow" }],
    "away": [{ "player": "Player Name", "minute": 67, "type": "red" }]
  },
  "possession": { "home": 55, "away": 45 },
  "shots": {
    "home": { "onTarget": 4, "total": 12 },
    "away": { "onTarget": 2, "total": 8 }
  }
}

Use the Google Search tool to find accurate data. If data for a field is unavailable, use an empty array or 0.`;

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text ?? '';
    const stats = parseJsonFromText(text);

    await this.prisma.match.update({
      where: { id: matchId },
      data: { aiStats: stats as unknown as Prisma.InputJsonValue },
    });

    return stats;
  }
}

function parseJsonFromText(text: string): AiMatchStats {
  // Strip markdown code fences if present
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;

  // Find outermost JSON object
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found in Gemini response');

  return JSON.parse(raw.slice(start, end + 1)) as AiMatchStats;
}

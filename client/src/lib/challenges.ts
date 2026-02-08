import { BudgetConfig } from './budget';

export interface ChallengeLevel {
  id: number;
  name: string;
  subtitle: string;
  stormReturn: number;
  stormIntensity: number;
  terrain: 'flat' | 'slopes' | 'steep' | 'coastal' | 'extreme';
  budget: number;
  maxFloodingAllowed: number;
  description: string;
  steveComment: string;
  emoji: string;
}

export const CHALLENGE_LEVELS: ChallengeLevel[] = [
  {
    id: 1,
    name: "Gentle Rain",
    subtitle: "2-year storm, flat terrain",
    stormReturn: 2,
    stormIntensity: 0.3,
    terrain: 'flat',
    budget: 500000,
    maxFloodingAllowed: 0.5,
    description: "A light drizzle on flat ground. Perfect for learning the basics!",
    steveComment: "Easy peasy! Just connect a few pipes and we're golden.",
    emoji: "🌧",
  },
  {
    id: 2,
    name: "Downpour",
    subtitle: "10-year storm, some slopes",
    stormReturn: 10,
    stormIntensity: 0.6,
    terrain: 'slopes',
    budget: 400000,
    maxFloodingAllowed: 0.3,
    description: "Heavier rain with elevation changes. Watch your pipe sizes!",
    steveComment: "Getting real now! Make sure pipes are big enough.",
    emoji: "🌧🌧",
  },
  {
    id: 3,
    name: "Flash Flood",
    subtitle: "25-year storm, steep terrain",
    stormReturn: 25,
    stormIntensity: 0.8,
    terrain: 'steep',
    budget: 350000,
    maxFloodingAllowed: 0.2,
    description: "Intense rainfall on steep hills. Fast runoff, big flows!",
    steveComment: "Whoa! Water's moving FAST. Storage might help here.",
    emoji: "⛈",
  },
  {
    id: 4,
    name: "Hurricane",
    subtitle: "100-year storm, coastal",
    stormReturn: 100,
    stormIntensity: 1.0,
    terrain: 'coastal',
    budget: 300000,
    maxFloodingAllowed: 0.1,
    description: "A once-in-a-century storm on the coast. This is serious engineering!",
    steveComment: "This is why we build infrastructure! Every pipe counts.",
    emoji: "🌀",
  },
  {
    id: 5,
    name: "Climate Change",
    subtitle: "500-year storm",
    stormReturn: 500,
    stormIntensity: 1.5,
    terrain: 'extreme',
    budget: 250000,
    maxFloodingAllowed: 0.05,
    description: "A storm that shouldn't happen... but climate change says otherwise.",
    steveComment: "We need every trick in the book for this one!",
    emoji: "🔥🌊",
  },
  {
    id: 6,
    name: "The Impossible Basin",
    subtitle: "BOSS LEVEL",
    stormReturn: 1000,
    stormIntensity: 2.0,
    terrain: 'extreme',
    budget: 200000,
    maxFloodingAllowed: -1,
    description: "A watershed that floods no matter what. The goal isn't to prevent flooding - it's to MINIMIZE damage. This teaches real engineering: you can't always win.",
    steveComment: "Sometimes we can't stop the flood. But we can protect what matters most.",
    emoji: "💀",
  },
];

export function getStormPeakIntensity(level: ChallengeLevel): number {
  return level.stormIntensity * 4.0;
}

export function evaluatePerformance(
  level: ChallengeLevel,
  maxFloodDepth: number,
  totalSpent: number
): { passed: boolean; score: number; grade: string; steveReaction: string } {
  const isBossLevel = level.maxFloodingAllowed < 0;

  if (isBossLevel) {
    const score = Math.max(0, 100 - maxFloodDepth * 10);
    const grade = score > 80 ? 'S' : score > 60 ? 'A' : score > 40 ? 'B' : score > 20 ? 'C' : 'D';
    return {
      passed: score > 20,
      score,
      grade,
      steveReaction: score > 60
        ? "Incredible damage reduction! Real engineers would be proud!"
        : "Every bit of protection matters. Try adding storage!"
    };
  }

  const passed = maxFloodDepth <= level.maxFloodingAllowed;
  const efficiencyBonus = Math.max(0, (level.budget - totalSpent) / level.budget * 30);
  const floodPenalty = Math.max(0, (maxFloodDepth - level.maxFloodingAllowed) * 50);
  const score = Math.min(100, Math.max(0, 70 + efficiencyBonus - floodPenalty));
  const grade = score >= 95 ? 'S' : score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 50 ? 'C' : 'F';

  let steveReaction: string;
  if (grade === 'S') steveReaction = "PERFECT! Under budget AND no flooding! You're amazing!";
  else if (grade === 'A') steveReaction = "Great work! The city is safe!";
  else if (grade === 'B') steveReaction = "Good job! A few spots got wet but overall solid.";
  else if (grade === 'C') steveReaction = "We survived, but barely. Try bigger pipes next time.";
  else steveReaction = "The city flooded... Let's try again with a different approach.";

  return { passed, score, grade, steveReaction };
}

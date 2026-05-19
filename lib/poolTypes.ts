export type QuestionPool = {
  id: string;
  name: string;
  description: string | null;
  type: string;
  is_active: boolean;
  created_at: string;
};

export type PoolQuestion = {
  id: string;
  pool_id: string;

  category: string;
  difficulty: 1 | 2 | 3 | 4 | 5;

  question: string;
  solution: string | null;
  accepted_answers: string[];

  host_notes: string | null;

  image_url: string | null;
  audio_url: string | null;

  solution_image_url: string | null;
  solution_audio_url: string | null;

  source: string | null;
  tags: string[];

  last_used_at: string | null;
  usage_count: number;

  is_active: boolean;
  created_at: string;
};

export function pointsFromDifficulty(difficulty: number): number {
  return difficulty * 100;
}
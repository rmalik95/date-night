/** Server-owned state for the two-person date-night room. */
export type Role = "host" | "guest";
export type Stage = "lobby" | "quiz" | "draw" | "memories" | "finale" | "ending";
export type Point = { x: number; y: number };
export type Stroke = { points: Point[]; color: string };
export type AchievementId = "earlyBird" | "quizMaster" | "artisticSoul" | "memoryPalace";
export type SurpriseId = "quiz" | "draw" | "memory";

export type Keepsake = {
  savedAt: string;
  lovePoints: Record<Role, number>;
  achievements: AchievementId[];
  memoryNotes: Record<string, Partial<Record<Role, string>>>;
};

export type RoomState = {
  revision: number;
  stage: Stage;
  hostPresent: boolean;
  guestPresent: boolean;
  firstArrival: Role | null;
  quizIndex: number;
  answers: Record<string, Partial<Record<Role, string>>>;
  matchedQuizAnswers: number;
  drawRound: number;
  drawer: Role;
  strokes: Stroke[];
  guesses: string[];
  completedDrawRounds: number;
  memoryIndex: number;
  memoryNotes: Record<string, Partial<Record<Role, string>>>;
  ready: Record<Role, boolean>;
  finaleUnlocked: boolean;
  lovePoints: Record<Role, number>;
  achievements: AchievementId[];
  surprises: Record<SurpriseId, boolean>;
  keepsakes: Keepsake[];
};

export type RoomAction =
  | { type: "arrive" }
  | { type: "advanceLobby" }
  | { type: "answerQuiz"; answer: string }
  | { type: "advanceQuiz" }
  | { type: "addStroke"; stroke: Stroke }
  | { type: "clearDrawing" }
  | { type: "submitGuess"; guess: string }
  | { type: "advanceDrawing" }
  | { type: "saveMemoryNote"; note: string }
  | { type: "advanceMemory" }
  | { type: "setFinaleReady" }
  | { type: "advanceFinale" }
  | { type: "restart"; mode: "fresh" | "save" };

export type RoomResponse = {
  state: RoomState;
  secret?: { letter: string; dates: { title: string; when: string; where: string; bring: string }[] };
  notice?: string;
};

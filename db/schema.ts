import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const escapeResults = sqliteTable("escape_results", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  className: text("class_name").notNull(),
  studentNumber: text("student_number").notNull(),
  studentName: text("student_name").notNull(),
  runId: text("run_id"),
  elapsedSeconds: integer("elapsed_seconds").notNull(),
  remainingSeconds: integer("remaining_seconds").notNull(),
  attemptsJson: text("attempts_json").notNull().default("{}"),
  score: integer("score").notNull().default(1000),
  timeCost: integer("time_cost").notNull().default(0),
  wrongCount: integer("wrong_count").notNull().default(0),
  wrongCost: integer("wrong_cost").notNull().default(0),
  hintCost: integer("hint_cost").notNull().default(0),
  hintsJson: text("hints_json").notNull().default("{}"),
  bonusScore: integer("bonus_score").notNull().default(0),
  bonusJson: text("bonus_json").notNull().default("{}"),
  finalScore: integer("final_score").notNull().default(1000),
  rank: text("rank").notNull().default("D — 탈출 성공!"),
  reflection: text("reflection").notNull().default(""),
  rating: integer("rating").notNull(),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

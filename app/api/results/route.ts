import { env } from "cloudflare:workers";
import { getDb } from "../../../db";
import { escapeResults } from "../../../db/schema";

type ResultPayload = {
  className?: string;
  number?: string;
  name?: string;
  elapsedSeconds?: number;
  remainingSeconds?: number;
  attempts?: Record<string, number>;
  runId?: string;
  score?: number;
  timeCost?: number;
  wrongCount?: number;
  wrongCost?: number;
  hintCost?: number;
  usedHints?: Record<string, number[]>;
  bonusScore?: number;
  bonusRecords?: Record<string, { attempts?: number; correct?: boolean }>;
  hiddenBonusRecords?: Record<string, { attempts?: number; correct?: boolean }>;
  discoveredHiddenBonuses?: string[];
  finalScore?: number;
  rank?: string;
  reflection?: string;
  startedAt?: string | null;
  completedAt?: string | null;
  messageRestored?: boolean;
};

type ValidatedResult = {
  className: string;
  studentNumber: string;
  studentName: string;
  runId: string | null;
  elapsedSeconds: number;
  remainingSeconds: number;
  attempts: Record<string, number>;
  escapeScore: number;
  timeCost: number;
  wrongCount: number;
  wrongCost: number;
  hintCost: number;
  usedHints: Record<string, number[]>;
  bonusScore: number;
  bonusRecords: Record<string, { attempts?: number; correct?: boolean }>;
  finalScore: number;
  rank: string;
  reflection: string;
  startedAt: string | null;
  completedAt: string | null;
  messageRestored: boolean;
};

type StoredResult = { id: number | string; createdAt: string | null };
type StorageProvider = "d1" | "supabase";

function runtimeValue(key: "SUPABASE_URL" | "SUPABASE_SECRET_KEY" | "RESULTS_STORAGE") {
  const workerEnv = env as unknown as Record<string, unknown>;
  const boundValue = workerEnv[key];
  if (typeof boundValue === "string" && boundValue.trim()) return boundValue.trim();
  const processValue = typeof process !== "undefined" ? process.env[key] : undefined;
  return processValue?.trim() ?? "";
}

async function ensureResultsTable() {
  const d1 = env.DB;
  await d1.batch([
    d1.prepare(`CREATE TABLE IF NOT EXISTS escape_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_name TEXT NOT NULL,
      student_number TEXT NOT NULL,
      student_name TEXT NOT NULL,
      run_id TEXT,
      elapsed_seconds INTEGER NOT NULL,
      remaining_seconds INTEGER NOT NULL,
      attempts_json TEXT NOT NULL DEFAULT '{}',
      score INTEGER NOT NULL DEFAULT 1000,
      time_cost INTEGER NOT NULL DEFAULT 0,
      wrong_count INTEGER NOT NULL DEFAULT 0,
      wrong_cost INTEGER NOT NULL DEFAULT 0,
      hint_cost INTEGER NOT NULL DEFAULT 0,
      hints_json TEXT NOT NULL DEFAULT '{}',
      bonus_score INTEGER NOT NULL DEFAULT 0,
      bonus_json TEXT NOT NULL DEFAULT '{}',
      final_score INTEGER NOT NULL DEFAULT 1000,
      rank TEXT NOT NULL DEFAULT 'D — 탈출 성공!',
      reflection TEXT NOT NULL DEFAULT '',
      rating INTEGER NOT NULL,
      started_at TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    d1.prepare("CREATE INDEX IF NOT EXISTS escape_results_class_idx ON escape_results (class_name, student_number)"),
  ]);

  const columnInfo = await d1.prepare("PRAGMA table_info(escape_results)").all();
  const columnNames = new Set(
    (columnInfo.results as Array<{ name: string }>).map((column) => column.name),
  );
  const additions = [
    ["run_id", "ALTER TABLE escape_results ADD COLUMN run_id TEXT"],
    ["score", "ALTER TABLE escape_results ADD COLUMN score INTEGER NOT NULL DEFAULT 1000"],
    ["time_cost", "ALTER TABLE escape_results ADD COLUMN time_cost INTEGER NOT NULL DEFAULT 0"],
    ["wrong_count", "ALTER TABLE escape_results ADD COLUMN wrong_count INTEGER NOT NULL DEFAULT 0"],
    ["wrong_cost", "ALTER TABLE escape_results ADD COLUMN wrong_cost INTEGER NOT NULL DEFAULT 0"],
    ["hint_cost", "ALTER TABLE escape_results ADD COLUMN hint_cost INTEGER NOT NULL DEFAULT 0"],
    ["hints_json", "ALTER TABLE escape_results ADD COLUMN hints_json TEXT NOT NULL DEFAULT '{}'"],
    ["bonus_score", "ALTER TABLE escape_results ADD COLUMN bonus_score INTEGER NOT NULL DEFAULT 0"],
    ["bonus_json", "ALTER TABLE escape_results ADD COLUMN bonus_json TEXT NOT NULL DEFAULT '{}'"],
    ["final_score", "ALTER TABLE escape_results ADD COLUMN final_score INTEGER NOT NULL DEFAULT 1000"],
    ["rank", "ALTER TABLE escape_results ADD COLUMN rank TEXT NOT NULL DEFAULT 'D — 탈출 성공!'"],
    ["completed_at", "ALTER TABLE escape_results ADD COLUMN completed_at TEXT"],
  ].filter(([name]) => !columnNames.has(name));
  if (additions.length > 0) {
    await d1.batch(additions.map(([, statement]) => d1.prepare(statement)));
  }
  await d1.prepare("PRAGMA optimize").run();
}

async function saveToD1(result: ValidatedResult): Promise<StoredResult> {
  await ensureResultsTable();
  const db = getDb();
  const [saved] = await db
    .insert(escapeResults)
    .values({
      className: result.className,
      studentNumber: result.studentNumber,
      studentName: result.studentName,
      runId: result.runId,
      elapsedSeconds: result.elapsedSeconds,
      remainingSeconds: result.remainingSeconds,
      attemptsJson: JSON.stringify(result.attempts),
      score: result.escapeScore,
      timeCost: result.timeCost,
      wrongCount: result.wrongCount,
      wrongCost: result.wrongCost,
      hintCost: result.hintCost,
      hintsJson: JSON.stringify(result.usedHints),
      bonusScore: result.bonusScore,
      bonusJson: JSON.stringify(result.bonusRecords),
      finalScore: result.finalScore,
      rank: result.rank,
      reflection: result.reflection,
      rating: 0,
      startedAt: result.startedAt,
      completedAt: result.completedAt,
    })
    .returning({ id: escapeResults.id, createdAt: escapeResults.createdAt });

  return saved;
}

async function saveToSupabase(result: ValidatedResult): Promise<StoredResult> {
  const supabaseUrl = runtimeValue("SUPABASE_URL").replace(/\/+$/, "");
  const secretKey = runtimeValue("SUPABASE_SECRET_KEY");
  if (!supabaseUrl || !secretKey) {
    throw new Error("Supabase 프로젝트 주소와 서버 비밀키가 설정되지 않았습니다.");
  }

  const response = await fetch(
    `${supabaseUrl}/rest/v1/escape_results?on_conflict=run_id&select=id,created_at`,
    {
      method: "POST",
      headers: {
        apikey: secretKey,
        "content-type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify({
        class_name: result.className,
        student_number: result.studentNumber,
        student_name: result.studentName,
        run_id: result.runId,
        elapsed_seconds: result.elapsedSeconds,
        remaining_seconds: result.remainingSeconds,
        attempts_json: result.attempts,
        score: result.escapeScore,
        time_cost: result.timeCost,
        wrong_count: result.wrongCount,
        wrong_cost: result.wrongCost,
        hint_cost: result.hintCost,
        hints_json: result.usedHints,
        bonus_score: result.bonusScore,
        bonus_json: result.bonusRecords,
        final_score: result.finalScore,
        rank: result.rank,
        reflection: result.reflection,
        rating: 0,
        started_at: result.startedAt,
        completed_at: result.completedAt,
        message_restored: result.messageRestored,
      }),
    },
  );

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`Supabase 저장 실패 (${response.status}): ${detail}`);
  }

  const rows = await response.json() as Array<{ id: number | string; created_at?: string | null }>;
  return { id: rows[0]?.id ?? result.runId ?? "saved", createdAt: rows[0]?.created_at ?? null };
}

function selectProviders(): StorageProvider[] {
  const mode = runtimeValue("RESULTS_STORAGE").toLowerCase() || "auto";
  const supabaseConfigured = Boolean(runtimeValue("SUPABASE_URL") && runtimeValue("SUPABASE_SECRET_KEY"));

  if (mode === "dual") return ["supabase", "d1"];
  if (mode === "supabase") return ["supabase"];
  if (mode === "d1") return ["d1"];
  return supabaseConfigured ? ["supabase"] : ["d1"];
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as ResultPayload;
    const className = payload.className?.trim() ?? "";
    const studentNumber = payload.number?.trim() ?? "";
    const studentName = payload.name?.trim() ?? "";
    const reflection = payload.reflection?.trim() ?? "";
    const elapsedSeconds = Math.max(0, Math.floor(payload.elapsedSeconds ?? 0));
    const wrongCount = Math.max(0, Math.floor(payload.wrongCount ?? 0));
    const timeCost = Math.floor(elapsedSeconds / 6);
    const wrongCost = wrongCount * 30;
    const hintCost = Object.values(payload.usedHints ?? {}).reduce(
      (total, levels) => total + levels.reduce((sum, level) => sum + ({ 1: 50, 2: 100, 3: 200 }[level] ?? 0), 0),
      0,
    );
    const bonusIds = ["chord", "tangent", "right-angle", "mean", "similarity", "trig-ratio"];
    const bonusCorrectCount = bonusIds.filter((id) => payload.bonusRecords?.[id]?.correct === true).length;
    const bonusScore = bonusCorrectCount * 30 + (bonusCorrectCount === bonusIds.length ? 20 : 0);
    const storedBonusRecords: Record<string, { attempts?: number; correct?: boolean }> = {
      ...(payload.bonusRecords ?? {}),
    };
    Object.entries(payload.hiddenBonusRecords ?? {}).forEach(([id, record]) => {
      storedBonusRecords[`hidden:${id}`] = record;
    });
    (payload.discoveredHiddenBonuses ?? []).forEach((id) => {
      storedBonusRecords[`hidden-discovered:${id}`] = { attempts: 1, correct: true };
    });
    const escapeScore = Math.max(0, 1000 - timeCost - wrongCost - hintCost);
    const finalScore = escapeScore + bonusScore;
    const rank = finalScore >= 1050 ? "S — 전설의 탈출가"
      : finalScore >= 900 ? "A — 뛰어난 탐정"
        : finalScore >= 750 ? "B — 숙련된 해결사"
          : finalScore >= 600 ? "C — 끈기 있는 도전자"
            : "D — 탈출 성공!";

    if (!className || !studentNumber || !studentName || !reflection) {
      return Response.json({ error: "학생 정보와 활동 소감이 필요합니다." }, { status: 400 });
    }

    const validated: ValidatedResult = {
      className,
      studentNumber,
      studentName,
      runId: payload.runId?.trim() || null,
      elapsedSeconds,
      remainingSeconds: Math.max(0, Math.floor(payload.remainingSeconds ?? 0)),
      attempts: payload.attempts ?? {},
      escapeScore,
      timeCost,
      wrongCount,
      wrongCost,
      hintCost,
      usedHints: payload.usedHints ?? {},
      bonusScore,
      bonusRecords: storedBonusRecords,
      finalScore,
      rank,
      reflection,
      startedAt: payload.startedAt ?? null,
      completedAt: payload.completedAt ?? null,
      messageRestored: payload.messageRestored === true,
    };

    const providers = selectProviders();
    const outcomes = await Promise.allSettled(
      providers.map(async (provider) => ({
        provider,
        result: provider === "supabase" ? await saveToSupabase(validated) : await saveToD1(validated),
      })),
    );
    const saved = outcomes
      .filter((outcome): outcome is PromiseFulfilledResult<{ provider: StorageProvider; result: StoredResult }> => outcome.status === "fulfilled")
      .map((outcome) => outcome.value);

    if (saved.length === 0) {
      const firstFailure = outcomes.find((outcome): outcome is PromiseRejectedResult => outcome.status === "rejected");
      throw firstFailure?.reason ?? new Error("결과를 저장하지 못했습니다.");
    }

    return Response.json({ result: saved[0].result, storedIn: saved.map((item) => item.provider) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "결과 저장 중 오류가 발생했습니다.";
    return Response.json({ error: message }, { status: 500 });
  }
}

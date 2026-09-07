import { env } from "cloudflare:workers";

const ACTIVE_RANK = "__ACTIVE__";

type ActivityPayload = {
  className?: string;
  number?: string;
  name?: string;
  runId?: string;
  startedAt?: string | null;
  elapsedSeconds?: number;
  remainingSeconds?: number;
};

function runtimeValue(key: "SUPABASE_URL" | "SUPABASE_SECRET_KEY") {
  const workerEnv = env as unknown as Record<string, unknown>;
  const boundValue = workerEnv[key];
  if (typeof boundValue === "string" && boundValue.trim()) return boundValue.trim();
  const processValue = typeof process !== "undefined" ? process.env[key] : undefined;
  return processValue?.trim() ?? "";
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as ActivityPayload;
    const className = payload.className?.trim() ?? "";
    const studentNumber = payload.number?.trim() ?? "";
    const studentName = payload.name?.trim() ?? "";
    const runId = payload.runId?.trim() ?? "";

    if (!className || !studentNumber || !studentName || !runId) {
      return Response.json({ error: "활동 상태를 기록할 학생 정보가 부족합니다." }, { status: 400 });
    }

    const supabaseUrl = runtimeValue("SUPABASE_URL").replace(/\/+$/, "");
    const secretKey = runtimeValue("SUPABASE_SECRET_KEY");
    if (!supabaseUrl || !secretKey) {
      return Response.json({ error: "학생 활동 저장소가 아직 연결되지 않았습니다." }, { status: 503 });
    }

    const checkResponse = await fetch(
      `${supabaseUrl}/rest/v1/escape_results?select=rank&run_id=eq.${encodeURIComponent(runId)}&limit=1`,
      {
        headers: {
          apikey: secretKey,
          Authorization: `Bearer ${secretKey}`,
        },
      },
    );

    if (checkResponse.ok) {
      const existing = await checkResponse.json() as Array<{ rank?: string | null }>;
      if (existing[0]?.rank && existing[0].rank !== ACTIVE_RANK) {
        return Response.json({ status: "completed" });
      }
    }

    const now = new Date().toISOString();
    const elapsedSeconds = Math.max(0, Math.floor(payload.elapsedSeconds ?? 0));
    const remainingSeconds = Math.max(0, Math.floor(payload.remainingSeconds ?? 0));

    const response = await fetch(
      `${supabaseUrl}/rest/v1/escape_results?on_conflict=run_id`,
      {
        method: "POST",
        headers: {
          apikey: secretKey,
          Authorization: `Bearer ${secretKey}`,
          "content-type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify({
          class_name: className,
          student_number: studentNumber,
          student_name: studentName,
          run_id: runId,
          elapsed_seconds: elapsedSeconds,
          remaining_seconds: remainingSeconds,
          attempts_json: {},
          score: 1000,
          time_cost: Math.floor(elapsedSeconds / 6),
          wrong_count: 0,
          wrong_cost: 0,
          hint_cost: 0,
          hints_json: {},
          bonus_score: 0,
          bonus_json: {},
          final_score: 0,
          rank: ACTIVE_RANK,
          reflection: "",
          rating: 0,
          started_at: payload.startedAt ?? now,
          completed_at: now,
          message_restored: false,
        }),
      },
    );

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 240);
      throw new Error(`활동 상태 저장 실패 (${response.status}): ${detail}`);
    }

    return Response.json({ status: "active", lastSeenAt: now });
  } catch (error) {
    const message = error instanceof Error ? error.message : "활동 상태 기록 중 오류가 발생했습니다.";
    return Response.json({ error: message }, { status: 500 });
  }
}

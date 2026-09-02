import { env } from "cloudflare:workers";

type TeacherRuntimeKey =
  | "SUPABASE_URL"
  | "SUPABASE_SECRET_KEY"
  | "TEACHER_PIN";

export function teacherRuntimeValue(key: TeacherRuntimeKey) {
  const workerEnv = env as unknown as Record<string, unknown>;
  const boundValue = workerEnv[key];
  if (typeof boundValue === "string" && boundValue.trim()) return boundValue.trim();
  const processValue = typeof process !== "undefined" ? process.env[key] : undefined;
  return processValue?.trim() ?? "";
}

function constantTimeEqual(left: string, right: string) {
  const maxLength = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < maxLength; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

export function authorizeTeacher(request: Request) {
  const expectedPin = teacherRuntimeValue("TEACHER_PIN");
  if (!expectedPin) {
    return Response.json(
      { error: "교사용 비밀번호가 아직 설정되지 않았습니다." },
      { status: 503 },
    );
  }

  const suppliedPin = request.headers.get("x-teacher-pin")?.trim() ?? "";
  if (!suppliedPin || !constantTimeEqual(suppliedPin, expectedPin)) {
    return Response.json({ error: "교사용 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }
  return null;
}

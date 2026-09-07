import { authorizeTeacher, teacherRuntimeValue } from "../server";

const ACTIVE_RANK = "__ACTIVE__";
const STALE_AFTER_MS = 3 * 60 * 1000;

type ActivityRow = {
  class_name: string;
  student_number: string;
  student_name: string;
  rank: string | null;
  completed_at: string | null;
  created_at: string;
};

type StudentState = {
  className: string;
  studentNumber: string;
  studentName: string;
  hasCompleted: boolean;
  lastSeenAt: string | null;
};

export async function GET(request: Request) {
  const unauthorized = authorizeTeacher(request);
  if (unauthorized) return unauthorized;

  const supabaseUrl = teacherRuntimeValue("SUPABASE_URL").replace(/\/+$/, "");
  const secretKey = teacherRuntimeValue("SUPABASE_SECRET_KEY");
  if (!supabaseUrl || !secretKey) {
    return Response.json(
      { error: "학생 결과 저장소가 아직 연결되지 않았습니다." },
      { status: 503 },
    );
  }

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/escape_results?select=class_name,student_number,student_name,rank,completed_at,created_at&order=created_at.asc&limit=2000`,
      {
        headers: {
          apikey: secretKey,
          Authorization: `Bearer ${secretKey}`,
        },
      },
    );

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 240);
      throw new Error(`Supabase 조회 실패 (${response.status}): ${detail}`);
    }

    const rows = await response.json() as ActivityRow[];
    const byStudent = new Map<string, StudentState>();

    rows.forEach((row) => {
      const key = `${row.class_name}::${row.student_number}::${row.student_name.trim()}`;
      const current = byStudent.get(key) ?? {
        className: row.class_name,
        studentNumber: row.student_number,
        studentName: row.student_name,
        hasCompleted: false,
        lastSeenAt: null,
      };

      if (row.rank && row.rank !== ACTIVE_RANK) {
        current.hasCompleted = true;
      } else if (row.rank === ACTIVE_RANK) {
        const candidate = row.completed_at ?? row.created_at;
        if (!current.lastSeenAt || new Date(candidate).getTime() > new Date(current.lastSeenAt).getTime()) {
          current.lastSeenAt = candidate;
        }
      }

      byStudent.set(key, current);
    });

    const now = Date.now();
    const students = [...byStudent.values()].map((student) => {
      let status: "completed" | "active" | "dropped";
      if (student.hasCompleted) {
        status = "completed";
      } else if (student.lastSeenAt && now - new Date(student.lastSeenAt).getTime() <= STALE_AFTER_MS) {
        status = "active";
      } else {
        status = "dropped";
      }

      return {
        className: student.className,
        studentNumber: student.studentNumber,
        studentName: student.studentName,
        status,
        lastSeenAt: student.lastSeenAt,
      };
    });

    return Response.json(
      {
        students,
        staleAfterSeconds: STALE_AFTER_MS / 1000,
        updatedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "활동 상태를 불러오지 못했습니다.";
    return Response.json({ error: message }, { status: 500 });
  }
}

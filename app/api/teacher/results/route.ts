import { authorizeTeacher, teacherRuntimeValue } from "../server";

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
      `${supabaseUrl}/rest/v1/escape_results?select=*&order=created_at.desc&limit=1000`,
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

    return Response.json(
      { results: await response.json(), updatedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "결과를 불러오지 못했습니다.";
    return Response.json({ error: message }, { status: 500 });
  }
}

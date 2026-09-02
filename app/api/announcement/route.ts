import { authorizeTeacher } from "../teacher/server";

type Announcement = {
  id: string;
  message: string;
  createdAt: string;
  expiresAt: string;
};

const CACHE_NAME = "math-escape-room-announcements";
const CACHE_KEY = "https://math-escape-room.internal/current-announcement";
let memoryAnnouncement: Announcement | null = null;

async function readAnnouncement() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(CACHE_KEY);
    if (response) return await response.json() as Announcement;
  } catch {
    // Local builds may not provide the Workers Cache API.
  }
  return memoryAnnouncement;
}

async function writeAnnouncement(announcement: Announcement, ttlSeconds: number) {
  memoryAnnouncement = announcement;
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(
      CACHE_KEY,
      new Response(JSON.stringify(announcement), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "Cache-Control": `max-age=${ttlSeconds}`,
        },
      }),
    );
  } catch {
    // The in-memory fallback keeps local preview behavior functional.
  }
}

async function clearAnnouncement() {
  memoryAnnouncement = null;
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.delete(CACHE_KEY);
  } catch {
    // No-op in runtimes without the Workers Cache API.
  }
}

export async function GET() {
  const announcement = await readAnnouncement();
  const active = announcement && new Date(announcement.expiresAt).getTime() > Date.now()
    ? announcement
    : null;
  if (announcement && !active) await clearAnnouncement();
  return Response.json(
    { announcement: active },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const unauthorized = authorizeTeacher(request);
  if (unauthorized) return unauthorized;

  const payload = await request.json() as { message?: string; durationMinutes?: number };
  const message = payload.message?.trim().slice(0, 80) ?? "";
  const durationMinutes = Math.min(60, Math.max(1, Math.floor(payload.durationMinutes ?? 10)));
  if (!message) {
    return Response.json({ error: "공지 문구를 입력해 주세요." }, { status: 400 });
  }

  const createdAt = new Date();
  const announcement: Announcement = {
    id: crypto.randomUUID(),
    message,
    createdAt: createdAt.toISOString(),
    expiresAt: new Date(createdAt.getTime() + durationMinutes * 60_000).toISOString(),
  };
  await writeAnnouncement(announcement, durationMinutes * 60);
  return Response.json({ announcement }, { status: 201 });
}

export async function DELETE(request: Request) {
  const unauthorized = authorizeTeacher(request);
  if (unauthorized) return unauthorized;
  await clearAnnouncement();
  return Response.json({ announcement: null });
}

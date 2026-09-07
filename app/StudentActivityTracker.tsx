"use client";

import { useEffect } from "react";

const PROGRESS_KEY = "math-lab-hints-v1";
const TOTAL_TIME = 40 * 60;

type StoredProgress = {
  screen?: "intro" | "playing" | "escaped";
  student?: { className?: string; number?: string; name?: string };
  runId?: string;
  startedAt?: number | null;
};

function readProgress(): StoredProgress | null {
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredProgress;
  } catch {
    return null;
  }
}

export default function StudentActivityTracker() {
  useEffect(() => {
    let stopped = false;

    async function sendHeartbeat() {
      if (stopped || window.location.pathname.startsWith("/teacher")) return;
      const progress = readProgress();
      if (!progress || progress.screen === "intro") return;

      const className = progress.student?.className?.trim() ?? "";
      const number = progress.student?.number?.trim() ?? "";
      const name = progress.student?.name?.trim() ?? "";
      const runId = progress.runId?.trim() ?? "";
      if (!className || !number || !name || !runId) return;

      const elapsedSeconds = progress.startedAt
        ? Math.max(0, Math.floor((Date.now() - progress.startedAt) / 1000))
        : 0;

      try {
        await fetch("/api/activity", {
          method: "POST",
          headers: { "content-type": "application/json" },
          cache: "no-store",
          keepalive: true,
          body: JSON.stringify({
            className,
            number,
            name,
            runId,
            startedAt: progress.startedAt ? new Date(progress.startedAt).toISOString() : null,
            elapsedSeconds,
            remainingSeconds: Math.max(0, TOTAL_TIME - elapsedSeconds),
          }),
        });
      } catch {
        // 활동 상태 기록 실패가 학생 게임 진행을 방해하지 않게 합니다.
      }
    }

    void sendHeartbeat();
    const timer = window.setInterval(() => void sendHeartbeat(), 30_000);
    const onFocus = () => void sendHeartbeat();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void sendHeartbeat();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stopped = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return null;
}

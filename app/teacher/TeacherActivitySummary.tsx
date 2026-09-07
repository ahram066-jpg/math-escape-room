"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./TeacherActivitySummary.module.css";

type ActivityStudent = {
  className: string;
  studentNumber: string;
  studentName: string;
  status: "completed" | "active" | "dropped";
  lastSeenAt: string | null;
};

export default function TeacherActivitySummary() {
  const [pin, setPin] = useState("");
  const [students, setStudents] = useState<ActivityStudent[]>([]);
  const [selectedClass, setSelectedClass] = useState("전체");
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadActivity = useCallback(async (teacherPin: string) => {
    if (!teacherPin) return;
    try {
      const response = await fetch("/api/teacher/activity", {
        headers: { "x-teacher-pin": teacherPin },
        cache: "no-store",
      });
      const payload = await response.json() as {
        students?: ActivityStudent[];
        updatedAt?: string;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || "활동 현황을 불러오지 못했습니다.");
      setStudents(payload.students ?? []);
      setUpdatedAt(payload.updatedAt ?? new Date().toISOString());
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "활동 현황을 불러오지 못했습니다.");
    }
  }, []);

  useEffect(() => {
    const syncPin = () => {
      const savedPin = window.sessionStorage.getItem("math-escape-teacher-pin") ?? "";
      if (savedPin !== pin) {
        setPin(savedPin);
        if (savedPin) void loadActivity(savedPin);
        else setStudents([]);
      }
    };

    syncPin();
    const timer = window.setInterval(syncPin, 700);
    return () => window.clearInterval(timer);
  }, [loadActivity, pin]);

  useEffect(() => {
    if (!pin) {
      setTarget(null);
      return;
    }

    let host: HTMLDivElement | null = null;
    const attach = () => {
      if (host) return true;
      const workspace = document.querySelector<HTMLElement>(".teacher-workspace");
      const header = workspace?.querySelector<HTMLElement>(".teacher-header");
      if (!workspace || !header) return false;

      host = document.createElement("div");
      host.dataset.teacherActivitySummary = "true";
      header.insertAdjacentElement("afterend", host);
      setTarget(host);
      return true;
    };

    if (!attach()) {
      const timer = window.setInterval(() => {
        if (attach()) window.clearInterval(timer);
      }, 250);
      return () => {
        window.clearInterval(timer);
        setTarget(null);
        host?.remove();
      };
    }

    return () => {
      setTarget(null);
      host?.remove();
    };
  }, [pin]);

  useEffect(() => {
    if (!pin) return;
    const timer = window.setInterval(() => void loadActivity(pin), 10_000);
    return () => window.clearInterval(timer);
  }, [loadActivity, pin]);

  const classes = useMemo(() => {
    const values = new Set(students.map((student) => student.className).filter(Boolean));
    return [...values].sort((left, right) => left.localeCompare(right, "ko", { numeric: true }));
  }, [students]);

  const filtered = useMemo(
    () => selectedClass === "전체" ? students : students.filter((student) => student.className === selectedClass),
    [selectedClass, students],
  );

  const counts = useMemo(() => ({
    completed: filtered.filter((student) => student.status === "completed").length,
    active: filtered.filter((student) => student.status === "active").length,
    dropped: filtered.filter((student) => student.status === "dropped").length,
  }), [filtered]);

  if (!target || !pin) return null;

  return createPortal(
    <section className={styles.section} aria-label="실시간 학생 참여 현황">
      <div className={styles.heading}>
        <div>
          <span>LIVE PARTICIPATION</span>
          <h2>실시간 참여 현황</h2>
          <p>최근 12시간 참여 기록을 학생별 1명 기준으로 구분합니다. 3분 이상 활동 신호가 없고 제출 기록도 없으면 중단·튕김으로 추정합니다.</p>
        </div>
        <div className={styles.actions}>
          <label>
            <span>학급</span>
            <select value={selectedClass} onChange={(event) => setSelectedClass(event.target.value)}>
              <option value="전체">전체 반</option>
              {classes.map((className) => <option value={className} key={className}>{className}반</option>)}
            </select>
          </label>
          <button type="button" onClick={() => void loadActivity(pin)}>새로고침</button>
        </div>
      </div>

      <div className={styles.grid}>
        <article className={styles.completed}>
          <span>제출 완료</span>
          <strong>{counts.completed}<small>명</small></strong>
          <p>선생님께 결과 제출까지 완료</p>
        </article>
        <article className={styles.active}>
          <span>활동 중</span>
          <strong>{counts.active}<small>명</small></strong>
          <p>최근 3분 안에 활동 신호 확인</p>
        </article>
        <article className={styles.dropped}>
          <span>중단·튕김 추정</span>
          <strong>{counts.dropped}<small>명</small></strong>
          <p>미제출 + 3분 이상 활동 신호 없음</p>
        </article>
      </div>

      <div className={styles.footer}>
        <span>총 참여 확인 {filtered.length}명</span>
        {updatedAt && <span>최근 갱신 {new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(updatedAt))}</span>}
      </div>
      {error && <div className={styles.error} role="alert">{error}</div>}
    </section>,
    target,
  );
}

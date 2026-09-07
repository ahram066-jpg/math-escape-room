"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./TeacherLeaderboard.module.css";

type BonusRecord = { attempts?: number; correct?: boolean };
type BonusMap = Record<string, BonusRecord>;

type ResultRow = {
  id: number | string;
  class_name: string;
  student_number: string;
  student_name: string;
  elapsed_seconds: number;
  final_score: number;
  bonus_json: BonusMap | string | null;
  completed_at: string | null;
  created_at: string;
};

const BONUS_IDS = ["chord", "tangent", "right-angle", "mean", "similarity", "trig-ratio"] as const;
const HIDDEN_BONUS_IDS = ["axis", "parabola", "x-value", "fair-line", "x-date", "interest", "exam", "favorites"] as const;
const OPTIONAL_TOTAL = BONUS_IDS.length + HIDDEN_BONUS_IDS.length;
const HONOR_POINTS_PER_OPTIONAL = 100;

function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds || 0));
  return `${Math.floor(seconds / 60)}분 ${String(seconds % 60).padStart(2, "0")}초`;
}

function asBonusMap(value: BonusMap | string | null | undefined): BonusMap {
  if (value && typeof value === "object") return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object") return parsed as BonusMap;
    } catch {
      // Ignore malformed legacy records.
    }
  }
  return {};
}

function optionalCorrectCount(row: ResultRow) {
  const bonuses = asBonusMap(row.bonus_json);
  const vaultCorrect = BONUS_IDS.filter((id) => bonuses[id]?.correct === true).length;
  const hiddenCorrect = HIDDEN_BONUS_IDS.filter((id) => bonuses[`hidden:${id}`]?.correct === true).length;
  return vaultCorrect + hiddenCorrect;
}

function honorScore(row: ResultRow) {
  return row.final_score + optionalCorrectCount(row) * HONOR_POINTS_PER_OPTIONAL;
}

function isBetterRecord(next: ResultRow, current: ResultRow) {
  const nextSolved = optionalCorrectCount(next);
  const currentSolved = optionalCorrectCount(current);
  if (nextSolved !== currentSolved) return nextSolved > currentSolved;

  const nextHonorScore = honorScore(next);
  const currentHonorScore = honorScore(current);
  if (nextHonorScore !== currentHonorScore) return nextHonorScore > currentHonorScore;

  if (next.elapsed_seconds !== current.elapsed_seconds) return next.elapsed_seconds < current.elapsed_seconds;
  return new Date(next.completed_at ?? next.created_at).getTime() > new Date(current.completed_at ?? current.created_at).getTime();
}

export default function TeacherLeaderboard() {
  const [pin, setPin] = useState("");
  const [results, setResults] = useState<ResultRow[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState("");
  const [topN, setTopN] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadResults = useCallback(async (teacherPin: string, silent = false) => {
    if (!teacherPin) return;
    if (!silent) setLoading(true);
    try {
      const response = await fetch("/api/teacher/results", {
        headers: { "x-teacher-pin": teacherPin },
        cache: "no-store",
      });
      const payload = await response.json() as { results?: ResultRow[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "순위 기록을 불러오지 못했습니다.");
      setResults(payload.results ?? []);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "순위 기록을 불러오지 못했습니다.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const findPin = () => {
      const savedPin = window.sessionStorage.getItem("math-escape-teacher-pin") ?? "";
      if (savedPin && savedPin !== pin) {
        setPin(savedPin);
        void loadResults(savedPin);
      }
      if (!savedPin && pin) {
        setPin("");
        setOpen(false);
        setResults([]);
      }
    };

    findPin();
    const pinTimer = window.setInterval(findPin, 700);
    return () => window.clearInterval(pinTimer);
  }, [loadResults, pin]);

  useEffect(() => {
    if (!pin) return;
    const timer = window.setInterval(() => void loadResults(pin, true), 10_000);
    return () => window.clearInterval(timer);
  }, [loadResults, pin]);

  const classes = useMemo(() => {
    const values = new Set(results.map((row) => row.class_name).filter(Boolean));
    return [...values].sort((left, right) => left.localeCompare(right, "ko", { numeric: true }));
  }, [results]);

  useEffect(() => {
    if (!selectedClass && classes.length) setSelectedClass(classes[0]);
    if (selectedClass && classes.length && !classes.includes(selectedClass)) setSelectedClass(classes[0]);
  }, [classes, selectedClass]);

  const ranking = useMemo(() => {
    if (!selectedClass) return [];
    const bestByStudent = new Map<string, ResultRow>();

    results
      .filter((row) => row.class_name === selectedClass)
      .forEach((row) => {
        const key = `${row.class_name}::${row.student_number}::${row.student_name.trim()}`;
        const current = bestByStudent.get(key);
        if (!current || isBetterRecord(row, current)) bestByStudent.set(key, row);
      });

    return [...bestByStudent.values()]
      .sort((left, right) => {
        const solvedDifference = optionalCorrectCount(right) - optionalCorrectCount(left);
        if (solvedDifference) return solvedDifference;

        const scoreDifference = honorScore(right) - honorScore(left);
        if (scoreDifference) return scoreDifference;

        if (left.elapsed_seconds !== right.elapsed_seconds) return left.elapsed_seconds - right.elapsed_seconds;
        return left.student_number.localeCompare(right.student_number, "ko", { numeric: true });
      })
      .slice(0, topN);
  }, [results, selectedClass, topN]);

  if (!pin) return null;

  return (
    <div className={styles.root}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => {
          setOpen(true);
          void loadResults(pin);
        }}
      >
        <span>★</span>
        학급 명예의 전당
      </button>

      {open && (
        <div className={styles.backdrop} role="presentation" onMouseDown={() => setOpen(false)}>
          <section className={styles.panel} role="dialog" aria-modal="true" aria-labelledby="teacher-leaderboard-title" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className={styles.close} onClick={() => setOpen(false)} aria-label="명예의 전당 닫기">×</button>

            <div className={styles.heading}>
              <span>CLASS HALL OF FAME</span>
              <h2 id="teacher-leaderboard-title">학급 명예의 전당</h2>
              <p>많이 해결한 학생을 가장 먼저 평가합니다. 해결 수가 같으면 명예 점수, 그마저 같으면 탈출 시간이 빠른 학생이 먼저 표시됩니다.</p>
            </div>

            <div className={styles.controls}>
              <label>
                <span>학급</span>
                <select value={selectedClass} onChange={(event) => setSelectedClass(event.target.value)} disabled={!classes.length}>
                  {classes.map((className) => <option key={className} value={className}>{className}반</option>)}
                </select>
              </label>
              <label>
                <span>몇 위까지</span>
                <select value={topN} onChange={(event) => setTopN(Number(event.target.value))}>
                  {Array.from({ length: 10 }, (_, index) => index + 1).map((rank) => <option key={rank} value={rank}>상위 {rank}위</option>)}
                </select>
              </label>
              <button type="button" onClick={() => void loadResults(pin)} disabled={loading}>{loading ? "갱신 중…" : "최신 기록 갱신"}</button>
            </div>

            {error && <div className={styles.error} role="alert">{error}</div>}

            <div className={styles.list}>
              {ranking.map((row, index) => {
                const rank = index + 1;
                const solved = optionalCorrectCount(row);
                const weightedScore = honorScore(row);
                return (
                  <article className={`${styles.row} ${rank <= 3 ? styles.podium : ""}`} key={`${row.id}-${rank}`}>
                    <div className={styles.rank} aria-label={`${rank}위`}>{rank <= 3 ? ["🥇", "🥈", "🥉"][rank - 1] : rank}</div>
                    <div className={styles.student}>
                      <b>{row.student_number}번 {row.student_name}</b>
                      <span>{row.class_name}반 · 기존 점수 {row.final_score.toLocaleString()}점</span>
                    </div>
                    <div className={styles.stat}>
                      <span>선택문제 해결</span>
                      <strong>{solved} / {OPTIONAL_TOTAL}</strong>
                    </div>
                    <div className={styles.stat}>
                      <span>명예 점수</span>
                      <strong>{weightedScore.toLocaleString()}점</strong>
                    </div>
                    <div className={styles.stat}>
                      <span>탈출 시간</span>
                      <strong>{formatDuration(row.elapsed_seconds)}</strong>
                    </div>
                  </article>
                );
              })}

              {!loading && !ranking.length && <div className={styles.empty}>선택한 학급의 제출 기록이 아직 없습니다.</div>}
            </div>

            <p className={styles.note}>순위 기준: 선택문제 해결 수 → 명예 점수 → 탈출 시간. 명예 점수는 기존 최종점수에 선택문제 정답 1개당 100점을 더합니다. 같은 학생이 여러 번 제출한 경우에도 이 기준으로 가장 좋은 기록 1개만 반영합니다.</p>
          </section>
        </div>
      )}
    </div>
  );
}

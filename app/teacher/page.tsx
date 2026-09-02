"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type AttemptMap = Record<string, number>;
type HintMap = Record<string, number[]>;
type BonusRecord = { attempts?: number; correct?: boolean };
type BonusMap = Record<string, BonusRecord>;

type ResultRow = {
  id: number | string;
  class_name: string;
  student_number: string;
  student_name: string;
  elapsed_seconds: number;
  attempts_json: AttemptMap | string | null;
  wrong_count: number;
  hints_json: HintMap | string | null;
  bonus_json: BonusMap | string | null;
  final_score: number;
  rank: string;
  reflection: string;
  completed_at: string | null;
  created_at: string;
};

type Announcement = {
  id: string;
  message: string;
  createdAt: string;
  expiresAt: string;
};

const CORE_PROBLEMS = [
  ["mirror", "거울 · 볼록한 방향"],
  ["magazine", "잡지 · 이차함수"],
  ["bookcase", "책장 · 식 구하기"],
  ["laptop-login", "노트북 · 로그인"],
  ["laptop-ip", "노트북 · IP"],
  ["frame", "액자 · 그래프"],
  ["perfume", "향수 · 폭 비교"],
  ["tv", "TV · 꼭짓점 형태"],
] as const;

const HIDDEN_BONUSES = [
  ["axis", "거울 옆", "대칭축"],
  ["parabola", "노트북 주변", "포물선"],
  ["x-value", "화분 근처", "x축에서 y값"],
  ["fair-line", "책장 아래", "공평한 선"],
  ["x-date", "책장 위", "x절편"],
  ["interest", "소파 오른쪽", "요즘 관심사"],
  ["exam", "카페트 왼쪽", "기말고사 날짜"],
  ["favorites", "카페트 중앙", "좋아하는 것"],
] as const;

function asRecord<T extends object>(value: T | string | null | undefined): T {
  if (value && typeof value === "object") return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object") return parsed as T;
    } catch {
      // Ignore malformed legacy rows.
    }
  }
  return {} as T;
}

function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds || 0));
  return `${Math.floor(seconds / 60)}분 ${String(seconds % 60).padStart(2, "0")}초`;
}

function formatUpdatedAt(value: string | null) {
  if (!value) return "아직 불러오지 않음";
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function downloadCsv(rows: ResultRow[]) {
  const header = ["반", "번호", "이름", "소요시간(초)", "오답", "힌트", "숨은보너스", "최종점수", "등급", "소감", "완료시각"];
  const lines = rows.map((row) => {
    const hints = asRecord<HintMap>(row.hints_json);
    const bonuses = asRecord<BonusMap>(row.bonus_json);
    const hiddenCorrect = HIDDEN_BONUSES.filter(([id]) => bonuses[`hidden:${id}`]?.correct).length;
    const values = [
      row.class_name,
      row.student_number,
      row.student_name,
      row.elapsed_seconds,
      row.wrong_count,
      Object.values(hints).reduce((sum, levels) => sum + (levels?.length ?? 0), 0),
      `${hiddenCorrect}/8`,
      row.final_score,
      row.rank,
      row.reflection,
      row.completed_at ?? row.created_at,
    ];
    return values.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",");
  });
  const blob = new Blob(["\ufeff", [header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `이차함수_방탈출_결과_${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function TeacherDashboard() {
  const [pin, setPin] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [results, setResults] = useState<ResultRow[]>([]);
  const [selectedClass, setSelectedClass] = useState("전체");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [announcementText, setAnnouncementText] = useState("10분 남았습니다!");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");

  const loadResults = useCallback(async (teacherPin: string, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetch("/api/teacher/results", {
        headers: { "x-teacher-pin": teacherPin },
        cache: "no-store",
      });
      const payload = await response.json() as { results?: ResultRow[]; updatedAt?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || "결과를 불러오지 못했습니다.");
      setResults(payload.results ?? []);
      setUpdatedAt(payload.updatedAt ?? new Date().toISOString());
      setError("");
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "결과를 불러오지 못했습니다.";
      setError(message);
      if (!silent) setPin("");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const loadAnnouncement = useCallback(async () => {
    try {
      const response = await fetch("/api/announcement", { cache: "no-store" });
      const payload = await response.json() as { announcement?: Announcement | null };
      setAnnouncement(payload.announcement ?? null);
    } catch {
      // Result polling remains usable even when an announcement lookup fails.
    }
  }, []);

  useEffect(() => {
    const savedPin = window.sessionStorage.getItem("math-escape-teacher-pin") ?? "";
    if (savedPin) {
      setPin(savedPin);
      setPinInput(savedPin);
      void loadResults(savedPin);
    }
    void loadAnnouncement();
  }, [loadAnnouncement, loadResults]);

  useEffect(() => {
    if (!pin) return;
    const timer = window.setInterval(() => {
      void loadResults(pin, true);
      void loadAnnouncement();
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [loadAnnouncement, loadResults, pin]);

  const classes = useMemo(() => {
    const values = new Set(results.map((row) => row.class_name).filter(Boolean));
    return [...values].sort((left, right) => left.localeCompare(right, "ko", { numeric: true }));
  }, [results]);

  const filteredResults = useMemo(
    () => selectedClass === "전체" ? results : results.filter((row) => row.class_name === selectedClass),
    [results, selectedClass],
  );

  const metrics = useMemo(() => {
    const count = filteredResults.length;
    const averageTime = count ? Math.round(filteredResults.reduce((sum, row) => sum + row.elapsed_seconds, 0) / count) : 0;
    const averageScore = count ? Math.round(filteredResults.reduce((sum, row) => sum + row.final_score, 0) / count) : 0;
    const totalHidden = filteredResults.reduce((sum, row) => {
      const bonuses = asRecord<BonusMap>(row.bonus_json);
      return sum + HIDDEN_BONUSES.filter(([id]) => bonuses[`hidden:${id}`]?.correct).length;
    }, 0);
    return {
      count,
      averageTime,
      averageScore,
      averageHidden: count ? totalHidden / count : 0,
    };
  }, [filteredResults]);

  const problemStats = useMemo(() => CORE_PROBLEMS.map(([id, label]) => {
    const attempts = filteredResults
      .map((row) => asRecord<AttemptMap>(row.attempts_json)[id])
      .filter((value): value is number => typeof value === "number" && value > 0);
    const firstTry = attempts.filter((value) => value === 1).length;
    return {
      id,
      label,
      rate: attempts.length ? Math.round((firstTry / attempts.length) * 100) : 0,
      averageAttempts: attempts.length ? attempts.reduce((sum, value) => sum + value, 0) / attempts.length : 0,
    };
  }), [filteredResults]);

  const hiddenStats = useMemo(() => HIDDEN_BONUSES.map(([id, location, label]) => {
    const discovered = filteredResults.filter((row) => {
      const bonuses = asRecord<BonusMap>(row.bonus_json);
      return Boolean(bonuses[`hidden-discovered:${id}`] || bonuses[`hidden:${id}`]);
    }).length;
    const correct = filteredResults.filter((row) => asRecord<BonusMap>(row.bonus_json)[`hidden:${id}`]?.correct).length;
    return {
      id,
      location,
      label,
      discoveredRate: filteredResults.length ? Math.round((discovered / filteredResults.length) * 100) : 0,
      correctRate: discovered ? Math.round((correct / discovered) * 100) : 0,
    };
  }), [filteredResults]);

  function unlock(event: FormEvent) {
    event.preventDefault();
    const nextPin = pinInput.trim();
    if (!nextPin) return;
    window.sessionStorage.setItem("math-escape-teacher-pin", nextPin);
    setPin(nextPin);
    void loadResults(nextPin);
  }

  async function sendAnnouncement(message = announcementText) {
    if (!pin || !message.trim()) return;
    setSending(true);
    setNotice("");
    try {
      const response = await fetch("/api/announcement", {
        method: "POST",
        headers: { "content-type": "application/json", "x-teacher-pin": pin },
        body: JSON.stringify({ message: message.trim(), durationMinutes: 10 }),
      });
      const payload = await response.json() as { announcement?: Announcement; error?: string };
      if (!response.ok) throw new Error(payload.error || "공지를 보내지 못했습니다.");
      setAnnouncement(payload.announcement ?? null);
      setAnnouncementText(message.trim());
      setNotice(`전체 학생 화면에 “${message.trim()}” 공지를 보냈습니다.`);
    } catch (sendError) {
      setNotice(sendError instanceof Error ? sendError.message : "공지를 보내지 못했습니다.");
    } finally {
      setSending(false);
    }
  }

  async function clearAnnouncement() {
    if (!pin) return;
    setSending(true);
    try {
      const response = await fetch("/api/announcement", {
        method: "DELETE",
        headers: { "x-teacher-pin": pin },
      });
      if (!response.ok) throw new Error("공지를 내리지 못했습니다.");
      setAnnouncement(null);
      setNotice("학생 화면의 공지를 종료했습니다.");
    } catch (clearError) {
      setNotice(clearError instanceof Error ? clearError.message : "공지를 내리지 못했습니다.");
    } finally {
      setSending(false);
    }
  }

  if (!pin) {
    return (
      <main className="teacher-login-shell">
        <section className="teacher-login-card">
          <div className="teacher-brand-mark">M²</div>
          <span className="teacher-kicker">TEACHER ACCESS</span>
          <h1>교사용 대시보드</h1>
          <p>학생 결과와 수업 공지는 교사용 비밀번호로 보호됩니다.</p>
          <form onSubmit={unlock}>
            <label>
              <span>교사용 비밀번호</span>
              <input type="password" value={pinInput} onChange={(event) => setPinInput(event.target.value)} autoComplete="current-password" />
            </label>
            <button type="submit" disabled={!pinInput.trim() || loading}>{loading ? "확인 중…" : "대시보드 열기"}</button>
          </form>
          {error && <p className="teacher-login-error" role="alert">{error}</p>}
          <Link href="/">← 학생 화면으로 돌아가기</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="teacher-dashboard">
      <aside className="teacher-sidebar">
        <div className="teacher-logo"><span>M²</span><div><b>이차함수 방탈출</b><small>TEACHER DASHBOARD</small></div></div>
        <nav aria-label="교사용 페이지 메뉴">
          <a className="active" href="#overview"><span>01</span>수업 현황</a>
          <a href="#problems"><span>02</span>문제 분석</a>
          <a href="#students"><span>03</span>학생 결과</a>
          <a href="#bonuses"><span>04</span>숨은 보너스</a>
          <a href="#answers"><span>05</span>문제·정답</a>
        </nav>
        <div className="teacher-sidebar-foot">
          <Link href="/">학생 화면 열기 ↗</Link>
          <button type="button" onClick={() => {
            window.sessionStorage.removeItem("math-escape-teacher-pin");
            setPin("");
            setResults([]);
          }}>잠금</button>
        </div>
      </aside>

      <div className="teacher-workspace">
        <header className="teacher-header">
          <div><span className="teacher-kicker">CLASS CONTROL ROOM</span><h1>수업 운영 대시보드</h1></div>
          <div className="teacher-header-actions">
            <label><span>반 선택</span><select value={selectedClass} onChange={(event) => setSelectedClass(event.target.value)}><option value="전체">전체 반</option>{classes.map((className) => <option value={className} key={className}>{className}반</option>)}</select></label>
            <button type="button" className="teacher-secondary" onClick={() => void loadResults(pin)} disabled={loading}>{loading ? "불러오는 중…" : "새로고침"}</button>
            <button type="button" className="teacher-download" onClick={() => downloadCsv(filteredResults)} disabled={!filteredResults.length}>CSV 다운로드</button>
          </div>
        </header>

        {error && <div className="teacher-error" role="alert">{error}</div>}

        <section className="teacher-section" id="overview">
          <div className="teacher-section-heading"><div><span>01 · LIVE OVERVIEW</span><h2>{selectedClass === "전체" ? "전체 반" : `${selectedClass}반`} 제출 현황</h2></div><small>제출 완료 기준 · {formatUpdatedAt(updatedAt)} 갱신</small></div>
          <div className="teacher-stat-grid">
            <article><span>제출 완료</span><strong>{metrics.count}<small>명</small></strong><p>현재 저장된 결과</p></article>
            <article><span>평균 소요 시간</span><strong>{formatDuration(metrics.averageTime)}</strong><p>탈출 완료까지</p></article>
            <article><span>평균 최종 점수</span><strong>{metrics.averageScore.toLocaleString()}<small>점</small></strong><p>보너스 포함 점수</p></article>
            <article className="accent"><span>평균 숨은 문제</span><strong>{metrics.averageHidden.toFixed(1)}<small>/ 8</small></strong><p>학생 1명당 해결 수</p></article>
          </div>

          <article className="teacher-broadcast-card">
            <div className="broadcast-pulse" aria-hidden="true"><span>!</span></div>
            <div className="broadcast-copy"><span>전체 학생 화면 공지</span><h3>남은 시간을 한 번에 알려 주세요.</h3><p>학생 화면은 5초마다 새 공지를 확인합니다. 큰 알림 뒤에는 상단 배너로 유지됩니다.</p></div>
            <div className="broadcast-controls">
              <button type="button" className="ten-minute-button" onClick={() => void sendAnnouncement("10분 남았습니다!")} disabled={sending}>10분 남았습니다! 표시</button>
              <div><input aria-label="직접 입력할 학생 공지" value={announcementText} onChange={(event) => setAnnouncementText(event.target.value)} maxLength={80} /><button type="button" onClick={() => void sendAnnouncement()} disabled={sending || !announcementText.trim()}>직접 보내기</button></div>
              {announcement && <button type="button" className="clear-notice" onClick={() => void clearAnnouncement()} disabled={sending}>현재 공지 종료</button>}
            </div>
          </article>
          {(notice || announcement) && <div className="broadcast-status" role="status"><span className={announcement ? "live" : ""}>{announcement ? "LIVE" : "완료"}</span>{notice || `현재 “${announcement?.message}” 공지가 표시 중입니다.`}</div>}
        </section>

        <section className="teacher-section teacher-two-column" id="problems">
          <article className="teacher-panel problem-panel">
            <div className="teacher-panel-heading"><div><span>02 · PROBLEM ANALYSIS</span><h2>문제별 1회 정답률</h2></div><small>첫 제출에서 해결한 학생 비율</small></div>
            <div className="problem-bars">
              {problemStats.map((problem) => <div className="problem-bar-row" key={problem.id}><div><b>{problem.label}</b><small>평균 {problem.averageAttempts.toFixed(1)}회 시도</small></div><div className="bar-track"><span style={{ width: `${problem.rate}%` }} /></div><strong>{problem.rate}%</strong></div>)}
            </div>
          </article>
          <article className="teacher-panel insight-panel">
            <div className="teacher-panel-heading"><div><span>QUICK INSIGHT</span><h2>수업 전 확인</h2></div></div>
            {filteredResults.length ? (() => {
              const hardest = [...problemStats].sort((left, right) => left.rate - right.rate)[0];
              const bestHidden = [...hiddenStats].sort((left, right) => right.discoveredRate - left.discoveredRate)[0];
              return <><div className="insight-number"><span>가장 낮은 1회 정답률</span><strong>{hardest.rate}%</strong><p>{hardest.label}</p></div><div className="insight-line"><span>가장 잘 발견된 숨은 문제</span><b>{bestHidden.location} · {bestHidden.discoveredRate}%</b></div><p className="insight-note">정답률이 낮은 문제는 다음 수업에서 풀이 과정을 함께 비교해 보세요.</p></>;
            })() : <div className="teacher-empty">아직 선택한 반의 제출 결과가 없습니다.</div>}
          </article>
        </section>

        <section className="teacher-section" id="students">
          <article className="teacher-panel student-results-panel">
            <div className="teacher-panel-heading"><div><span>03 · STUDENT RESULTS</span><h2>학생별 결과</h2></div><small>{filteredResults.length}명 · 최근 제출순</small></div>
            <div className="teacher-table-wrap">
              <table>
                <thead><tr><th>학생</th><th>소요 시간</th><th>오답</th><th>힌트</th><th>숨은 보너스</th><th>최종 점수</th><th>등급</th></tr></thead>
                <tbody>
                  {filteredResults.map((row) => {
                    const hints = asRecord<HintMap>(row.hints_json);
                    const bonuses = asRecord<BonusMap>(row.bonus_json);
                    const hintCount = Object.values(hints).reduce((sum, levels) => sum + (levels?.length ?? 0), 0);
                    const hiddenCount = HIDDEN_BONUSES.filter(([id]) => bonuses[`hidden:${id}`]?.correct).length;
                    return <tr key={row.id}><td><b>{row.student_number}번 {row.student_name}</b><span>{row.class_name}반</span></td><td>{formatDuration(row.elapsed_seconds)}</td><td className={row.wrong_count ? "warning" : "good"}>{row.wrong_count}회</td><td>{hintCount}회</td><td><span className="mini-progress"><i style={{ width: `${hiddenCount / 8 * 100}%` }} /></span>{hiddenCount}/8</td><td><b>{row.final_score.toLocaleString()}점</b></td><td><span className={`rank-pill rank-${row.rank?.charAt(0) || "D"}`}>{row.rank?.charAt(0) || "D"}</span></td></tr>;
                  })}
                  {!filteredResults.length && <tr><td colSpan={7}><div className="teacher-empty">아직 선택한 반의 제출 결과가 없습니다.</div></td></tr>}
                </tbody>
              </table>
            </div>
          </article>
        </section>

        <section className="teacher-section" id="bonuses">
          <article className="teacher-panel">
            <div className="teacher-panel-heading"><div><span>04 · EASTER EGG TRACKER</span><h2>숨은 보너스 발견 현황</h2></div><small>발견률 · 발견한 학생 중 정답률</small></div>
            <div className="bonus-tracker-grid">
              {hiddenStats.map((bonus, index) => <article key={bonus.id}><div className="bonus-index">B{index + 1}</div><div><span>{bonus.location}</span><h3>{bonus.label}</h3></div><div className="bonus-rate"><b>{bonus.discoveredRate}%</b><span>발견</span></div><div className="bonus-rate secondary"><b>{bonus.correctRate}%</b><span>정답</span></div></article>)}
            </div>
          </article>
        </section>

        <section className="teacher-section" id="answers">
          <article className="teacher-panel answer-panel">
            <div className="teacher-panel-heading"><div><span>05 · ANSWER KEY</span><h2>문제·정답 빠른 확인</h2></div><small>수업 중 필요한 항목만 펼쳐 보세요.</small></div>
            <div className="answer-groups">
              <details><summary>본문 문제 정답 <span>8문제</span></summary><ol><li>거울 — 아래로 볼록</li><li>잡지 — 이차함수</li><li>책장 — 001.008.017.005</li><li>노트북 로그인 — 자판 위치 단서</li><li>노트북 IP — 001.008.017.005</li><li>액자 — B</li><li>향수 — BCA</li><li>TV — A</li></ol></details>
              <details><summary>숨은 보너스 정답 <span>8문제</span></summary><ol><li>대칭축 — x=3</li><li>그래프 이름 — 포물선</li><li>x축 위 y값 — 0</li><li>가장 공평한 선 — 대칭축</li><li>x축과 만나는 장소 — x절편</li><li>요즘 관심사 — 바이브 코딩·웹페이지·3학년 12반</li><li>기말고사 — 11월 9일~11일</li><li>좋아하는 것 — 수학·AI·GPT·우리반</li></ol></details>
              <details><summary>보너스 금고 정답 <span>6문제</span></summary><ol><li>원의 현 — 현</li><li>한 점에서 만나는 직선 — 접선</li><li>접선과 반지름의 각 — 90도</li><li>평균 — 개수</li><li>도형의 관계 — 닮음</li><li>직각삼각형의 두 변의 비 — 삼각비</li></ol></details>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}

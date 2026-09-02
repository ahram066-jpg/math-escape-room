"use client";

import { FocusEvent, FormEvent, PointerEvent, useEffect, useRef, useState } from "react";

type HotspotId =
  | "mirror"
  | "magazine"
  | "bookcase"
  | "laptop"
  | "frame"
  | "perfume"
  | "tv"
  | "plant"
  | "door";

type CharacterType = "female" | "male";
type Student = { className: string; number: string; name: string; character: CharacterType | "" };
type Position = { x: number; y: number };
type HintLevel = 1 | 2 | 3;
type HintProblemId = Exclude<HotspotId, "plant" | "door"> | "laptop-ip";
type UsedHints = Partial<Record<HintProblemId, HintLevel[]>>;

type CompletionSnapshot = {
  startedAt: number;
  completedAt: number;
  elapsedSeconds: number;
  incorrectCount: number;
  usedHints: UsedHints;
  timePenalty: number;
  incorrectPenalty: number;
  hintPenalty: number;
  escapeScore: number;
};

type BonusRecord = { attempts: number; correct: boolean };
type BonusRecords = Record<string, BonusRecord>;
type HiddenBonusId = "axis" | "parabola" | "x-value" | "fair-line" | "x-date" | "interest" | "exam" | "favorites";
type HiddenBonusQuestion = {
  id: HiddenBonusId;
  question: string;
  answerLabel: string;
  initials?: string;
  successMessage?: string;
  x: number;
  y: number;
  width: number;
  height: number;
};
type BonusQuestion = {
  id: string;
  title: string;
  question: string;
  answers: string[];
  answerLabel: string;
  concept: string;
  future: string;
  initials?: string;
};

const TOTAL_TIME = 40 * 60;
const START_SCORE = 1000;
const PROGRESS_KEY = "math-lab-hints-v1";
const HINT_COSTS: Record<HintLevel, number> = { 1: 50, 2: 100, 3: 200 };
const WRONG_PENALTY = 30;
const BONUS_QUESTION_SCORE = 30;
const BONUS_COMPLETION_SCORE = 20;

const CHEER_FRAGMENTS = [
  { id: "math", text: "수학", source: "magazine" },
  { id: "beauty", text: "초미녀와", source: "laptop" },
  { id: "together", text: "함께", source: "tv" },
  { id: "semester-number", text: "2", source: "perfume" },
  { id: "semester", text: "학기", source: "mirror" },
  { id: "also", text: "도", source: "bookcase" },
  { id: "cheer", text: "화이팅!", source: "frame" },
] as const;
type CheerFragmentId = (typeof CHEER_FRAGMENTS)[number]["id"];
const CHEER_CORRECT_ORDER: CheerFragmentId[] = CHEER_FRAGMENTS.map((fragment) => fragment.id);
const CHEER_SCRAMBLED_ORDER: CheerFragmentId[] = ["semester", "cheer", "math", "also", "beauty", "semester-number", "together"];

const KEYBOARD_ROWS = [
  [["Q", "ㅂ"], ["W", "ㅈ"], ["E", "ㄷ"], ["R", "ㄱ"], ["T", "ㅅ"], ["Y", "ㅛ"], ["U", "ㅕ"], ["I", "ㅑ"], ["O", "ㅐ"], ["P", "ㅔ"]],
  [["A", "ㅁ"], ["S", "ㄴ"], ["D", "ㅇ"], ["F", "ㄹ"], ["G", "ㅎ"], ["H", "ㅗ"], ["J", "ㅓ"], ["K", "ㅏ"], ["L", "ㅣ"]],
  [["Z", "ㅋ"], ["X", "ㅌ"], ["C", "ㅊ"], ["V", "ㅍ"], ["B", "ㅠ"], ["N", "ㅜ"], ["M", "ㅡ"]],
] as const;
const WORN_KEYS = new Set<string>(["W", "F", "J", "P", "Z"]);
const LOGIN_HASHES = { username: 1746554207, password: 2952542498 } as const;

const BONUS_QUESTIONS: BonusQuestion[] = [
  {
    id: "chord",
    title: "원의 현",
    question: "원 위의 서로 다른 두 점을 연결한 선분을 무엇이라고 할까요?",
    answers: ["현"],
    answerLabel: "현",
    concept: "원의 현은 원 위의 서로 다른 두 점을 연결한 선분입니다.",
    future: "2학기 원의 성질에 필요한 기억",
  },
  {
    id: "tangent",
    title: "원의 접선",
    question: "원과 한 점에서 만나는 직선을 무엇이라고 할까요?",
    answers: ["접선"],
    answerLabel: "접선",
    concept: "접선은 원과 오직 한 점에서 만나는 직선입니다.",
    future: "2학기 원의 성질에 필요한 기억",
  },
  {
    id: "right-angle",
    title: "접선과 반지름이 이루는 각",
    question: "원의 접선과 접점을 지나는 반지름이 이루는 각의 크기는 몇 도일까요?",
    answers: ["90", "90도", "직각"],
    answerLabel: "90도(직각)",
    concept: "접점에서 그은 반지름은 그 점에서의 접선과 수직입니다.",
    future: "2학기 원의 성질에 필요한 기억",
  },
  {
    id: "mean",
    title: "평균",
    question: "자료의 값을 모두 더한 뒤 자료의 (    )로 나누어 구하는 값을 평균이라고 한다. 빈칸에 들어갈 두 글자는?",
    answers: ["개수", "갯수"],
    answerLabel: "개수",
    concept: "평균은 자료의 값의 합을 자료의 개수로 나눈 값입니다.",
    future: "2학기 통계에 필요한 기억",
  },
  {
    id: "similarity",
    title: "닮음",
    question: "모양이 같고 크기만 다르거나, 크기까지 같은 두 도형의 관계를 무엇이라고 할까요?",
    answers: ["닮음", "닮은 도형", "닮은도형", "닮음 관계", "닮음관계"],
    answerLabel: "닮음",
    concept: "대응하는 각의 크기가 같고 대응하는 변의 길이의 비가 일정한 관계입니다.",
    future: "2학기 삼각비에 필요한 기억",
    initials: "ㄷㅇ ㄷㅎ",
  },
  {
    id: "trig-ratio",
    title: "삼각비 초성퀴즈",
    question: "직각삼각형에서 두 변의 길이의 비를 이용하여 각이나 거리를 알아내는 개념입니다.",
    answers: ["삼각비"],
    answerLabel: "삼각비",
    concept: "삼각비는 직각삼각형에서 각과 두 변의 길이의 비 사이의 관계입니다.",
    future: "2학기에 새롭게 만날 개념",
    initials: "ㅅㄱㅂ",
  },
];

const HIDDEN_BONUS_QUESTIONS: HiddenBonusQuestion[] = [
  {
    id: "axis",
    question: "꼭짓점이 (3, -2)인 포물선의 대칭축은?",
    answerLabel: "x=3",
    x: 12,
    y: 22,
    width: 7,
    height: 10,
  },
  {
    id: "parabola",
    question: "이차함수 그래프의 이름은?",
    answerLabel: "포물선",
    initials: "ㅍㅁㅅ",
    x: 31,
    y: 32,
    width: 8,
    height: 10,
  },
  {
    id: "x-value",
    question: "포물선이 x축을 만났다. 그 순간 y의 값은?",
    answerLabel: "0",
    x: 76,
    y: 48,
    width: 8,
    height: 12,
  },
  {
    id: "fair-line",
    question: "포물선에서 양쪽을 항상 똑같이 대하는 세상에서 가장 공평한 선은?",
    answerLabel: "대칭축",
    x: 95,
    y: 61,
    width: 7,
    height: 14,
  },
  {
    id: "x-date",
    question: "포물선이 x축과 소개팅을 했다. 둘이 실제로 만난 장소를 수학에서는 뭐라고 할까?",
    answerLabel: "x절편",
    successMessage: "💘 만남 성사!",
    x: 56,
    y: 72,
    width: 9,
    height: 10,
  },
  {
    id: "interest",
    question: "수학초미녀의 요즘 관심사는?",
    answerLabel: "바이브 코딩, 웹페이지, 3학년 12반 중 하나",
    x: 42,
    y: 13,
    width: 8,
    height: 8,
  },
  {
    id: "exam",
    question: "대전삼천중학교 3학년 2학기 기말고사는 11월 0일부터 0일까지이다. 두 날짜를 맞혀보세요!",
    answerLabel: "9일부터 11일까지",
    x: 82,
    y: 84,
    width: 9,
    height: 9,
  },
  {
    id: "favorites",
    question: "수학초미녀가 좋아하는 것은?",
    answerLabel: "수학, AI, GPT, 우리반 중 하나",
    x: 22,
    y: 82,
    width: 9,
    height: 9,
  },
];

const PUZZLE_HINTS: Record<HintProblemId, { title: string; hints: [string, string, string] }> = {
  mirror: {
    title: "거울에 남은 문장",
    hints: [
      "계수 a의 부호와 포물선이 볼록한 방향을 함께 관찰하세요.",
      "y=ax²에서 a가 양수이면 그래프는 아래로 볼록합니다.",
      "U자 모양 그래프의 안쪽이 어느 쪽을 향하는지 교과서의 ‘○○로 볼록’ 표현으로 바꿔 보세요.",
    ],
  },
  magazine: {
    title: "잡지 속 네 글자",
    hints: [
      "식에서 x의 가장 높은 차수가 몇 차인지 살펴보세요.",
      "y가 x에 대한 이차식일 때 사용하는 함수의 이름을 떠올리세요.",
      "정답은 ‘이차’로 시작하며, 문제에 적힌 y=f(x)의 종류를 네 글자로 쓰면 됩니다.",
    ],
  },
  bookcase: {
    title: "연구 서적의 IP 암호",
    hints: [
      "꼭짓점 좌표를 먼저 이용해 이차함수를 꼭짓점 형태로 나타내 보세요.",
      "꼭짓점이 (-4,1)이므로 y=a(x+4)²+1로 놓고 주어진 점을 대입하세요.",
      "a를 구한 뒤 식을 전개하면 b와 c가 나옵니다. 마지막 숫자는 y=x²의 그래프를 y=(x-5)²로 만들 때 x축 방향으로 평행이동한 값입니다.",
    ],
  },
  laptop: {
    title: "노트북 로그인",
    hints: [
      "글자의 뜻보다 키보드에서 손가락이 움직이는 위치를 살펴보세요.",
      "메모의 한글을 입력할 때 누르는 키를 다른 문자로 읽어 보세요.",
      "한글 단어를 영문 입력 상태에서 같은 자판 위치로 입력하세요.",
    ],
  },
  "laptop-ip": {
    title: "연구실 IP 연결",
    hints: [
      "책장에서 얻은 네 개의 숫자 묶음을 찾아보세요.",
      "각 숫자는 세 자리로 맞추고, 묶음 사이에는 점을 넣습니다.",
      "단서함의 IP ADDRESS를 표시된 형식 그대로 옮겨 적으면 됩니다.",
    ],
  },
  frame: {
    title: "액자 속 사라진 그래프",
    hints: [
      "각 선택지에서 꼭짓점 좌표와 포물선이 볼록한 방향을 따로 확인하세요.",
      "꼭짓점 형태 y=a(x-p)²+q에서 꼭짓점은 (p,q)이고, 위로 볼록하려면 a<0입니다.",
      "괄호 안은 x+2여야 꼭짓점의 x좌표가 -2가 되고, 괄호 앞 계수의 부호는 음수여야 합니다.",
    ],
  },
  perfume: {
    title: "향수병의 포물선 농도",
    hints: [
      "그래프의 폭은 a의 부호가 아니라 절댓값과 관계있습니다.",
      "|a|가 클수록 포물선의 폭이 좁고, |a|가 작을수록 넓습니다.",
      "세 계수의 절댓값 3, 1, 1/2을 큰 값부터 작은 값 순서로 정리한 뒤 병의 글자와 연결하세요.",
    ],
  },
  tv: {
    title: "마지막 통신 좌표",
    hints: [
      "꼭짓점 좌표를 이용해 먼저 꼭짓점 형태의 식을 세워 보세요.",
      "꼭짓점이 (2,-3)이므로 y=a(x-2)²-3으로 놓을 수 있습니다.",
      "점 (0,5)를 식에 대입해 a를 구한 뒤, 같은 형태의 선택지를 찾으세요.",
    ],
  },
};

const HOTSPOTS: Array<{
  id: HotspotId;
  label: string;
  hint: string;
  x: number;
  y: number;
}> = [
  { id: "mirror", label: "거울", hint: "화장대 거울", x: 5, y: 69 },
  { id: "laptop", label: "노트북", hint: "통신 노트북", x: 18, y: 43 },
  { id: "frame", label: "액자", hint: "포물선 액자", x: 24, y: 17 },
  { id: "plant", label: "화분", hint: "수상한 화분", x: 37, y: 23 },
  { id: "door", label: "문", hint: "잠긴 출구", x: 50, y: 22 },
  { id: "tv", label: "TV", hint: "통신 화면", x: 69, y: 22 },
  { id: "bookcase", label: "책장", hint: "연구 서적", x: 89, y: 31 },
  { id: "magazine", label: "잡지", hint: "테이블 위 잡지", x: 65, y: 80 },
  { id: "perfume", label: "향수", hint: "향수병 세 개", x: 4, y: 84 },
];

const INITIAL_SOLVED: Record<HotspotId, boolean> = {
  mirror: false,
  magazine: false,
  bookcase: false,
  laptop: false,
  frame: false,
  perfume: false,
  tv: false,
  plant: false,
  door: false,
};

function formatTime(seconds: number) {
  const safe = Math.max(0, seconds);
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(
    safe % 60,
  ).padStart(2, "0")}`;
}

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s/g, "");
}

function keepInputVisible(event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  const target = event.currentTarget;
  window.setTimeout(() => target.scrollIntoView({ block: "nearest", behavior: "smooth" }), 320);
}

function normalizeLogin(value: string) {
  return value.trim().toLowerCase();
}

function hashLogin(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function calculateHintPenalty(usedHints: UsedHints) {
  return Object.values(usedHints).reduce(
    (total, levels) => total + (levels ?? []).reduce((sum, level) => sum + HINT_COSTS[level], 0),
    0,
  );
}

function calculateEscapeScore(elapsedSeconds: number, incorrectCount: number, hintPenalty: number) {
  const timePenalty = Math.floor(Math.max(0, elapsedSeconds) / 6);
  const incorrectPenalty = Math.max(0, incorrectCount) * WRONG_PENALTY;
  return {
    timePenalty,
    incorrectPenalty,
    escapeScore: Math.max(0, START_SCORE - timePenalty - incorrectPenalty - hintPenalty),
  };
}

function getRank(score: number) {
  if (score >= 1050) return { grade: "S", title: "전설의 탈출가" };
  if (score >= 900) return { grade: "A", title: "뛰어난 탐정" };
  if (score >= 750) return { grade: "B", title: "숙련된 해결사" };
  if (score >= 600) return { grade: "C", title: "끈기 있는 도전자" };
  return { grade: "D", title: "탈출 성공!" };
}

export default function Home() {
  const [screen, setScreen] = useState<"intro" | "playing" | "escaped">("intro");
  const [student, setStudent] = useState<Student>({ className: "", number: "", name: "", character: "" });
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [completion, setCompletion] = useState<CompletionSnapshot | null>(null);
  const [active, setActive] = useState<HotspotId | null>(null);
  const [solved, setSolved] = useState(INITIAL_SOLVED);
  const [attempts, setAttempts] = useState<Record<string, number>>({});
  const [incorrectCount, setIncorrectCount] = useState(0);
  const [player, setPlayer] = useState<Position>({ x: 49, y: 67 });
  const [dragging, setDragging] = useState(false);
  const [toast, setToast] = useState("방 안의 반짝이는 물건을 조사해 보세요.");
  const [input, setInput] = useState("");
  const [login, setLogin] = useState({ username: "", password: "", ip: "" });
  const [laptopStage, setLaptopStage] = useState<"login" | "ip">("login");
  const [connected, setConnected] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [reflection, setReflection] = useState("");
  const [submitState, setSubmitState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [runId, setRunId] = useState("");
  const [usedHints, setUsedHints] = useState<UsedHints>({});
  const [notes, setNotes] = useState("");
  const [shownHintLevel, setShownHintLevel] = useState<HintLevel | null>(null);
  const [pendingHint, setPendingHint] = useState<{ problem: HintProblemId; level: HintLevel; cost: number } | null>(null);
  const [resetPending, setResetPending] = useState(false);
  const [escapeConfirmPending, setEscapeConfirmPending] = useState(false);
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [scoreFlash, setScoreFlash] = useState(false);
  const [scoreDelta, setScoreDelta] = useState(0);
  const [bonusRecords, setBonusRecords] = useState<BonusRecords>({});
  const [bonusOpen, setBonusOpen] = useState(false);
  const [bonusIndex, setBonusIndex] = useState(0);
  const [bonusAnswer, setBonusAnswer] = useState("");
  const [bonusFeedback, setBonusFeedback] = useState<"idle" | "correct" | "wrong" | "failed">("idle");
  const [bonusBurst, setBonusBurst] = useState(0);
  const [hiddenBonusActive, setHiddenBonusActive] = useState<HiddenBonusId | null>(null);
  const [hiddenBonusAnswer, setHiddenBonusAnswer] = useState("");
  const [hiddenBonusFeedback, setHiddenBonusFeedback] = useState<"idle" | "correct" | "wrong">("idle");
  const [hiddenBonusRecords, setHiddenBonusRecords] = useState<BonusRecords>({});
  const [discoveredHiddenBonuses, setDiscoveredHiddenBonuses] = useState<HiddenBonusId[]>([]);
  const [answerFeedback, setAnswerFeedback] = useState<"correct" | "wrong" | null>(null);
  const [cheerOrder, setCheerOrder] = useState<CheerFragmentId[]>([]);
  const [cheerAssemblyOpen, setCheerAssemblyOpen] = useState(false);
  const [cheerFeedback, setCheerFeedback] = useState<"idle" | "wrong">("idle");
  const [messageRestored, setMessageRestored] = useState(false);
  const roomRef = useRef<HTMLDivElement>(null);
  const submissionLockRef = useRef(false);
  const bonusLockRef = useRef(false);
  const completionRef = useRef<CompletionSnapshot | null>(null);
  const answerFeedbackTimerRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(PROGRESS_KEY);
      if (saved) {
        const progress = JSON.parse(saved) as {
          screen?: "intro" | "playing" | "escaped";
          student?: Student;
          startedAt?: number | null;
          completion?: CompletionSnapshot | null;
          solved?: Record<HotspotId, boolean>;
          attempts?: Record<string, number>;
          incorrectCount?: number;
          player?: Position;
          login?: { username: string; password: string; ip: string };
          laptopStage?: "login" | "ip";
          connected?: boolean;
          hasKey?: boolean;
          reflection?: string;
          runId?: string;
          usedHints?: UsedHints;
          notes?: string;
          bonusRecords?: BonusRecords;
          bonusOpen?: boolean;
          bonusIndex?: number;
          hiddenBonusRecords?: BonusRecords;
          discoveredHiddenBonuses?: HiddenBonusId[];
          cheerOrder?: CheerFragmentId[];
          messageRestored?: boolean;
        };
        if (progress.screen) setScreen(progress.screen);
        if (progress.student) setStudent({ ...progress.student, character: progress.student.character ?? "" });
        if (typeof progress.startedAt === "number") setStartedAt(progress.startedAt);
        if (progress.completion) {
          setCompletion(progress.completion);
          completionRef.current = progress.completion;
        }
        if (progress.solved) setSolved({ ...INITIAL_SOLVED, ...progress.solved });
        if (progress.attempts) setAttempts(progress.attempts);
        if (typeof progress.incorrectCount === "number") setIncorrectCount(Math.max(0, progress.incorrectCount));
        if (progress.player) setPlayer(progress.player);
        if (progress.login) setLogin(progress.login);
        if (progress.laptopStage) setLaptopStage(progress.laptopStage);
        if (typeof progress.connected === "boolean") setConnected(progress.connected);
        if (typeof progress.hasKey === "boolean") setHasKey(progress.hasKey);
        if (typeof progress.reflection === "string") setReflection(progress.reflection);
        if (typeof progress.runId === "string") setRunId(progress.runId);
        if (progress.usedHints && typeof progress.usedHints === "object") setUsedHints(progress.usedHints);
        if (typeof progress.notes === "string") setNotes(progress.notes);
        if (progress.bonusRecords && typeof progress.bonusRecords === "object") setBonusRecords(progress.bonusRecords);
        if (typeof progress.bonusOpen === "boolean") setBonusOpen(progress.bonusOpen);
        if (typeof progress.bonusIndex === "number") setBonusIndex(Math.max(0, Math.min(BONUS_QUESTIONS.length - 1, progress.bonusIndex)));
        if (progress.hiddenBonusRecords && typeof progress.hiddenBonusRecords === "object") setHiddenBonusRecords(progress.hiddenBonusRecords);
        if (Array.isArray(progress.discoveredHiddenBonuses)) {
          setDiscoveredHiddenBonuses(progress.discoveredHiddenBonuses.filter((id): id is HiddenBonusId => HIDDEN_BONUS_QUESTIONS.some((question) => question.id === id)));
        }
        if (Array.isArray(progress.cheerOrder)) {
          const safeOrder = progress.cheerOrder.filter((id): id is CheerFragmentId => CHEER_CORRECT_ORDER.includes(id));
          setCheerOrder([...new Set(safeOrder)]);
        }
        if (typeof progress.messageRestored === "boolean") setMessageRestored(progress.messageRestored);
      }
    } catch {
      window.localStorage.removeItem(PROGRESS_KEY);
    } finally {
      setClockNow(Date.now());
      setProgressLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!progressLoaded) return;
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify({
      screen,
      student,
      startedAt,
      completion,
      solved,
      attempts,
      incorrectCount,
      player,
      login,
      laptopStage,
      connected,
      hasKey,
      reflection,
      runId,
      usedHints,
      notes,
      bonusRecords,
      bonusOpen,
      bonusIndex,
      hiddenBonusRecords,
      discoveredHiddenBonuses,
      cheerOrder,
      messageRestored,
    }));
  }, [attempts, bonusIndex, bonusOpen, bonusRecords, cheerOrder, completion, connected, discoveredHiddenBonuses, hasKey, hiddenBonusRecords, incorrectCount, laptopStage, login, messageRestored, notes, player, progressLoaded, reflection, runId, screen, solved, startedAt, student, usedHints]);

  useEffect(() => {
    setShownHintLevel(null);
  }, [active, laptopStage]);

  useEffect(() => {
    completionRef.current = completion;
  }, [completion]);

  useEffect(() => {
    if (screen !== "playing" || !startedAt || completion) return;
    setClockNow(Date.now());
    const timer = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [completion, screen, startedAt]);

  const coreSolved = ["mirror", "magazine", "bookcase"].filter(
    (id) => solved[id as HotspotId],
  ).length;
  const signalSolved = ["frame", "perfume"].filter(
    (id) => solved[id as HotspotId],
  ).length;
  const elapsed = completion?.elapsedSeconds ?? (startedAt ? Math.max(0, Math.floor((clockNow - startedAt) / 1000)) : 0);
  const remaining = Math.max(0, TOTAL_TIME - elapsed);
  const solvedCount = Object.values(solved).filter(Boolean).length;
  const hintCount = Object.values(usedHints).reduce((sum, levels) => sum + (levels?.length ?? 0), 0);
  const hintDeduction = completion?.hintPenalty ?? calculateHintPenalty(usedHints);
  const liveScore = calculateEscapeScore(elapsed, incorrectCount, hintDeduction);
  const escapeScore = completion?.escapeScore ?? liveScore.escapeScore;
  const timePenalty = completion?.timePenalty ?? liveScore.timePenalty;
  const incorrectPenalty = completion?.incorrectPenalty ?? liveScore.incorrectPenalty;
  const bonusCorrectCount = BONUS_QUESTIONS.filter((question) => bonusRecords[question.id]?.correct).length;
  const bonusResolvedCount = BONUS_QUESTIONS.filter((question) => {
    const record = bonusRecords[question.id];
    return Boolean(record?.correct || (record?.attempts ?? 0) >= 2);
  }).length;
  const allBonusCorrect = bonusCorrectCount === BONUS_QUESTIONS.length;
  const bonusScore = bonusCorrectCount * BONUS_QUESTION_SCORE + (allBonusCorrect ? BONUS_COMPLETION_SCORE : 0);
  const finalScore = escapeScore + bonusScore;
  const rank = getRank(finalScore);
  const headerScore = screen === "intro" ? START_SCORE : screen === "escaped" ? finalScore : escapeScore;
  const headerScoreLabel = screen === "intro" ? "START SCORE" : completion ? "확정 점수" : "예상 점수";
  const currentBonusQuestion = BONUS_QUESTIONS[bonusIndex];
  const currentBonusRecord = bonusRecords[currentBonusQuestion.id] ?? { attempts: 0, correct: false };
  const hiddenBonusCorrectCount = HIDDEN_BONUS_QUESTIONS.filter((question) => hiddenBonusRecords[question.id]?.correct).length;
  const currentHiddenBonus = hiddenBonusActive ? HIDDEN_BONUS_QUESTIONS.find((question) => question.id === hiddenBonusActive) ?? null : null;
  const bonusRemainingAttempts = Math.max(0, 2 - currentBonusRecord.attempts);
  const currentHintProblem: HintProblemId | null = active
    ? active === "laptop"
      ? laptopStage === "ip" ? "laptop-ip" : "laptop"
      : active === "plant" || active === "door" ? null : active
    : null;
  const currentHintConfig = currentHintProblem ? PUZZLE_HINTS[currentHintProblem] : null;
  const currentUsedHints = currentHintProblem ? usedHints[currentHintProblem] ?? [] : [];
  const collectedCheerIds = CHEER_FRAGMENTS.filter((fragment) => solved[fragment.source]).map((fragment) => fragment.id);

  function beginGame(event: FormEvent) {
    event.preventDefault();
    if (!student.className.trim() || !student.number.trim() || !student.name.trim() || !student.character) return;
    const start = Date.now();
    setStartedAt(start);
    setClockNow(start);
    setRunId(window.crypto.randomUUID());
    setScreen("playing");
  }

  function requestHint(level: HintLevel) {
    if (!currentHintProblem) return;
    if (currentUsedHints.includes(level)) {
      setShownHintLevel(level);
      return;
    }
    if (completionRef.current) return;
    if (level > 1 && !currentUsedHints.includes((level - 1) as HintLevel)) return;
    setPendingHint({ problem: currentHintProblem, level, cost: HINT_COSTS[level] });
  }

  function confirmHintUse() {
    if (!pendingHint || submissionLockRef.current || completionRef.current) return;
    submissionLockRef.current = true;
    window.setTimeout(() => {
      submissionLockRef.current = false;
    }, 350);
    const { problem, level, cost } = pendingHint;
    if ((usedHints[problem] ?? []).includes(level)) {
      setShownHintLevel(level);
      setPendingHint(null);
      return;
    }
    setUsedHints((current) => ({
      ...current,
      [problem]: (current[problem] ?? []).includes(level)
        ? current[problem]
        : [...(current[problem] ?? []), level].sort((a, b) => a - b),
    }));
    setScoreDelta(-cost);
    setScoreFlash(true);
    window.setTimeout(() => setScoreFlash(false), 650);
    setShownHintLevel(level);
    setPendingHint(null);
  }

  function requestReset() {
    setResetPending(true);
  }

  function confirmReset() {
    window.localStorage.removeItem(PROGRESS_KEY);
    if (answerFeedbackTimerRef.current !== null) {
      window.clearTimeout(answerFeedbackTimerRef.current);
      answerFeedbackTimerRef.current = null;
    }
    setScreen("intro");
    setStudent({ className: "", number: "", name: "", character: "" });
    setStartedAt(null);
    setClockNow(Date.now());
    setCompletion(null);
    completionRef.current = null;
    setActive(null);
    setSolved(INITIAL_SOLVED);
    setAttempts({});
    setIncorrectCount(0);
    setPlayer({ x: 49, y: 67 });
    setDragging(false);
    setToast("방 안의 반짝이는 물건을 조사해 보세요.");
    setInput("");
    setLogin({ username: "", password: "", ip: "" });
    setLaptopStage("login");
    setConnected(false);
    setHasKey(false);
    setReflection("");
    setSubmitState("idle");
    setRunId("");
    setUsedHints({});
    setNotes("");
    setShownHintLevel(null);
    setPendingHint(null);
    setBonusRecords({});
    setBonusOpen(false);
    setBonusIndex(0);
    setBonusAnswer("");
    setBonusFeedback("idle");
    setBonusBurst(0);
    setHiddenBonusActive(null);
    setHiddenBonusAnswer("");
    setHiddenBonusFeedback("idle");
    setHiddenBonusRecords({});
    setDiscoveredHiddenBonuses([]);
    setAnswerFeedback(null);
    setCheerOrder([]);
    setCheerAssemblyOpen(false);
    setCheerFeedback("idle");
    setMessageRestored(false);
    setResetPending(false);
    setEscapeConfirmPending(false);
  }

  function bumpAttempt(id: string) {
    setAttempts((current) => ({ ...current, [id]: (current[id] ?? 0) + 1 }));
  }

  function withSubmissionLock(action: () => void) {
    if (submissionLockRef.current || completionRef.current) return;
    submissionLockRef.current = true;
    action();
    window.setTimeout(() => {
      submissionLockRef.current = false;
    }, 350);
  }

  function recordWrong() {
    setIncorrectCount((current) => current + 1);
    setScoreDelta(-WRONG_PENALTY);
    setScoreFlash(true);
    window.setTimeout(() => setScoreFlash(false), 650);
  }

  function showAnswerFeedback(result: "correct" | "wrong") {
    if (answerFeedbackTimerRef.current !== null) {
      window.clearTimeout(answerFeedbackTimerRef.current);
    }
    setAnswerFeedback(result);
    answerFeedbackTimerRef.current = window.setTimeout(() => {
      setAnswerFeedback(null);
      answerFeedbackTimerRef.current = null;
    }, 1100);
  }

  function finalizeEscape(endTime = Date.now()) {
    if (completionRef.current || !startedAt) return completionRef.current;
    const elapsedSeconds = Math.max(0, Math.floor((endTime - startedAt) / 1000));
    const hintPenalty = calculateHintPenalty(usedHints);
    const calculated = calculateEscapeScore(elapsedSeconds, incorrectCount, hintPenalty);
    const snapshot: CompletionSnapshot = {
      startedAt,
      completedAt: endTime,
      elapsedSeconds,
      incorrectCount,
      usedHints,
      timePenalty: calculated.timePenalty,
      incorrectPenalty: calculated.incorrectPenalty,
      hintPenalty,
      escapeScore: calculated.escapeScore,
    };
    completionRef.current = snapshot;
    setCompletion(snapshot);
    setClockNow(endTime);
    return snapshot;
  }

  function markSolved(id: HotspotId, message: string) {
    setSolved((current) => ({ ...current, [id]: true }));
    setToast(message);
    setInput("");
    setActive(null);
  }

  function canOpen(id: HotspotId) {
    if (id === "laptop" && coreSolved < 3) {
      setToast(`노트북 접속 단서가 ${3 - coreSolved}개 더 필요합니다.`);
      return false;
    }
    if ((id === "frame" || id === "perfume") && !connected) {
      setToast("통신을 먼저 연결해야 장치가 활성화됩니다.");
      return false;
    }
    if (id === "tv" && (!connected || signalSolved < 2)) {
      setToast("TV 신호가 약합니다. 통신 연결과 신호 조정을 먼저 완료하세요.");
      return false;
    }
    if (id === "plant" && !solved.tv) {
      setToast("평범한 화분처럼 보입니다. 아직 조사할 이유가 없어요.");
      return false;
    }
    if (id === "plant" && !messageRestored) {
      setCheerAssemblyOpen(true);
      setToast("마지막 응원 통신이 아직 뒤섞여 있습니다. 조각을 먼저 복구하세요.");
      return false;
    }
    if (id === "door" && !hasKey) {
      setToast("문이 잠겨 있습니다. 방 안 어딘가에 열쇠가 있을 거예요.");
      return false;
    }
    return true;
  }

  function openHotspot(id: HotspotId) {
    const hotspot = HOTSPOTS.find((item) => item.id === id)!;
    setPlayer({ x: hotspot.x, y: Math.min(88, hotspot.y + 8) });
    if (id === "tv" && solved.tv && !messageRestored) {
      setCheerAssemblyOpen(true);
      return;
    }
    if (!canOpen(id)) return;
    if (id === "door" && hasKey) {
      if (hiddenBonusCorrectCount < HIDDEN_BONUS_QUESTIONS.length) {
        setEscapeConfirmPending(true);
      } else {
        escapeRoom();
      }
      return;
    }
    setInput("");
    setActive(id);
  }

  function escapeRoom() {
    finalizeEscape();
    setSolved((current) => ({ ...current, door: true }));
    setEscapeConfirmPending(false);
    setScreen("escaped");
  }

  function updatePlayer(event: PointerEvent<HTMLDivElement>) {
    if (!dragging || !roomRef.current) return;
    const rect = roomRef.current.getBoundingClientRect();
    const x = Math.min(96, Math.max(4, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(92, Math.max(10, ((event.clientY - rect.top) / rect.height) * 100));
    setPlayer({ x, y });
  }

  function finishDrag() {
    if (!dragging) return;
    setDragging(false);
    let nearest: (typeof HOTSPOTS)[number] | null = null;
    let distance = Number.POSITIVE_INFINITY;
    HOTSPOTS.forEach((spot) => {
      const current = Math.hypot(spot.x - player.x, spot.y - player.y);
      if (current < distance) {
        distance = current;
        nearest = spot;
      }
    });
    if (nearest && distance < 14) openHotspot((nearest as (typeof HOTSPOTS)[number]).id);
  }

  function checkTextAnswer(id: "mirror" | "magazine" | "bookcase") {
    if (solved[id]) return;
    if (!input.trim()) {
      setToast("정답을 입력한 뒤 확인해 주세요. 빈 답안은 오답으로 기록되지 않습니다.");
      return;
    }
    const answers = {
      mirror: ["아래", "아래로볼록"],
      magazine: ["이차함수"],
      bookcase: ["001.008.017.005", "1.8.17.5"],
    };
    withSubmissionLock(() => {
      bumpAttempt(id);
      if (answers[id].some((answer) => normalize(answer) === normalize(input))) {
        const messages = {
          mirror: "USERNAME 단서와 응원 조각 ‘학기’를 획득했습니다.",
          magazine: "PASSWORD 단서와 응원 조각 ‘수학’을 획득했습니다.",
          bookcase: "IP ADDRESS와 응원 조각 ‘도’를 획득했습니다.",
        };
        showAnswerFeedback("correct");
        markSolved(id, messages[id]);
      } else {
        recordWrong();
        showAnswerFeedback("wrong");
        setToast("오답으로 30점이 차감됩니다. 식과 그래프를 다시 확인해 보세요.");
      }
    });
  }

  function checkLaptop() {
    if (solved.laptop) return;
    if (laptopStage === "login") {
      if (!login.username.trim() || !login.password.trim()) {
        setToast("USERNAME과 PASSWORD를 모두 입력해 주세요. 빈 답안은 오답으로 기록되지 않습니다.");
        return;
      }
      withSubmissionLock(() => {
        bumpAttempt("laptop-login");
        const usernameHash = hashLogin(normalizeLogin(login.username));
        const passwordHash = hashLogin(normalizeLogin(login.password));
        if (usernameHash === LOGIN_HASHES.username && passwordHash === LOGIN_HASHES.password) {
          showAnswerFeedback("correct");
          setLaptopStage("ip");
          setToast("로그인 성공. 책장에서 찾은 IP 주소를 입력하세요.");
        } else {
          recordWrong();
          showAnswerFeedback("wrong");
          setToast("접속 거부로 30점이 차감됩니다. 통신 기록과 노트북 주변을 다시 관찰하세요.");
        }
      });
      return;
    }
    if (!login.ip.trim()) {
      setToast("IP 주소를 입력해 주세요. 빈 답안은 오답으로 기록되지 않습니다.");
      return;
    }
    withSubmissionLock(() => {
      bumpAttempt("laptop-ip");
      if (["001.008.017.005", "1.8.17.5"].includes(normalize(login.ip))) {
        showAnswerFeedback("correct");
        setConnected(true);
        setSolved((current) => ({ ...current, laptop: true }));
        setActive(null);
        setToast("통신 연결 성공 · 응원 조각 ‘초미녀와’를 획득하고 액자와 향수 장치가 깨어났습니다.");
      } else {
        recordWrong();
        showAnswerFeedback("wrong");
        setToast("오답으로 30점이 차감됩니다. IP 주소를 다시 계산하세요.");
      }
    });
  }

  function checkChoice(id: "frame" | "perfume" | "tv", answer: string) {
    if (solved[id]) return;
    const correct = { frame: "b", perfume: "bca", tv: "a" }[id];
    withSubmissionLock(() => {
      bumpAttempt(id);
      if (normalize(answer) !== correct) {
        recordWrong();
        showAnswerFeedback("wrong");
        setToast("오답으로 30점이 차감됩니다. 그래프의 특징을 다시 살펴보세요.");
        return;
      }
      showAnswerFeedback("correct");
      if (id === "frame") markSolved(id, "주파수 조각과 응원 조각 ‘화이팅!’을 획득했습니다.");
      if (id === "perfume") markSolved(id, "주파수 조각과 응원 조각 ‘2’를 획득했습니다.");
      if (id === "tv") {
        finalizeEscape();
        markSolved(id, "마지막 응원 조각 ‘함께’를 획득했습니다. 뒤섞인 통신을 복구하세요.");
        setCheerFeedback("idle");
        setCheerAssemblyOpen(true);
      }
    });
  }

  function addCheerFragment(id: CheerFragmentId) {
    if (messageRestored || cheerOrder.includes(id) || !collectedCheerIds.includes(id)) return;
    setCheerOrder((current) => [...current, id]);
    setCheerFeedback("idle");
  }

  function removeCheerFragment(id: CheerFragmentId) {
    if (messageRestored) return;
    setCheerOrder((current) => current.filter((fragmentId) => fragmentId !== id));
    setCheerFeedback("idle");
  }

  function checkCheerMessage() {
    if (messageRestored || cheerOrder.length !== CHEER_CORRECT_ORDER.length) {
      setCheerFeedback("wrong");
      return;
    }
    const correct = CHEER_CORRECT_ORDER.every((id, index) => cheerOrder[index] === id);
    if (!correct) {
      setCheerFeedback("wrong");
      return;
    }
    setMessageRestored(true);
    setCheerFeedback("idle");
    setToast("응원 통신 복구 완료! 수학초미녀가 화분 아래의 황금 열쇠를 알려 주었습니다.");
  }

  function takeKey() {
    if (hasKey) return;
    setHasKey(true);
    markSolved("plant", "황금 열쇠를 찾았습니다. 출구 문으로 이동하세요!");
  }

  function openHiddenBonus(id: HiddenBonusId) {
    const wasDiscovered = discoveredHiddenBonuses.includes(id);
    if (!wasDiscovered) {
      setDiscoveredHiddenBonuses((current) => [...current, id]);
      setToast("🔎 숨은 보너스 문제를 발견했다!");
    }
    setHiddenBonusActive(id);
    setHiddenBonusAnswer("");
    setHiddenBonusFeedback(hiddenBonusRecords[id]?.correct ? "correct" : "idle");
  }

  function isHiddenBonusCorrect(id: HiddenBonusId, value: string) {
    const compact = normalize(value);
    if (id === "axis") return compact === "x=3";
    if (id === "parabola") return compact === "포물선";
    if (id === "x-value") return compact === "0" || compact === "영";
    if (id === "fair-line") return compact === "대칭축";
    if (id === "x-date") return compact === "x절편";
    if (id === "interest") return ["바이브코딩", "웹페이지", "3학년12반"].some((answer) => compact.includes(answer));
    if (id === "exam") return /(?:^|\D)9(?:\D|$)/.test(value) && /(?:^|\D)11(?:\D|$)/.test(value);
    return ["수학", "ai", "gpt", "우리반"].some((answer) => compact.includes(answer));
  }

  function submitHiddenBonusAnswer(event: FormEvent) {
    event.preventDefault();
    if (!currentHiddenBonus || !hiddenBonusAnswer.trim()) return;
    const previous = hiddenBonusRecords[currentHiddenBonus.id] ?? { attempts: 0, correct: false };
    if (previous.correct) return;
    const correct = isHiddenBonusCorrect(currentHiddenBonus.id, hiddenBonusAnswer);
    const nextRecords = {
      ...hiddenBonusRecords,
      [currentHiddenBonus.id]: { attempts: previous.attempts + 1, correct },
    };
    setHiddenBonusRecords(nextRecords);
    setHiddenBonusFeedback(correct ? "correct" : "wrong");
    if (correct) {
      setHiddenBonusAnswer("");
      const nextCorrectCount = HIDDEN_BONUS_QUESTIONS.filter((question) => nextRecords[question.id]?.correct).length;
      if (nextCorrectCount === HIDDEN_BONUS_QUESTIONS.length) {
        setToast("🏆 숨겨진 보너스 문제를 모두 찾았습니다! 수학초미녀의 방을 샅샅이 뒤졌군요!");
      }
    }
  }

  function openBonusVault() {
    setBonusOpen(true);
    const firstUnresolved = BONUS_QUESTIONS.findIndex((question) => {
      const record = bonusRecords[question.id];
      return !record?.correct && (record?.attempts ?? 0) < 2;
    });
    const nextIndex = firstUnresolved >= 0 ? firstUnresolved : Math.min(bonusIndex, BONUS_QUESTIONS.length - 1);
    setBonusIndex(nextIndex);
    setBonusAnswer("");
    const record = bonusRecords[BONUS_QUESTIONS[nextIndex].id];
    setBonusFeedback(record?.correct ? "correct" : (record?.attempts ?? 0) >= 2 ? "failed" : "idle");
  }

  function moveBonusQuestion(nextIndex: number) {
    const safeIndex = Math.max(0, Math.min(BONUS_QUESTIONS.length - 1, nextIndex));
    setBonusIndex(safeIndex);
    setBonusAnswer("");
    const record = bonusRecords[BONUS_QUESTIONS[safeIndex].id];
    setBonusFeedback(record?.correct ? "correct" : (record?.attempts ?? 0) >= 2 ? "failed" : "idle");
  }

  function submitBonusAnswer(event: FormEvent | React.KeyboardEvent) {
    event.preventDefault();
    if (bonusLockRef.current || !bonusAnswer.trim()) return;
    const question = BONUS_QUESTIONS[bonusIndex];
    const previous = bonusRecords[question.id] ?? { attempts: 0, correct: false };
    if (previous.correct || previous.attempts >= 2) return;

    bonusLockRef.current = true;
    window.setTimeout(() => {
      bonusLockRef.current = false;
    }, 350);

    const correct = question.answers.some((answer) => normalize(answer) === normalize(bonusAnswer));
    const nextRecord = { attempts: previous.attempts + 1, correct };
    const nextRecords = { ...bonusRecords, [question.id]: nextRecord };
    setBonusRecords(nextRecords);
    setBonusAnswer("");

    if (correct) {
      const nextCorrectCount = BONUS_QUESTIONS.filter((item) => nextRecords[item.id]?.correct).length;
      const award = BONUS_QUESTION_SCORE + (nextCorrectCount === BONUS_QUESTIONS.length ? BONUS_COMPLETION_SCORE : 0);
      setBonusFeedback("correct");
      setBonusBurst(award);
      setScoreDelta(award);
      setScoreFlash(true);
      window.setTimeout(() => setScoreFlash(false), 650);
      window.setTimeout(() => setBonusBurst(0), 1200);
      if (submitState === "saved") setSubmitState("idle");
      return;
    }

    setBonusFeedback(nextRecord.attempts >= 2 ? "failed" : "wrong");
  }

  async function submitResult(event: FormEvent) {
    event.preventDefault();
    if (!completion) return;
    const submissionRunId = runId || window.crypto.randomUUID();
    if (!runId) setRunId(submissionRunId);
    setSubmitState("saving");
    try {
      const response = await fetch("/api/results", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...student,
          elapsedSeconds: elapsed,
          remainingSeconds: remaining,
          attempts,
          runId: submissionRunId,
          score: escapeScore,
          timeCost: timePenalty,
          wrongCount: completion.incorrectCount,
          wrongCost: incorrectPenalty,
          hintCost: hintDeduction,
          usedHints: completion.usedHints,
          bonusScore,
          bonusRecords,
          hiddenBonusRecords,
          hiddenBonusCorrectCount,
          finalScore,
          rank: `${rank.grade} — ${rank.title}`,
          reflection,
          startedAt: new Date(completion.startedAt).toISOString(),
          completedAt: new Date(completion.completedAt).toISOString(),
          messageRestored,
        }),
      });
      if (!response.ok) throw new Error("save failed");
      setSubmitState("saved");
    } catch {
      setSubmitState("error");
    }
  }

  return (
    <main className="site-main">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="topbar">
        <div className="brand-mark">M²</div>
        <div className="brand-copy">
          <strong>수학초미녀의 비밀 연구실</strong>
          <span>QUADRATIC ESCAPE LAB</span>
        </div>
        <div className="topbar-rule" />
        <div className={`score-chip ${scoreFlash ? "score-changing" : ""} ${scoreDelta > 0 ? "score-gaining" : ""}`} data-testid="score-display">
          <span>{headerScoreLabel}</span>
          <b>{headerScore.toLocaleString()}점</b>
          {scoreFlash && <i>{scoreDelta > 0 ? "+" : ""}{scoreDelta}</i>}
        </div>
        <span className="chapter">CHAPTER 03 · 이차함수</span>
      </header>

      {screen === "intro" && (
        <section className="intro-shell">
          <div className="intro-room" aria-hidden="true" />
          <div className="intro-scrim" />
          <div className="intro-card">
            <span className="eyebrow">CLASSIFIED · LEVEL 3</span>
            <h1>
              수학초미녀의
              <br />
              <em>비밀 연구실</em>
            </h1>
            <p>
              연구실의 통신이 끊기고 출구가 봉쇄되었다. 방 안의 이차함수 단서를 찾아
              노트북 통신과 흩어진 응원 메시지를 복구하고, 40분 안에 탈출하라.
            </p>
            <form className="student-form" onSubmit={beginGame}>
              <label>
                <span>반</span>
                <input
                  required
                  inputMode="numeric"
                  enterKeyHint="next"
                  onFocus={keepInputVisible}
                  placeholder="예: 3"
                  value={student.className}
                  onChange={(event) => setStudent({ ...student, className: event.target.value })}
                />
              </label>
              <label>
                <span>번호</span>
                <input
                  required
                  inputMode="numeric"
                  enterKeyHint="next"
                  onFocus={keepInputVisible}
                  placeholder="예: 12"
                  value={student.number}
                  onChange={(event) => setStudent({ ...student, number: event.target.value })}
                />
              </label>
              <label className="name-field">
                <span>이름</span>
                <input
                  required
                  enterKeyHint="done"
                  onFocus={keepInputVisible}
                  placeholder="이름 입력"
                  value={student.name}
                  onChange={(event) => setStudent({ ...student, name: event.target.value })}
                />
              </label>
              <fieldset className="character-picker">
                <legend>연구원 선택</legend>
                <label className={`character-option ${student.character === "female" ? "character-option-selected" : ""}`}>
                  <input
                    required
                    type="radio"
                    name="character"
                    value="female"
                    checked={student.character === "female"}
                    onChange={() => setStudent({ ...student, character: "female" })}
                  />
                  <img src="/researcher-female.png" alt="" aria-hidden="true" />
                  <span><b>여자 연구원</b><small>갈색머리 수학 탐정</small></span>
                </label>
                <label className={`character-option ${student.character === "male" ? "character-option-selected" : ""}`}>
                  <input
                    required
                    type="radio"
                    name="character"
                    value="male"
                    checked={student.character === "male"}
                    onChange={() => setStudent({ ...student, character: "male" })}
                  />
                  <img src="/researcher-male.png" alt="" aria-hidden="true" />
                  <span><b>남자 연구원</b><small>잘생긴 수학 탐정</small></span>
                </label>
              </fieldset>
              <button className="primary-action" type="submit">
                연구실 입장 <span>→</span>
              </button>
            </form>
            <div className="intro-meta">
              <span>◷ 제한 시간 40:00</span>
              <span>◇ 중학교 3학년</span>
              <span>⌁ 총 7개 미션</span>
            </div>
          </div>
        </section>
      )}

      {screen === "playing" && (
        <section className="game-layout">
          <div className="game-column">
            <div className="mission-bar">
              <div>
                <span className="mission-kicker">LAB EXPLORATION</span>
                <strong>탐색 기록 {solvedCount} · 응원 조각 {collectedCheerIds.length} / {CHEER_FRAGMENTS.length} · 숨은 문제 {hiddenBonusCorrectCount} / 8</strong>
              </div>
              <div className="live-scoreboard" aria-label="현재 점수 상태">
                <div><span>경과 시간</span><b data-testid="elapsed-display">{formatTime(elapsed)}</b></div>
                <div><span>{completion ? "확정 점수" : "예상 점수"}</span><b data-testid="estimated-score">{escapeScore.toLocaleString()}점</b></div>
                <div><span>오답</span><b data-testid="wrong-count">{incorrectCount}회</b></div>
                <div><span>힌트 감점</span><b data-testid="hint-deduction">-{hintDeduction}점</b></div>
              </div>
            </div>

            <div
              className="room"
              ref={roomRef}
              onPointerMove={updatePlayer}
              onPointerUp={finishDrag}
              onPointerLeave={finishDrag}
            >
              <div className="room-vignette" />
              {HOTSPOTS.map((spot) => (
                <button
                  key={spot.id}
                  className={`hotspot ${solved[spot.id] ? "hotspot-solved" : ""}`}
                  style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
                  onClick={() => openHotspot(spot.id)}
                  aria-label={`${spot.hint} 조사하기`}
                  title={spot.hint}
                >
                  <span className="hotspot-ring" />
                  <span className="hotspot-label">{solved[spot.id] ? "완료" : spot.label}</span>
                </button>
              ))}
              {HIDDEN_BONUS_QUESTIONS.map((question) => (
                <button
                  type="button"
                  key={question.id}
                  className="hidden-bonus-object"
                  style={{
                    left: `${question.x}%`,
                    top: `${question.y}%`,
                    width: `${question.width}%`,
                    height: `${question.height}%`,
                  }}
                  onClick={() => openHiddenBonus(question.id)}
                  aria-label="방 안의 물건 조사하기"
                />
              ))}
              <button
                className={`player player-${student.character || "female"} ${dragging ? "player-dragging" : ""}`}
                style={{ left: `${player.x}%`, top: `${player.y}%` }}
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId);
                  setDragging(true);
                }}
                onPointerUp={finishDrag}
                aria-label={`${student.character === "male" ? "남자" : "여자"} 연구원 캐릭터. 끌어서 이동`}
              >
                <img
                  src={`/researcher-${student.character || "female"}.png`}
                  alt=""
                  draggable={false}
                  aria-hidden="true"
                />
              </button>
              <div className="drag-tip">캐릭터를 끌거나 반짝이는 물건을 눌러 조사하세요</div>
            </div>

            <div className="toast" role="status">
              <span className="toast-icon">!</span>
              {toast}
            </div>
          </div>

          <aside className="side-panel">
            <div className="student-chip">
              <span>{student.className}반 {student.number}번</span>
              <strong>{student.name} 연구원</strong>
            </div>
            <div className="clue-vault">
              <div className="panel-heading"><span className="panel-label">CLUE VAULT · 단서함</span><b>{coreSolved + signalSolved + Number(connected)}개</b></div>
              {coreSolved + signalSolved + Number(connected) === 0 && <p className="empty-panel">아직 기록된 단서가 없습니다.</p>}
              {solved.mirror && <div className="clue found"><span>USERNAME CLUE</span><b>아래</b></div>}
              {solved.magazine && <div className="clue found"><span>PASSWORD CLUE</span><b>이차함수</b></div>}
              {solved.bookcase && <div className="clue found"><span>IP ADDRESS</span><b>001.008.017.005</b></div>}
              {connected && <div className="clue found"><span>SECURE LINK</span><b>CONNECTED</b></div>}
              {solved.frame && <div className="clue found"><span>SIGNAL FRAGMENT</span><b>PARABOLA FRAME · 01</b></div>}
              {solved.perfume && <div className="clue found"><span>SIGNAL FRAGMENT</span><b>PERFUME ARRAY · 02</b></div>}
              <div className="cheer-clue-section" data-testid="cheer-fragments">
                <div className="panel-heading"><span className="panel-label">CHEER SIGNAL · 응원 조각</span><b>{collectedCheerIds.length} / {CHEER_FRAGMENTS.length}</b></div>
                <div className="cheer-clue-grid">
                  {CHEER_SCRAMBLED_ORDER.map((id) => {
                    const fragment = CHEER_FRAGMENTS.find((item) => item.id === id)!;
                    const collected = collectedCheerIds.includes(id);
                    return <span className={collected ? "cheer-clue-found" : ""} key={id}>{collected ? fragment.text : "LOCKED"}</span>;
                  })}
                </div>
                <small>조각의 순서는 통신 장애로 뒤섞여 있습니다.</small>
              </div>
            </div>

            <div className="notepad-panel">
              <div className="panel-heading"><span className="panel-label">SCRATCH PAD · 메모장</span><b>AUTO SAVE</b></div>
              <textarea
                data-testid="notepad"
                onFocus={keepInputVisible}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="계산 과정, 좌표, 숫자를 자유롭게 적어 보세요."
                aria-label="계산 메모장"
              />
            </div>

            <div className="hint-panel" data-testid="hint-panel">
              <div className="panel-heading"><span className="panel-label">HINT CONSOLE · 힌트 보기</span><b>{hintCount}회 사용</b></div>
              {!currentHintConfig || !currentHintProblem ? (
                <p className="empty-panel">문제를 열면 그 문제의 힌트가 이곳에 나타납니다.</p>
              ) : (
                <>
                  <strong className="hint-problem-title">{currentHintConfig.title}</strong>
                  {[1, 2, 3].map((rawLevel) => {
                    const level = rawLevel as HintLevel;
                    const used = currentUsedHints.includes(level);
                    const unlocked = level === 1 || currentUsedHints.includes((level - 1) as HintLevel);
                    return (
                      <div className="hint-step" key={`${currentHintProblem}-${level}`}>
                        <button
                          type="button"
                          data-testid={`hint-${currentHintProblem}-${level}`}
                          disabled={!unlocked}
                          onClick={() => requestHint(level)}
                        >
                          {used
                            ? `${level}단계 힌트 다시 보기 (차감 없음)`
                            : `${level}단계 힌트 보기 (-${HINT_COSTS[level]}점)`}
                        </button>
                        {used && shownHintLevel === level && (
                          <p className="hint-text" data-testid={`hint-text-${currentHintProblem}-${level}`}>
                            {currentHintConfig.hints[level - 1]}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
            <button className="reset-button" type="button" onClick={requestReset} data-testid="reset-game">게임 처음부터</button>
          </aside>
        </section>
      )}

      {screen === "playing" && currentHiddenBonus && (
        <div className="modal-backdrop" onMouseDown={() => setHiddenBonusActive(null)}>
          <section className="puzzle-modal hidden-bonus-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="hidden-bonus-title">
            <button className="modal-close" type="button" onClick={() => setHiddenBonusActive(null)} aria-label="닫기">×</button>
            <span className="puzzle-eyebrow">숨은 보너스 문제</span>
            <h3 id="hidden-bonus-title">방 안에서 발견한 수학 단서</h3>
            {currentHiddenBonus.initials && <div className="initials-clue">힌트 · {currentHiddenBonus.initials}</div>}
            <p className="hidden-bonus-question">{currentHiddenBonus.question}</p>
            <form className="bonus-answer-form" onSubmit={submitHiddenBonusAnswer}>
              <label>
                <span>정답</span>
                <input
                  value={hiddenBonusAnswer}
                  onChange={(event) => {
                    setHiddenBonusAnswer(event.target.value);
                    if (hiddenBonusFeedback === "wrong") setHiddenBonusFeedback("idle");
                  }}
                  onFocus={keepInputVisible}
                  placeholder={hiddenBonusRecords[currentHiddenBonus.id]?.correct ? "이미 해결한 문제입니다" : "정답 입력"}
                  disabled={hiddenBonusRecords[currentHiddenBonus.id]?.correct}
                />
              </label>
              <button type="submit" className="modal-action" disabled={!hiddenBonusAnswer.trim() || hiddenBonusRecords[currentHiddenBonus.id]?.correct}>정답 확인</button>
            </form>
            {hiddenBonusFeedback === "correct" && (
              <div className="bonus-feedback correct" role="status">
                <b>{currentHiddenBonus.successMessage ?? "정답입니다! 숨은 보너스 문제를 해결했어요."}</b>
                <span>숨은 문제 {hiddenBonusCorrectCount} / 8 완료</span>
              </div>
            )}
            {hiddenBonusFeedback === "wrong" && (
              <div className="bonus-feedback wrong" role="status">
                <b>아직 정답이 아니에요.</b><span>다시 생각해 보세요. 오답 감점은 없습니다.</span>
              </div>
            )}
          </section>
        </div>
      )}

      {active && (
        <div className="modal-backdrop" onMouseDown={() => setActive(null)}>
          <section
            className={`puzzle-modal ${["mirror", "magazine", "bookcase"].includes(active) ? "puzzle-modal-input" : ""} ${active === "laptop" ? "puzzle-modal-laptop" : ""}`}
            onMouseDown={(event) => event.stopPropagation()}
            aria-modal="true"
            role="dialog"
          >
            <button className="modal-close" onClick={() => setActive(null)} aria-label="문제 닫기">×</button>
            <PuzzleContent
              id={active}
              input={input}
              setInput={setInput}
              solved={solved}
              login={login}
              setLogin={setLogin}
              laptopStage={laptopStage}
              checkTextAnswer={checkTextAnswer}
              checkLaptop={checkLaptop}
              checkChoice={checkChoice}
              takeKey={takeKey}
            />
          </section>
        </div>
      )}

      {cheerAssemblyOpen && (
        <div className="cheer-backdrop" role="presentation">
          <section className={`cheer-console ${messageRestored ? "cheer-console-restored" : ""}`} role="dialog" aria-modal="true" aria-labelledby="cheer-console-title">
            {!messageRestored ? (
              <>
                <button className="modal-close" type="button" onClick={() => setCheerAssemblyOpen(false)} aria-label="응원 통신 닫기">×</button>
                <span className="puzzle-eyebrow">FINAL CHEER TRANSMISSION</span>
                <h2 id="cheer-console-title">2학기 응원 통신 복구</h2>
                <p>찾아낸 조각을 문장이 되도록 순서대로 눌러 주세요. 이미 놓은 조각을 누르면 다시 뺄 수 있습니다.</p>

                <div className="cheer-message-slots" aria-label="배열한 응원 문장" data-testid="cheer-order">
                  {CHEER_CORRECT_ORDER.map((_, index) => {
                    const selectedId = cheerOrder[index];
                    const fragment = selectedId ? CHEER_FRAGMENTS.find((item) => item.id === selectedId) : null;
                    return fragment ? (
                      <button type="button" key={`${fragment.id}-${index}`} onClick={() => removeCheerFragment(fragment.id)}>{fragment.text}</button>
                    ) : <span key={`empty-${index}`}>{index + 1}</span>;
                  })}
                </div>

                <div className="cheer-piece-bank" aria-label="발견한 응원 조각">
                  {CHEER_SCRAMBLED_ORDER.map((id) => {
                    const fragment = CHEER_FRAGMENTS.find((item) => item.id === id)!;
                    const selected = cheerOrder.includes(id);
                    return (
                      <button
                        type="button"
                        key={id}
                        disabled={selected || !collectedCheerIds.includes(id)}
                        onClick={() => addCheerFragment(id)}
                      >{collectedCheerIds.includes(id) ? fragment.text : "신호 없음"}</button>
                    );
                  })}
                </div>

                {cheerFeedback === "wrong" && (
                  <p className="cheer-feedback" role="status">아직 문장이 완성되지 않았습니다. 자연스러운 응원 문장이 되도록 순서를 다시 살펴보세요.</p>
                )}
                <div className="cheer-actions">
                  <button type="button" onClick={() => { setCheerOrder([]); setCheerFeedback("idle"); }}>처음부터 배열</button>
                  <button type="button" className="modal-action" onClick={checkCheerMessage} disabled={cheerOrder.length !== CHEER_CORRECT_ORDER.length}>통신 메시지 복구</button>
                </div>
              </>
            ) : (
              <div className="math-beauty-transmission" data-testid="math-beauty-reveal">
                <div className="transmission-scan" aria-hidden="true" />
                <div className="math-beauty-portrait">
                  <img src="/mathchominyu.png" alt="응원하며 등장한 수학초미녀" />
                </div>
                <div className="transmission-copy">
                  <span className="puzzle-eyebrow">TRANSMISSION RESTORED · 100%</span>
                  <h2 id="cheer-console-title">응원 통신 복구 완료!</h2>
                  <strong>“수학초미녀와 함께 2학기도 화이팅!”</strong>
                  <p>{student.name} 연구원, 모든 조각을 정확히 복구했어요. 황금 열쇠는 화분 아래에 숨겨 두었답니다!</p>
                  <button type="button" className="modal-action" onClick={() => setCheerAssemblyOpen(false)}>화분을 확인하러 가기 →</button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {answerFeedback && (
        <div
          className={`answer-feedback answer-feedback-${answerFeedback}`}
          role="status"
          aria-live="assertive"
          data-testid="answer-feedback"
        >
          <span aria-hidden="true">{answerFeedback === "correct" ? "✓" : "×"}</span>
          <strong>{answerFeedback === "correct" ? "정답입니다" : "오답입니다"}</strong>
        </div>
      )}

      {pendingHint && (
        <div className="confirm-backdrop">
          <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="hint-confirm-title">
            <span className="puzzle-eyebrow">SCORE CHECK</span>
            <h3 id="hint-confirm-title">힌트를 사용하시겠습니까?</h3>
            <p>이 힌트를 사용하면 {pendingHint.cost}점이 차감됩니다. 확인하시겠습니까?</p>
            <div className="confirm-actions">
              <button type="button" onClick={() => setPendingHint(null)}>취소</button>
              <button type="button" className="confirm-use" onClick={confirmHintUse} data-testid="confirm-hint-use">확인</button>
            </div>
          </section>
        </div>
      )}

      {resetPending && (
        <div className="confirm-backdrop">
          <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="reset-confirm-title">
            <span className="puzzle-eyebrow">RESET GAME</span>
            <h3 id="reset-confirm-title">게임을 처음부터 시작할까요?</h3>
            <p>시간, 오답, 힌트, 응원 통신, 보너스 금고 기록과 메모장 내용이 모두 초기화됩니다.</p>
            <div className="confirm-actions">
              <button type="button" onClick={() => setResetPending(false)}>취소</button>
              <button type="button" className="confirm-use" onClick={confirmReset} data-testid="confirm-reset">초기화</button>
            </div>
          </section>
        </div>
      )}

      {escapeConfirmPending && (
        <div className="confirm-backdrop">
          <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="escape-confirm-title">
            <span className="puzzle-eyebrow">EXIT CHECK</span>
            <h3 id="escape-confirm-title">정말 방을 탈출하시겠습니까?</h3>
            <p>아직 풀지 않은 숨은 보너스 문제가 {HIDDEN_BONUS_QUESTIONS.length - hiddenBonusCorrectCount}개 남아 있습니다.</p>
            <div className="confirm-actions">
              <button type="button" onClick={() => setEscapeConfirmPending(false)}>아니오</button>
              <button type="button" className="confirm-use" onClick={escapeRoom}>네</button>
            </div>
          </section>
        </div>
      )}

      {screen === "escaped" && (
        <section className="finish-screen">
          <div className="finish-glow" />
          <div className="finish-card">
            <div className="success-seal">M²</div>
            <span className="eyebrow">MISSION COMPLETE</span>
            <h2>연구실 탈출 성공!</h2>
            <p>{student.name} 연구원이 모든 통신을 복구하고 황금 열쇠로 연구실을 탈출했습니다.</p>
            {messageRestored && (
              <div className="finish-cheer-card">
                <img src="/mathchominyu.png" alt="수학초미녀" />
                <div><span>CHEER TRANSMISSION RESTORED</span><strong>수학초미녀와 함께 2학기도 화이팅!</strong></div>
              </div>
            )}
            <div className="rank-banner" data-testid="final-rank">
              <span>{rank.grade}</span>
              <div><b>{rank.title}</b><small>점수와 관계없이 연구실 탈출에 성공했습니다!</small></div>
            </div>

            <div className="score-breakdown" data-testid="score-breakdown">
              <div><span>시작 점수</span><b>{START_SCORE.toLocaleString()}점</b></div>
              <div><span>경과 시간</span><b>{formatTime(elapsed)}</b></div>
              <div><span>시간 감점</span><b>-{timePenalty.toLocaleString()}점</b></div>
              <div><span>오답 횟수</span><b>{completion?.incorrectCount ?? incorrectCount}회</b></div>
              <div><span>오답 감점</span><b>-{incorrectPenalty.toLocaleString()}점</b></div>
              <div><span>힌트 감점</span><b>-{hintDeduction.toLocaleString()}점</b></div>
              <div className="breakdown-subtotal"><span>방탈출 확정 점수</span><b data-testid="escape-final-score">{escapeScore.toLocaleString()}점</b></div>
              <div><span>보너스 금고 점수</span><b className="positive" data-testid="bonus-score">+{bonusScore.toLocaleString()}점</b></div>
              <div className="breakdown-total"><span>최종 점수</span><b data-testid="grand-total">{finalScore.toLocaleString()}점</b></div>
            </div>

            <section className={`bonus-vault-card ${bonusOpen ? "bonus-vault-open" : ""} ${allBonusCorrect ? "bonus-vault-complete" : ""}`} data-testid="bonus-vault">
              {!bonusOpen ? (
                <button type="button" className="vault-cover" onClick={openBonusVault} data-testid="open-bonus-vault">
                  <span className="vault-icon" aria-hidden="true"><i>×</i></span>
                  <span className="puzzle-eyebrow">2학기 수학 보너스 금고</span>
                  <strong>수학 기억 보너스 금고</strong>
                  <small>1·2학년 수학 기억을 되살려 최대 200점을 획득하세요!</small>
                  <b>선택 도전하기 →</b>
                </button>
              ) : (
                <div className="vault-inside">
                  <div className="vault-progress-head">
                    <div><span className="puzzle-eyebrow">MATH MEMORY VAULT</span><strong>수학 기억 보너스 금고</strong></div>
                    <b data-testid="bonus-progress">{bonusIndex + 1} / {BONUS_QUESTIONS.length}</b>
                  </div>
                  <div className="vault-locks" aria-label={`${bonusCorrectCount}개의 자물쇠 해제`}>
                    {BONUS_QUESTIONS.map((question, index) => (
                      <button
                        type="button"
                        key={question.id}
                        className={bonusRecords[question.id]?.correct ? "lock-open" : (bonusRecords[question.id]?.attempts ?? 0) >= 2 ? "lock-failed" : ""}
                        onClick={() => moveBonusQuestion(index)}
                        aria-label={`${index + 1}번 문제`}
                      >{bonusRecords[question.id]?.correct ? "✓" : index + 1}</button>
                    ))}
                  </div>

                  {allBonusCorrect && (
                    <div className="bonus-badge" data-testid="bonus-badge">
                      <span>◆</span><div><b>수학 기억 탐험가</b><small>6문제 완주 보너스 +20점 획득!</small></div>
                    </div>
                  )}

                  <div className="bonus-question-card">
                    <div className="bonus-question-meta"><span>QUESTION {bonusIndex + 1}</span><b>{currentBonusQuestion.future}</b></div>
                    {currentBonusQuestion.initials && <div className="initials-clue">초성 · {currentBonusQuestion.initials}</div>}
                    <p>{currentBonusQuestion.question}</p>

                    <form
                      onSubmit={submitBonusAnswer}
                      className="bonus-answer-form"
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.nativeEvent.isComposing) submitBonusAnswer(event);
                      }}
                    >
                      <label>
                        <span>정답 · 남은 기회 {bonusRemainingAttempts}회</span>
                        <input
                          data-testid="bonus-answer"
                          onFocus={keepInputVisible}
                          value={bonusAnswer}
                          onChange={(event) => {
                            setBonusAnswer(event.target.value);
                            if (bonusFeedback === "wrong") setBonusFeedback("idle");
                          }}
                          placeholder={currentBonusRecord.correct || currentBonusRecord.attempts >= 2 ? "이 문제는 완료되었습니다" : "정답 입력"}
                          disabled={currentBonusRecord.correct || currentBonusRecord.attempts >= 2}
                          aria-label="보너스 퀴즈 정답"
                        />
                      </label>
                      <button
                        type="submit"
                        className="modal-action"
                        data-testid="submit-bonus-answer"
                        disabled={!bonusAnswer.trim() || currentBonusRecord.correct || currentBonusRecord.attempts >= 2}
                      >정답 제출</button>
                    </form>

                    {bonusFeedback === "correct" && (
                      <div className="bonus-feedback correct" role="status" data-testid="bonus-correct">
                        <b>정답입니다! +30점</b><span>{currentBonusQuestion.concept}</span>
                      </div>
                    )}
                    {bonusFeedback === "wrong" && (
                      <div className="bonus-feedback wrong" role="status" data-testid="bonus-wrong">
                        <b>한 번 더 생각해 보세요.</b><span>남은 기회 {bonusRemainingAttempts}회</span>
                      </div>
                    )}
                    {bonusFeedback === "failed" && (
                      <div className="bonus-feedback failed" role="status" data-testid="bonus-failed">
                        <b>정답 · {currentBonusQuestion.answerLabel}</b><span>{currentBonusQuestion.concept}</span>
                      </div>
                    )}
                    {bonusBurst > 0 && <span className="bonus-burst" aria-hidden="true">+{bonusBurst}</span>}
                  </div>

                  <div className="bonus-nav">
                    <button type="button" onClick={() => moveBonusQuestion(bonusIndex - 1)} disabled={bonusIndex === 0}>← 이전</button>
                    <span>{bonusResolvedCount} / 6 완료 · 현재 +{bonusScore}점</span>
                    <button type="button" onClick={() => moveBonusQuestion(bonusIndex + 1)} disabled={bonusIndex === BONUS_QUESTIONS.length - 1}>다음 →</button>
                  </div>
                </div>
              )}
            </section>

            <p className="result-detail">힌트 {hintCount}개 사용 · 방탈출 점수는 마지막 정답 순간 확정되며 보너스 점수만 추가됩니다.</p>
            <form className="reflection-form" onSubmit={submitResult}>
              <label>
                <span>오늘 방탈출에서 가장 인상 깊었던 단서는?</span>
                <textarea
                  required
                  onFocus={keepInputVisible}
                  value={reflection}
                  onChange={(event) => setReflection(event.target.value)}
                  placeholder="수학 문제를 암호로 활용한 과정을 적어 보세요."
                />
              </label>
              <button className="primary-action" disabled={submitState === "saving" || submitState === "saved"}>
                {submitState === "saving" && "결과 저장 중…"}
                {submitState === "saved" && "제출 완료 ✓"}
                {(submitState === "idle" || submitState === "error") && "선생님께 결과 제출"}
              </button>
              {submitState === "error" && <p className="form-error">저장 연결을 확인한 뒤 다시 눌러 주세요.</p>}
            </form>
            <button type="button" className="reset-button finish-reset" onClick={requestReset}>새 게임 시작</button>
          </div>
        </section>
      )}
    </main>
  );
}

type PuzzleProps = {
  id: HotspotId;
  input: string;
  setInput: (value: string) => void;
  solved: Record<HotspotId, boolean>;
  login: { username: string; password: string; ip: string };
  setLogin: (value: { username: string; password: string; ip: string }) => void;
  laptopStage: "login" | "ip";
  checkTextAnswer: (id: "mirror" | "magazine" | "bookcase") => void;
  checkLaptop: () => void;
  checkChoice: (id: "frame" | "perfume" | "tv", answer: string) => void;
  takeKey: () => void;
};

function PuzzleContent(props: PuzzleProps) {
  const { id, input, setInput, login, setLogin, laptopStage } = props;
  if (id === "mirror") {
    return <TextPuzzle eyebrow="VANITY MIRROR · USERNAME CLUE" title="거울에 남은 문장" input={input} setInput={setInput} onSubmit={() => props.checkTextAnswer("mirror")}>
      <p><strong>y = ax²</strong>에서 <strong>a &gt; 0</strong>일 때, 그래프는 어느 방향으로 볼록할까?</p>
      <div className="formula-card">a &gt; 0　→　<span>○○</span>로 볼록</div>
      <small>두 글자로 입력하세요. 정답은 노트북 USERNAME의 재료가 됩니다.</small>
    </TextPuzzle>;
  }
  if (id === "magazine") {
    return <TextPuzzle eyebrow="MAGAZINE · PASSWORD CLUE" title="잡지 속 네 글자" input={input} setInput={setInput} onSubmit={() => props.checkTextAnswer("magazine")}>
      <p>y가 x에 대한 이차식으로 나타내어질 때, 함수 <strong>y=f(x)</strong>를 x에 대한 무엇이라고 할까?</p>
      <div className="formula-card">y = ax² + bx + c　→　<span>○○○○</span></div>
      <small>정답은 노트북 PASSWORD의 재료가 됩니다.</small>
    </TextPuzzle>;
  }
  if (id === "bookcase") {
    return <TextPuzzle eyebrow="BOOKCASE · IP ADDRESS" title="연구 서적의 IP 암호" input={input} setInput={setInput} onSubmit={() => props.checkTextAnswer("bookcase")}>
      <p>이차함수 <strong>y=ax²+bx+c</strong>의 꼭짓점이 <strong>(-4, 1)</strong>이고 점 <strong>(-2, 5)</strong>를 지난다.</p>
      <ol className="math-steps">
        <li>a의 값</li><li>b의 값</li><li>c의 값</li><li>y=x²에서 y=(x-5)²로 x축 방향으로 평행이동한 값</li>
      </ol>
      <div className="formula-card">각 답을 세 자리로 → <span>AAA.BBB.CCC.DDD</span></div>
      <small>예: 답이 1이면 001로 입력하세요.</small>
    </TextPuzzle>;
  }
  if (id === "laptop") {
    return <form
      className="puzzle-content laptop-puzzle"
      onSubmit={(event) => { event.preventDefault(); props.checkLaptop(); }}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !event.nativeEvent.isComposing) {
          event.preventDefault();
          props.checkLaptop();
        }
      }}
    >
      <span className="puzzle-eyebrow">SECURE TERMINAL · {laptopStage === "login" ? "LOGIN" : "NETWORK"}</span>
      <h3>{laptopStage === "login" ? "통신 노트북 로그인" : "연구실 IP 연결"}</h3>
      {laptopStage === "login" ? <>
        <div className="terminal-clue" data-testid="laptop-indirect-clue">
          <p>통신 기록에 알 수 없는 메모가 남아 있다.</p>
          <strong>글자는 달라도 손가락은 같은 자리를 기억한다.</strong>
        </div>
        <div className="keyboard-visual" aria-label="한글과 영문이 함께 표시된 키보드">
          {KEYBOARD_ROWS.map((row, rowIndex) => (
            <div className="keyboard-row" key={rowIndex}>
              {row.map(([english, korean]) => (
                <span className={`keyboard-key${WORN_KEYS.has(english) ? " keyboard-key-worn" : ""}`} key={english}>
                  <b>{english}</b><small>{korean}</small>
                </span>
              ))}
            </div>
          ))}
        </div>
        <p className="keyboard-note">언어가 바뀌어도 자리는 변하지 않는다</p>
        <p className="keyboard-focus-note">자판 단서를 다시 보려면 화면 키보드를 잠시 내려보세요.</p>
        <label className="terminal-field">
          <span className="terminal-field-title">USERNAME <i>EN</i></span>
          <input
            value={login.username}
            onChange={(e) => setLogin({ ...login, username: e.target.value })}
            onFocus={keepInputVisible}
            placeholder="접속 코드 입력"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
          />
        </label>
        <label className="terminal-field">
          <span className="terminal-field-title">PASSWORD <i>EN</i></span>
          <input
            type="password"
            value={login.password}
            onChange={(e) => setLogin({ ...login, password: e.target.value })}
            onFocus={keepInputVisible}
            placeholder="접속 코드 입력"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
          />
        </label>
      </> : <>
        <p>책장에서 계산한 네 숫자를 세 자리씩 입력하세요.</p>
        <label><span>IP ADDRESS</span><input value={login.ip} onChange={(e) => setLogin({ ...login, ip: e.target.value })} onFocus={keepInputVisible} enterKeyHint="go" placeholder="000.000.000.000" /></label>
      </>}
      <button type="submit" className="modal-action">{laptopStage === "login" ? "LOGIN" : "CONNECT"}</button>
    </form>;
  }
  if (id === "frame") {
    return <ChoicePuzzle eyebrow="PARABOLA FRAME · SIGNAL 01" title="액자 속 사라진 그래프" description="꼭짓점이 (-2, 3)이고 위로 볼록한 포물선의 식을 고르세요." choices={[
      ["a", "y=(x-2)²+3"], ["b", "y=-(x+2)²+3"], ["c", "y=-(x-2)²-3"], ["d", "y=(x+2)²-3"],
    ]} onChoice={(value) => props.checkChoice("frame", value)} />;
  }
  if (id === "perfume") {
    return <ChoicePuzzle eyebrow="PERFUME ARRAY · SIGNAL 02" title="향수병의 포물선 농도" description="그래프의 폭이 좁은 것부터 넓은 순서로 향수병을 배열하세요." choices={[
      ["bca", "B → C → A"], ["abc", "A → B → C"], ["cab", "C → A → B"], ["bac", "B → A → C"],
    ]} note="A: y=½x²　B: y=-3x²　C: y=x²" onChoice={(value) => props.checkChoice("perfume", value)} />;
  }
  if (id === "tv") {
    return <ChoicePuzzle eyebrow="FINAL TRANSMISSION · TV" title="마지막 통신 좌표" description="꼭짓점이 (2, -3)이고 점 (0, 5)를 지나는 이차함수의 식을 고르세요." choices={[
      ["a", "y=2(x-2)²-3"], ["b", "y=(x+2)²-3"], ["c", "y=2(x+2)²+3"], ["d", "y=-2(x-2)²-3"],
    ]} onChoice={(value) => props.checkChoice("tv", value)} />;
  }
  if (id === "plant") {
    return <div className="puzzle-content key-puzzle">
      <span className="puzzle-eyebrow">HIDDEN OBJECT</span><h3>화분 아래의 비밀</h3>
      <div className="key-visual">⌁</div>
      <p>무거운 화분을 옮기자 포물선 문양이 새겨진 황금 열쇠가 나타났다.</p>
      <button className="modal-action" onClick={props.takeKey}>열쇠 집기</button>
    </div>;
  }
  return null;
}

function TextPuzzle({ eyebrow, title, children, input, setInput, onSubmit }: { eyebrow: string; title: string; children: React.ReactNode; input: string; setInput: (value: string) => void; onSubmit: () => void }) {
  return <form className="puzzle-content text-puzzle" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
    <div className="puzzle-copy"><span className="puzzle-eyebrow">{eyebrow}</span><h3>{title}</h3>{children}</div>
    <div className="answer-dock">
      <label className="answer-field"><span>ANSWER</span><input
        value={input}
        onFocus={keepInputVisible}
        onChange={(event) => setInput(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.nativeEvent.isComposing) {
            event.preventDefault();
            if (input.trim()) onSubmit();
          }
        }}
        placeholder="정답 입력"
      /></label>
      <button className="modal-action" disabled={!input.trim()}>정답 확인</button>
    </div>
  </form>;
}

function ChoicePuzzle({ eyebrow, title, description, choices, note, onChoice }: { eyebrow: string; title: string; description: string; choices: string[][]; note?: string; onChoice: (value: string) => void }) {
  return <div className="puzzle-content"><span className="puzzle-eyebrow">{eyebrow}</span><h3>{title}</h3><p>{description}</p>{note && <div className="formula-card">{note}</div>}<div className="choice-grid">{choices.map(([value, label]) => <button type="button" key={value} onClick={() => onChoice(value)}><span>{value.toUpperCase()}</span>{label}</button>)}</div></div>;
}

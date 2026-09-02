# 수학초미녀의 비밀 연구실

중학교 3학년 이차함수를 활용한 태블릿용 방탈출 수업 사이트입니다. 문제 풀이, 단계별 힌트와 감점, 실시간 타이머, 보너스 금고, 최종 점수와 학생 소감 수합 기능을 포함합니다.

## 다른 선생님에게 전달하기

이 저장소를 복제하거나 포크하면 각자의 GitHub 계정에서 문제와 디자인을 수정할 수 있습니다. 학생 결과는 각자의 Supabase 프로젝트에 저장할 수 있도록 설정 파일과 테이블 생성 SQL을 함께 제공합니다.

전체 전달 절차는 [다른 선생님용 설치 안내](docs/HANDOFF-KO.md)를 따라 주세요.

## 내 Supabase 연결하기

1. Supabase 프로젝트의 **SQL Editor**에서 [`supabase/schema.sql`](supabase/schema.sql)을 실행합니다.
2. 배포 환경에 아래 세 값을 등록합니다.
   - `SUPABASE_URL`: 프로젝트 주소
   - `SUPABASE_SECRET_KEY`: 서버 전용 비밀키(`sb_secret_...`)
   - `RESULTS_STORAGE`: `supabase`
   - `TEACHER_PIN`: 교사용 대시보드 접속 비밀번호
3. 사이트에서 테스트 결과를 한 번 제출하고 Supabase의 **Table Editor > escape_results**에서 저장 여부를 확인합니다.

실제 비밀키는 채팅, 소스 코드, `.env.example`, GitHub에 입력하지 마세요. 브라우저에는 비밀키가 노출되지 않으며, 결과는 서버의 `/api/results`를 거쳐 저장됩니다.

## 교사용 대시보드와 전체 공지

- 주소: 배포된 학생 사이트 주소 뒤에 `/teacher`를 붙입니다.
- 학생별 결과, 문제별 1회 정답률, 숨은 보너스 발견률과 CSV 다운로드를 제공합니다.
- **10분 남았습니다! 표시**를 누르면 접속 중인 학생 화면에 큰 알림이 나타나고, 이후 상단 배너로 유지됩니다.
- 학생 화면은 5초마다 공지를 확인하므로 전송 후 최대 5초 안에 표시됩니다.
- 교사용 화면을 사용하려면 배포 환경에 `TEACHER_PIN`을 반드시 등록해야 합니다.

## 저장 모드

- `supabase`: Supabase에만 저장
- `dual`: Supabase와 기존 Sites D1에 함께 저장(이관 확인용)
- `d1`: 기존 Sites D1에만 저장
- 미설정: Supabase 설정이 있으면 Supabase, 없으면 기존 D1을 자동 사용

## 로컬 실행

Node.js 22.13 이상이 필요합니다.

```bash
npm install
npm run dev
npm run build
```

로컬에서 연결을 시험할 때는 `.env.example`을 참고해 `.env.local`을 만들되, 실제 비밀키가 Git에 포함되지 않았는지 반드시 확인하세요.

## 주요 폴더

- `app/`: 게임 화면과 결과 저장 API
- `public/`: 캐릭터와 화면 이미지
- `supabase/schema.sql`: 학생 결과 테이블 생성 SQL
- `.openai/hosting.template.json`: 새 Sites 프로젝트용 설정 원본
- `docs/HANDOFF-KO.md`: 계정별 복제·배포·Supabase 연결 안내

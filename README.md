# FluentCam Academy Pro — 초등·주니어 AI 원어민 화상영어 플랫폼

Google **Gemini Live API**와 오픈소스 **3D 실시간 립싱크 아바타(`TalkingHead` + `HeadAudio`)**, **FSRS 간격반복 알고리즘**, **실시간 교실 제어(Tool Calling)**를 결합해 별도 백엔드 서버 없이 브라우저에서 전문 화상영어 업체 수준의 수업을 진행할 수 있는 개인·가족용 웹앱입니다.

## 주요 기능

1. **오픈소스 3D 실시간 립싱크 아바타 (`TalkingHead` + `HeadAudio`, MIT)**
   - 추가 영상 API 비용 없이 WebGL 3D 튜터가 Gemini Live 음성에 맞춰 실시간 입 모양(Oculus Visemes)·눈맞춤·손 제스처로 반응합니다.
   - `3D 실시간 립싱크` ↔ `실사 스튜디오` 화면을 수업 중에도 전환할 수 있습니다.
2. **치팅 없는 순수 화상 몰입 교실 & PIN 보호 부모 관리 (`기본 비밀번호: 0000`)**
   - 아이 화면은 이름 선택 → 원클릭 수업 시작만 남기고, 모든 교육 설정(수준·교재·자막 ON/OFF·선생님 속도·잡음 차단·API 키)은 4자리 PIN으로 보호된 `부모 관리`로 분리했습니다.
   - 수업 중 표현 힌트·문장 해석·채팅 입력·실시간 스크립트를 완전히 제거해 오롯이 원어민과 듣고 말하기에 집중합니다. (전체 대화 스크립트와 교정 리포트는 수업 종료 후 자동 생성됩니다.)
3. **스마트 잡음 차단 + ESL 말하기 유도 + 자동 속도 조절 (`adjust_speaking_pace`)**
   - 120Hz 하이패스 필터 + 적응형 소음 기준선 + 선생님 발화 중 에코 가드 + 눌러서 말하기(Push-to-Talk)로 생활 소음 오작동을 방지합니다.
   - 70/30 발화 비율 원칙으로 단답형 답변을 완전한 문장으로 확장 유도하며, 아이가 "좀 빨라요 / Slower please"라고 말하면 선생님이 즉시 말하기 속도를 천천히 조절합니다.
4. **초3 12권 · 초6 12권(총 24권, 96쪽) 정규 교재 + ✨ AI 4쪽 교재 무한 생성**
   - 매일 20분씩 꾸준히 학습해도 부족하지 않도록 학년별 12권(각 4쪽) 커리큘럼을 기본 내장했습니다.
   - 부모 관리에서 원하는 주제만 입력하면 초3/초6 수준에 맞춘 **4쪽 정규 교재(단어·본문·질문·역할극/토론)**를 AI가 즉시 생성해 영구 저장할 수 있습니다.
   - 교재 위에 **펜·형광펜·지우개**로 표시하거나 그림을 그려 `선생님께 전송`할 수 있습니다.
5. **5분 AI CEFR 레벨 테스트 & FSRS 간격반복 복습·쉐도잉 & 학부모 대시보드**
   - 레벨 진단, 망각 곡선(FSRS) 복습 단어장, 원어민 발음 녹음 비교, 자녀별 발화 비율·성장 그래프·커리큘럼 진도표를 제공합니다.
6. **GitHub 비공개 저장소 자동 클라우드 동기화 (AES-256-GCM 암호화)**
   - 별도 서버 없이 개인 **비공개(Private) GitHub 저장소**(`family-sync.json`)에 초3·초6 설정, AI 교재, 수업 노트, FSRS 복습장, 암호화된 Gemini API 키를 자동 동기화합니다.
   - 공개(Public) 저장소 업로드는 원천 차단하며, 여러 기기 동시 수정 시 수업 기록·별 보상·복습 카드를 손실 없이 스마트 병합합니다.

## 실행 방법 (내 PC)

외부 패키지 설치(`npm install`) 없이 Node.js만 있으면 바로 실행됩니다.

```bash
cd ai-video-english
npm start
```

브라우저에서 `http://localhost:3000`을 연 뒤 [Google AI Studio](https://aistudio.google.com/apikey)에서 발급받은 **Gemini API 키**를 입력해 시작하세요. (정적 파일 구성이므로 **GitHub Pages**에 그대로 올려 노트북·태블릿에서 `https://` 주소로 바로 열 수도 있습니다.)

## 활용 오픈소스 (MIT License)

- [met4citizen/TalkingHead](https://github.com/met4citizen/TalkingHead) — 3D WebGL Talking Avatar
- [met4citizen/HeadAudio](https://github.com/met4citizen/HeadAudio) — In-browser Audio-Driven Real-Time Lip-Sync Worklet & Sample GLB Avatars
- FSRS (Free Spaced Repetition Scheduler) algorithm

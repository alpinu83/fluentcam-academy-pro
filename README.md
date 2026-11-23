# FluentCam Academy Pro — 초등·주니어 AI 원어민 화상영어 플랫폼

Google **Gemini Live API**와 오픈소스 **3D 실시간 립싱크 아바타(`TalkingHead` + `HeadAudio`)**, **FSRS 간격반복 알고리즘**, **실시간 교실 제어(Tool Calling)**를 결합해 별도 백엔드 서버 없이 브라우저에서 전문 화상영어 업체 수준의 수업을 진행할 수 있는 개인·가족용 웹앱입니다.

## 주요 기능

1. **오픈소스 3D 실시간 립싱크 아바타 (`TalkingHead` + `HeadAudio`, MIT)**
   - 추가 영상 API 비용 없이 WebGL 3D 튜터가 Gemini Live 음성에 맞춰 실시간 입 모양(Oculus Visemes)·눈맞춤·손 제스처로 반응합니다.
   - `3D 실시간 립싱크` ↔ `실사 스튜디오` 화면을 수업 중에도 원클릭 전환할 수 있습니다.
2. **AI 선생님 실시간 교실 제어 (Gemini Live Native Tool Calling)**
   - `turn_textbook_page`: 선생님이 말하면서 교재를 자동으로 다음 쪽으로 넘김
   - `award_gold_star`: 좋은 문장을 말하면 차임벨과 함께 골드 스타 보상 팝업 + 3D 아바타 엄지척
   - `write_on_whiteboard`: 교정 문장·핵심 표현을 실시간 교실 칠판에 판서 (자동으로 복습 단어장에 등록)
   - `show_pop_quiz`: 수업 중 3지선다 미니 퀴즈 카드를 화면에 띄워 즉시 풀이
3. **초3 · 초6 맞춤 커리큘럼 교재 6권 + 교재 위 펜 판서 (화이트보드)**
   - 초3 추천 3권 + 초6 추천 3권(각 4쪽 구성) + `내 교재 붙여넣기` 지원
   - 교재 위에 **펜·형광펜·지우개**로 표시하거나 그림을 그려 `선생님께 전송`하면 AI 선생님이 직접 보고 반응합니다.
4. **5분 AI CEFR 레벨 테스트**
   - 듣기·그림 묘사·의견 말하기(음성/텍스트)를 분석해 CEFR 등급(`A1+`~`B2`)과 추천 레벨·교재를 원클릭 적용합니다.
5. **FSRS 간격반복 복습 단어장 & 발음 쉐도잉**
   - 수업 중 교정 문장과 새 단어가 자동 등록되며, 망각 곡선(FSRS)에 맞춰 복습 주기를 계산합니다.
   - 원어민 발음(`1.0x` / `0.75x`) 듣기와 내 발음 녹음·비교 듣기를 지원합니다.
6. **학부모 대시보드**
   - 초3·초6 자녀별 누적 수업 횟수, 누적 시간, **평균 학생 발화 비율(%)**, 골드 스타·연속 출석 스트릭, 영역별 성장 그래프, 커리큘럼 완료 현황을 한눈에 확인합니다.

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

const REST_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const FREE_REPORT_FALLBACK_MODEL = 'gemini-3.5-flash-lite';

async function callGeminiJson({ apiKey, model, prompt, responseMimeType = 'application/json' }) {
  const primaryModel = String(model || 'gemini-3.8-flash').replace(/^models\//, '');
  const candidates =
    primaryModel === FREE_REPORT_FALLBACK_MODEL
      ? [primaryModel]
      : [primaryModel, FREE_REPORT_FALLBACK_MODEL];

  let lastErr = null;
  for (let i = 0; i < candidates.length; i++) {
    const cleanModel = candidates[i];
    const url = `${REST_BASE}/${encodeURIComponent(cleanModel)}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType,
          temperature: 0.45,
        },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      lastErr = new Error(`Gemini API 오류 (${res.status}): ${errBody.slice(0, 220)}`);
      // On Free-Tier rate limit (429), overload (503), or deprecated/unavailable model (404), auto-fallback
      if ((res.status === 429 || res.status === 503 || res.status === 404) && i + 1 < candidates.length) {
        continue;
      }
      throw lastErr;
    }

    const data = await res.json();
    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map((p) => p.text || '')
        .join('')
        .trim() || '';

    if (!text) {
      lastErr = new Error('응답 텍스트가 비어 있습니다.');
      if (i + 1 < candidates.length) continue;
      throw lastErr;
    }

    if (responseMimeType === 'application/json') {
      const cleaned = text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
      return JSON.parse(cleaned);
    }
    return text;
  }

  throw lastErr || new Error('Gemini API 호출에 실패했습니다.');
}

function formatTranscriptForPrompt(transcript, maxTurns = 80) {
  return transcript
    .slice(-maxTurns)
    .map((item) => `${item.role === 'user' ? 'Student' : 'Tutor'}: ${item.text}`)
    .join('\n');
}

/**
 * Parent Admin Feature: AI 4-Page Custom Textbook Generator
 * Instantly creates a structured 20-minute interactive ESL textbook on ANY topic!
 */
export async function generateAiTextbook({ apiKey, model, topic, grade }) {
  const isG6 = grade === 'grade6';
  const targetDesc = isG6
    ? 'capable Korean 6th grader (CEFR B1–B1+, smart pre-teen, loves reading, opinions, debates, and idioms)'
    : 'bright Korean 3rd grader (CEFR A1+–A2, loves storytelling, roleplays, clear vocabulary, and fun missions)';

  const prompt = `Create a complete, engaging 4-page 20-minute 1-on-1 ESL video class textbook unit about: "${topic}".
Target learner: ${targetDesc}.

Return strictly valid JSON with this exact schema:
{
  "title": "Catchy English unit title (max 6 words)",
  "titleKo": "짧고 매력적인 한국어 부제",
  "category": "스토리텔링 | 역할극 | 리딩 · 토론 | 과학 · 탐험 | 일상 회화 중 택1",
  "description": "부모님이 보기 좋은 1문장 한국어 교재 소개",
  "vocab": [
    { "word": "word1", "meaning": "한국어 뜻", "example": "Short clear English example sentence." }
  ],
  "readingTitle": "Fun short story or article title",
  "readingParagraphs": [
    "Paragraph 1 (2-3 crisp sentences suitable for reading aloud).",
    "Paragraph 2 (2-3 crisp sentences suitable for reading aloud).",
    "Paragraph 3 (1-2 engaging sentences)."
  ],
  "questions": [
    "Open-ended speaking question 1?",
    "Open-ended speaking question 2?",
    "Personal connection or 'Why?' question 3?",
    "Creative 'What if...' question 4?"
  ],
  "missions": [
    { "label": "Step 1 · 짧은 한국어 라벨", "detail": "Clear English speaking task prompt" },
    { "label": "Step 2 · 짧은 한국어 라벨", "detail": "Clear English speaking task prompt" }
  ]
}

Rules:
- Exactly 5 useful spoken vocabulary items in "vocab".
- Keep reading vivid, kid-safe, and fun to read aloud.
- Questions must encourage full-sentence speaking (avoid yes/no-only traps).`;

  const raw = await callGeminiJson({ apiKey, model, prompt });
  const coverPool = isG6
    ? ['assets/book_future_school.jpg', 'assets/book_london_vlog.jpg']
    : ['assets/book_magic_zoo.jpg', 'assets/book_sunny_cafe.jpg'];
  const cover = coverPool[Math.floor(Math.random() * coverPool.length)];

  return {
    id: `ai_book_${Date.now()}`,
    isAiGenerated: true,
    grade,
    gradeTag: isG6 ? '초6 · AI 맞춤 교재' : '초3 · AI 맞춤 교재',
    levelRange: isG6 ? 'Lv.3–4' : 'Lv.1–2',
    category: raw.category || 'AI 맞춤 교재',
    title: raw.title || topic,
    titleKo: raw.titleKo || topic,
    cover,
    description: raw.description || `"${topic}" 주제로 AI가 생성한 4쪽 화상영어 맞춤 교재입니다.`,
    pages: [
      {
        step: 'Page 1 · Warm-up Words',
        heading: '오늘의 핵심 단어',
        image: cover,
        instructionKo: '단어를 소리 내어 읽어보고, 선생님의 질문에 완전한 영어 문장으로 대답해 보세요.',
        vocab: Array.isArray(raw.vocab) ? raw.vocab.slice(0, 6) : [],
        teacherNotes: 'Practice pronouncing each word and ask the student to use 1–2 words in a short sentence.',
      },
      {
        step: 'Page 2 · Story & Reading',
        heading: raw.readingTitle || '함께 읽기',
        image: cover,
        instructionKo: '선생님과 번갈아 가며 지문을 소리 내어 읽어 보세요.',
        readingTitle: raw.readingTitle || raw.title,
        readingParagraphs: Array.isArray(raw.readingParagraphs) ? raw.readingParagraphs : [],
        teacherNotes: 'Have the student read aloud and praise clear expression.',
      },
      {
        step: 'Page 3 · Think & Speak',
        heading: '생각하고 영어로 말하기',
        instructionKo: '단답 대신 이유를 붙여 완전한 영어 문장으로 대답해 보세요!',
        questions: Array.isArray(raw.questions) ? raw.questions : [],
        teacherNotes: 'Ask one question at a time. Always nudge short answers into full sentences.',
      },
      {
        step: 'Page 4 · Speaking Mission',
        heading: '오늘의 말하기 미션!',
        instructionKo: '오늘 배운 표현을 활용해서 마지막 미션을 완성해 보세요!',
        missionCards: Array.isArray(raw.missions) ? raw.missions : [],
        teacherNotes: 'Run this creative mission so the student speaks most of the time, and award a Gold Star!',
      },
    ],
  };
}

export async function generateStudyReport({
  apiKey,
  model,
  transcript,
  tutor,
  studentName,
  topicLabel,
  levelLabel,
  durationSec,
  speakingStats = null,
  focusStats = null,
}) {
  const dialogue = formatTranscriptForPrompt(transcript, 120);
  const mins = Math.max(1, Math.round(durationSec / 60));
  const metricsBlock =
    speakingStats && speakingStats.studentTurns > 0
      ? `\nObjective Speaking Fluency Metrics (measured from transcript):
- Student speaking turns: ${speakingStats.studentTurns}
- Average words per turn: ${speakingStats.avgWordsPerTurn} words
- Full-sentence rate (5+ words): ${speakingStats.fullSentenceRate}%
- Turns using connectors (because/so/when/but): ${speakingStats.connectorTurns}
- Questions asked by student: ${speakingStats.questionTurns}
- Longest utterance: "${speakingStats.longestUtterance}"`
      : '';

  const focusBlock =
    focusStats && focusStats.enabled
      ? `\nClassroom Focus Guard Summary (on-device):
- Focus Score: ${focusStats.score}/100 (${focusStats.gradeLabel})
- Screen/App switches away: ${focusStats.tabAwayCount} (${focusStats.tabAwayTotalSec}s total)
- Stepped away from camera: ${focusStats.camAwayCount}, Looking away: ${focusStats.lookAwayCount}, Long silence alerts: ${focusStats.silenceCount}`
      : '';

  const prompt = `You are a warm, expert English speaking coach writing a post-lesson diagnostic report in Korean for BOTH the elementary student ("${studentName}") and their parents.
Session metadata:
- Student: ${studentName} (${levelLabel})
- Tutor: ${tutor.name} (${tutor.accentLabel})
- Lesson / Textbook: ${topicLabel}
- Call Duration: approx. ${mins} min${metricsBlock}${focusBlock}

Conversation transcript:
${dialogue}

Analyze the student's spoken English thoughtfully—focusing on concrete conversational growth (sentence length, grammar accuracy, linking ideas, and asking questions).
Return strictly valid JSON with this exact structure:
{
  "headline": "아이에게 칭찬과 성취감을 주는 오늘의 수업 한 줄 요약 (한국어)",
  "praiseBadge": "오늘의 칭찬 타이틀 (예: 완전한 문장 챌린지 성공 / 논리적인 미니 토론왕)",
  "summary": "학부모와 아이가 함께 읽기 좋은 따뜻한 한국어 총평 — 잘한 점 2가지와 다음 성장 포인트 1가지 포함 (3~4문장)",
  "scores": {
    "fluency": 82,
    "naturalness": 78,
    "vocabulary": 76,
    "engagement": 88
  },
  "speakingWins": [
    "오늘 대화에서 실제로 잘해낸 구체적인 말하기 포인트 1 (한국어)",
    "오늘 대화에서 실제로 잘해낸 구체적인 말하기 포인트 2 (한국어)"
  ],
  "recurringHabits": [
    "다음 수업 AI 선생님이 자동으로 기억하고 집중 보완할 습관 1 (예: 과거 일을 말할 때 동사를 현재형으로 쓰는 습관 → went/ate 집중 연습)",
    "다음 수업 AI 선생님이 자동으로 기억하고 집중 보완할 습관 2 (예: 이유 말할 때 because 붙여 2문장으로 늘리기)"
  ],
  "corrections": [
    {
      "original": "아이가 실제로 말한 영어 문장",
      "improved": "원어민 또래가 실제로 쓰는 더 자연스러운 영어 문장",
      "explanation": "초등학생도 쉽게 이해할 수 있는 친절한 한국어 해설",
      "category": "문법 | 어휘 | 자연스러운 표현 | 시제/전치사"
    }
  ],
  "vocabulary": [
    {
      "phrase": "오늘 수업·교재에서 꼭 복습할 핵심 단어/표현",
      "meaning": "한국어 뜻",
      "example": "아이가 써먹기 좋은 쉬운 예문 (영어)"
    }
  ],
  "nextTopic": "다음 수업 추천 교재나 집에서 해볼 수 있는 3분 복습 미션 (한국어)"
}

Rules:
- Provide 3 to 5 concrete corrections from the student's actual utterances (or upgrade simple sentences into richer native ones if they made few errors).
- Provide 1 to 2 actionable, concrete items in "recurringHabits" that will be fed directly to the AI tutor in the next lesson.
- Provide 4 to 6 key vocabulary/phrases.
- Scores should be encouraging yet realistic integers between 60 and 98.`;

  return callGeminiJson({ apiKey, model, prompt });
}

export function reportToMarkdown(session) {
  const r = session.report;
  const st = session.speakingStats;
  const dateStr = new Date(session.createdAt).toLocaleString('ko-KR');
  const lines = [
    `# AI 화상영어 수업 노트 — ${session.topicLabel}`,
    '',
    `- **학생**: ${session.studentName || '학생'} (${session.levelLabel})`,
    `- **일시**: ${dateStr}`,
    `- **튜터**: ${session.tutorName} (${session.accentLabel})`,
    `- **통화 시간**: ${session.durationLabel}`,
    '',
  ];

  if (st && st.studentTurns > 0) {
    lines.push(
      '## 실전 말하기 지표 (객관적 발화 분석)',
      `- 평균 문장 길이: **${st.avgWordsPerTurn}단어/턴** (총 ${st.studentTurns}회 발화 · ${st.totalWords}단어)`,
      `- 완전한 문장 비율 (5단어+): **${st.fullSentenceRate}%**`,
      `- 연결어(because/so/when 등) 활용: **${st.connectorTurns}회**`,
      `- 아이가 영어로 질문한 횟수: **${st.questionTurns}회**`,
      ...(st.longestUtterance ? [`- 오늘의 최장 영어 문장: *"${st.longestUtterance}"*`] : []),
      ''
    );
  }

  const fs = session.focusStats;
  if (fs && fs.enabled) {
    lines.push(
      '## 수업 집중도 분석 (온디바이스 집중 가드)',
      `- 집중도 점수: **${fs.score}/100 (${fs.gradeLabel || ''})**`,
      `- 다른 앱·화면 이탈: **${fs.tabAwayCount || 0}회** (${fs.tabAwayTotalSec || 0}초)`,
      `- 자리 이탈 (카메라 밖): **${fs.camAwayCount || 0}회** · 시선 이탈: **${fs.lookAwayCount || 0}회** · 무응답 알림: **${fs.silenceCount || 0}회**`,
      ''
    );
    if (Array.isArray(fs.events) && fs.events.length > 0) {
      fs.events.slice(0, 10).forEach((ev) => {
        const m = String(Math.floor((ev.elapsedSec || 0) / 60)).padStart(2, '0');
        const s = String((ev.elapsedSec || 0) % 60).padStart(2, '0');
        lines.push(`  - \`${m}:${s}\` ${ev.label} (${ev.detail || ''})`);
      });
      lines.push('');
    }
  }

  if (r) {
    if (r.praiseBadge) lines.push(`> **오늘의 칭찬 배지**: ${r.praiseBadge}`, '');
    lines.push(`## 총평: ${r.headline || ''}`, '', r.summary || '', '');

    if (Array.isArray(r.recurringHabits) && r.recurringHabits.length > 0) {
      lines.push('## 다음 수업 AI 자동 집중 보완 포인트', '');
      r.recurringHabits.forEach((h) => lines.push(`- ${h}`));
      lines.push('');
    }

    if (r.scores) {
      lines.push(
        '## 영역별 피드백 점수',
        `- 유창성 (Fluency): **${r.scores.fluency}/100**`,
        `- 자연스러움 (Naturalness): **${r.scores.naturalness}/100**`,
        `- 어휘력 (Vocabulary): **${r.scores.vocabulary}/100**`,
        `- 수업 참여도 (Engagement): **${r.scores.engagement}/100**`,
        ''
      );
    }

    if (Array.isArray(r.corrections) && r.corrections.length > 0) {
      lines.push('## 표현 업그레이드 (내가 한 말 → 원어민 표현)', '');
      r.corrections.forEach((c, idx) => {
        lines.push(`### ${idx + 1}. [${c.category || '표현'}]`);
        lines.push(`- **내가 한 말**: ${c.original}`);
        lines.push(`- **원어민 표현**: **${c.improved}**`);
        lines.push(`- **해설**: ${c.explanation}`, '');
      });
    }

    if (Array.isArray(r.vocabulary) && r.vocabulary.length > 0) {
      lines.push('## 오늘의 핵심 표현 & 복습 단어장', '');
      r.vocabulary.forEach((v) => {
        lines.push(`- **${v.phrase}** — ${v.meaning}`);
        if (v.example) lines.push(`  - *예문*: ${v.example}`);
      });
      lines.push('');
    }

    if (r.nextTopic) lines.push('## 다음 수업 추천 & 복습 미션', '', r.nextTopic, '');
  }

  if (Array.isArray(session.transcript) && session.transcript.length > 0) {
    lines.push('## 전체 대화 스크립트', '');
    session.transcript.forEach((t) => {
      const speaker = t.role === 'user' ? (session.studentName || '학생') : session.tutorName;
      lines.push(`- **${speaker}**: ${t.text}`);
    });
    lines.push('');
  }

  return lines.join('\n');
}

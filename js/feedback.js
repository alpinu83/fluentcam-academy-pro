const REST_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

async function callGeminiJson({ apiKey, model, prompt, responseMimeType = 'application/json' }) {
  const cleanModel = model.replace(/^models\//, '');
  const url = `${REST_BASE}/${encodeURIComponent(cleanModel)}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType,
        temperature: 0.4,
      },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Gemini API 오류 (${res.status}): ${errBody.slice(0, 220)}`);
  }

  const data = await res.json();
  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((p) => p.text || '')
      .join('')
      .trim() || '';

  if (!text) {
    throw new Error('응답 텍스트가 비어 있습니다.');
  }

  if (responseMimeType === 'application/json') {
    const cleaned = text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    return JSON.parse(cleaned);
  }
  return text;
}

function formatTranscriptForPrompt(transcript, maxTurns = 80) {
  return transcript
    .slice(-maxTurns)
    .map((item) => `${item.role === 'user' ? 'Student' : 'Tutor'}: ${item.text}`)
    .join('\n');
}

export async function requestSpeakingHints({ apiKey, model, transcript, tutorName, levelLabel, textbookTitle }) {
  const recent = formatTranscriptForPrompt(transcript, 8);
  const prompt = `You are helping a Korean elementary school English learner (${levelLabel}) during a live video call with native tutor ${tutorName}.
${textbookTitle ? `Current Lesson Textbook: ${textbookTitle}` : ''}
Based on the recent conversation below, suggest 3 natural, kid-friendly spoken English replies the student can say right now.

Recent conversation:
${recent || '(Call just started — suggest 3 friendly opening lines)'}

Return strictly valid JSON with this shape:
{
  "hints": [
    {
      "english": "Natural spoken English sentence appropriate for the student's level",
      "korean": "쉬운 한국어 뜻",
      "nuance": "짧은 활용 팁 (한국어 15자 내외)"
    }
  ]
}`;

  return callGeminiJson({ apiKey, model, prompt });
}

export async function translateUtterance({ apiKey, model, text }) {
  const prompt = `Translate this spoken English sentence from a native tutor into easy, natural Korean for an elementary student, and note 1-2 useful expressions if any.

Sentence: "${text}"

Return strictly valid JSON:
{
  "korean": "자연스럽고 이해하기 쉬운 한국어 번역",
  "notes": [
    { "expression": "영문 표현", "meaning": "한국어 의미" }
  ]
}`;

  return callGeminiJson({ apiKey, model, prompt });
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
}) {
  const dialogue = formatTranscriptForPrompt(transcript, 120);
  const mins = Math.max(1, Math.round(durationSec / 60));

  const prompt = `You are a warm, expert English education coach writing a post-lesson report in Korean for BOTH the elementary student ("${studentName}") and their parents.
Session metadata:
- Student: ${studentName} (${levelLabel})
- Tutor: ${tutor.name} (${tutor.accentLabel})
- Lesson / Textbook: ${topicLabel}
- Call Duration: approx. ${mins} min

Conversation transcript:
${dialogue}

Analyze the student's spoken English thoughtfully (praising strengths warmly while giving clear, practical phrasing upgrades and vocabulary to review).
Return strictly valid JSON with this exact structure:
{
  "headline": "아이에게 칭찬과 성취감을 주는 오늘의 수업 한 줄 요약 (한국어)",
  "praiseBadge": "오늘의 칭찬 타이틀 (예: 자신감 넘치는 스토리텔러 / 논리적인 미니 토론왕)",
  "summary": "학부모와 아이가 함께 읽기 좋은 따뜻한 한국어 총평 — 잘한 점 2가지와 다음 성장 포인트 1가지 포함 (3~4문장)",
  "scores": {
    "fluency": 82,
    "naturalness": 78,
    "vocabulary": 76,
    "engagement": 88
  },
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
- Provide 4 to 6 key vocabulary/phrases.
- Scores should be encouraging yet realistic integers between 60 and 98.`;

  return callGeminiJson({ apiKey, model, prompt });
}

export function reportToMarkdown(session) {
  const r = session.report;
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

  if (r) {
    if (r.praiseBadge) {
      lines.push(`> **오늘의 칭찬 배지**: ${r.praiseBadge}`, '');
    }
    lines.push(`## 총평: ${r.headline || ''}`, '', r.summary || '', '');

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

    if (r.nextTopic) {
      lines.push('## 다음 수업 추천 & 복습 미션', '', r.nextTopic, '');
    }
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

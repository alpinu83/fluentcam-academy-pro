/**
 * 5-Minute AI CEFR Level Placement Test (Elementary 3rd–6th Grade)
 * Includes Listening, Picture Description, and Opinion Speaking tasks.
 * Uses Gemini REST API when an API key is provided, plus a smart local
 * fallback estimator so parents/kids can test the flow immediately.
 */

const REST_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export const LEVEL_TEST_QUESTIONS = [
  {
    id: 'lt_1',
    part: 'Part 1 · 듣기 & 일상 대답',
    title: '원어민 질문을 듣고 자연스럽게 영어로 답해 보세요',
    audioPrompt:
      'Hi! Tell me about your favorite thing to do after school or on the weekend. Why do you like it?',
    promptKo: '방과 후나 주말에 가장 좋아하는 활동과 그 이유를 영어로 1~3문장 말해 보세요.',
    placeholder: '예: After school, I usually play soccer with my friends because it is really exciting!',
    image: null,
  },
  {
    id: 'lt_2',
    part: 'Part 2 · 그림 묘사 & 스토리텔링',
    title: '아래 그림에서 무엇이 일어나고 있는지 영어로 설명해 보세요',
    audioPrompt:
      'Look closely at this sunny zoo picture! Describe what you see and imagine what the little penguin wants to do next.',
    promptKo: '그림 속 동물들과 펭귄이 무엇을 하고 있는지, 다음에 어떤 일이 일어날지 영어로 표현해 보세요.',
    placeholder: '예: A cute penguin with brown goggles is looking at colorful balloons. Maybe he wants to fly!',
    image: 'assets/book_magic_zoo.jpg',
  },
  {
    id: 'lt_3',
    part: 'Part 3 · 내 의견과 이유 말하기',
    title: '미래 학교에 대한 내 생각을 영어로 말해 보세요',
    audioPrompt:
      'In the future, would you rather learn from an AI robot teacher or a human teacher? Give at least one reason for your choice!',
    promptKo: '미래에 AI 로봇 선생님과 인간 선생님 중 누구에게 배우고 싶은지, 이유와 함께 영어로 답해 보세요.',
    placeholder: '예: In my opinion, a human teacher is better because they can understand our feelings and cheer us up.',
    image: 'assets/book_future_school.jpg',
  },
];

function localHeuristicEvaluate(answers) {
  const joined = answers.map((a) => (a.answer || '').trim()).join(' ');
  const words = joined.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const hasConnectors = /\b(because|however|although|therefore|opinion|perspective|actually|prefer|instead)\b/i.test(joined);
  const uniqueWords = new Set(words.map((w) => w.toLowerCase().replace(/[^a-z]/g, '')).filter(Boolean)).size;

  if (wordCount >= 55 && hasConnectors && uniqueWords >= 34) {
    return {
      cefr: 'B1+ / B2',
      recommendedLevelKey: 'junior_fluent',
      recommendedBookId: 'kids-debate-smartphones',
      scores: { speaking: 89, vocabulary: 87, grammar: 85, fluency: 88 },
      summary:
        '어휘 선택이 풍부하고 이유와 연결어를 사용해 완성도 높은 영어 문장을 구사하고 있어요! 원어민 속도 토론과 심화 주제 수업이 딱 맞습니다.',
      strengths: ['복문과 연결어(because, however 등) 활용이 자연스러움', '구체적인 이유와 예시를 스스로 확장해 말함'],
      focus: '고급 관용구와 반박 표현을 익혀 주니어 영어 토론 실력을 한 단계 더 끌어올려 보세요.',
    };
  }

  if (wordCount >= 34 && (hasConnectors || uniqueWords >= 22)) {
    return {
      cefr: 'B1 (초등 고급)',
      recommendedLevelKey: 'elem6_high',
      recommendedBookId: 'future-school-2050',
      scores: { speaking: 82, vocabulary: 79, grammar: 78, fluency: 81 },
      summary:
        '질문의 의도를 정확히 파악하고 자기 생각을 문장으로 또렷하게 표현하는 탄탄한 실력입니다! 짧은 영어 기사를 읽고 의견을 나누는 초6 고급 트랙을 추천해요.',
      strengths: ['주제에 맞게 2~3문장 이상 스스로 이어서 답변함', '일상 어휘와 이유 표현이 안정적임'],
      focus: '시제·관사 정확도와 원어민 구동사(grab a bite, cheer up 등)를 늘리면 훨씬 자연스러워져요.',
    };
  }

  if (wordCount >= 18) {
    return {
      cefr: 'A2+ (초등 중상급)',
      recommendedLevelKey: 'elem_upper_mid',
      recommendedBookId: 'sunny-cafe',
      scores: { speaking: 76, vocabulary: 74, grammar: 73, fluency: 75 },
      summary:
        '기본 문장 구성력이 좋고 영어로 대답하려는 자신감이 돋보여요! 역할극과 스토리텔링으로 문장을 길게 늘리는 연습을 하면 실력이 빠르게 성장할 단계입니다.',
      strengths: ['핵심 단어를 활용해 의미를 분명하게 전달함', '그림과 상황에 맞는 어휘 선택이 좋음'],
      focus: '단답형보다 "because..."를 붙여 2문장 이상 이어 말하는 습관을 연습해 보세요.',
    };
  }

  return {
    cefr: 'A1+ / A2 (초등 중급)',
    recommendedLevelKey: 'elem3_mid',
    recommendedBookId: 'magic-zoo',
    scores: { speaking: 70, vocabulary: 69, grammar: 68, fluency: 70 },
    summary:
      '기초 영어 이해도가 좋아 원어민 선생님과 즐겁게 그림을 보며 따라 말하면 금방 말문이 트일 단계예요! 친근한 스토리텔링 교재부터 시작해 보세요.',
    strengths: ['영어 질문을 이해하고 핵심 단어로 표현할 수 있음', '부담 없이 발화를 시작하는 좋은 출발점'],
    focus: '완전한 주어+동사 문장으로 1~2문장씩 자신감 있게 말해보는 연습이 가장 효과적입니다.',
  };
}

export async function evaluateLevelTest({ apiKey, model, studentName, answers }) {
  const nonEmpty = answers.filter((a) => (a.answer || '').trim().length > 0);
  if (nonEmpty.length === 0) {
    throw new Error('최소 1개 이상의 문항에 영어로 답한 뒤 진단을 시작해 주세요.');
  }

  if (!apiKey || !apiKey.trim()) {
    return {
      ...localHeuristicEvaluate(answers),
      evaluatedBy: '로컬 빠른 진단 (API 키 입력 시 Gemini 정밀 진단)',
    };
  }

  const cleanModel = (model || 'gemini-3.5-flash-lite').replace(/^models\//, '');
  const url = `${REST_BASE}/${encodeURIComponent(cleanModel)}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

  const qaBlock = answers
    .map((a, idx) => `Q${idx + 1} (${a.part}): ${a.audioPrompt}\nStudent Answer: ${a.answer || '(skipped)'}`)
    .join('\n\n');

  const prompt = `You are a certified CEFR English placement assessor for Korean elementary students (grades 3 to 6).
Student Name: ${studentName}

Placement Test Responses:
${qaBlock}

Evaluate the student's English level accurately and warmly in Korean, and map them to ONE of these 4 course levels:
- "elem3_mid" (Level 1 · A1+~A2) -> recommendedBookId: "magic-zoo"
- "elem_upper_mid" (Level 2 · A2+) -> recommendedBookId: "sunny-cafe" or "mystery-show-tell"
- "elem6_high" (Level 3 · B1) -> recommendedBookId: "future-school-2050" or "london-travel-vlog"
- "junior_fluent" (Level 4 · B1+~B2) -> recommendedBookId: "kids-debate-smartphones"

Return strictly valid JSON:
{
  "cefr": "A2+ | B1 | B1+ etc.",
  "recommendedLevelKey": "elem3_mid | elem_upper_mid | elem6_high | junior_fluent",
  "recommendedBookId": "magic-zoo | sunny-cafe | mystery-show-tell | future-school-2050 | london-travel-vlog | kids-debate-smartphones",
  "scores": {
    "speaking": 82,
    "vocabulary": 79,
    "grammar": 77,
    "fluency": 80
  },
  "summary": "학부모와 아이가 보기 좋은 따뜻한 한국어 종합 진단 (2~3문장)",
  "strengths": ["강점 1 (한국어)", "강점 2 (한국어)"],
  "focus": "앞으로 집중하면 가장 효과 좋을 학습 포인트 1문장 (한국어)"
}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
      }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map((p) => p.text || '')
        .join('')
        .trim() || '';
    const cleaned = text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    const parsed = JSON.parse(cleaned);
    return { ...parsed, evaluatedBy: `Gemini AI 정밀 진단 (${cleanModel})` };
  } catch (err) {
    console.warn('Gemini placement eval fallback:', err);
    return {
      ...localHeuristicEvaluate(answers),
      evaluatedBy: '로컬 자동 진단 (API 응답 지연으로 대체)',
    };
  }
}

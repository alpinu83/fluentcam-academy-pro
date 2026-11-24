/**
 * Closed-Loop Conversational Ability Engine for FluentCam Academy Pro.
 *
 * 1. Per-student Speaking Focus Modes (Balanced, Sentence Builder, Recast/Transfer Drill, Story/Debate)
 * 2. Objective Speaking Fluency Analyzer (avg words/turn, full-sentence %, connectors, student questions, longest utterance)
 * 3. Cross-Session Learner Memory Builder (recycles past mistakes, recurring habits, and due FSRS phrases into the next live class)
 * 4. Silent Mid-Call Telemetry Snapshot for tool responses so the live tutor adapts dynamically
 */

export const SPEAKING_FOCUS_MODES = {
  balanced: {
    label: '균형 회화 코칭 (권장)',
    shortLabel: '균형 회화',
    desc: '완전 문장 확장 + 1가지 보완 + 꼬리 질문 + 역질문 연습',
    prompt: `SPEAKING FOCUS — BALANCED CONVERSATIONAL COACHING:
- Combine warm natural conversation with steady output growth: expand short answers into full sentences, coach ONE clear weakness via Repair + Transfer, ask 1–2 curiosity follow-ups, and invite the student to ask YOU a question every 3–4 turns.`,
  },
  sentence_builder: {
    label: '긴 문장 · 이유 말하기 집중',
    shortLabel: '긴 문장 확장',
    desc: '단답 습관 탈출 · because/so/when으로 2문장 이상 이어 말하기',
    prompt: `SPEAKING FOCUS — SENTENCE BUILDER (1+1 RULE):
- Your #1 goal is breaking short-answer habits and building multi-clause English sentences!
- Apply the "1+1 Rule" on almost every turn: after the student states an answer, gently prompt them to add +1 connector (because / so / when / and then / for example) to make it a 2-part or 2-sentence answer!
- Write helpful connector starters on the chalkboard (e.g. "I like ... because ... and ...") and award a Gold Star whenever they speak a connected 7+ word sentence!`,
  },
  recast_drill: {
    label: '약점 집중 보완 · 패턴 체화',
    shortLabel: '약점 보완 드릴',
    desc: '시제·어순·전치사 실수 즉시 보완 → 따라 말하기 → 새 상황 응용(Transfer)',
    prompt: `SPEAKING FOCUS — PRECISION REPAIR & TRANSFER DRILL:
- Listen closely for recurring grammar/tense/word-order/preposition slips and pronunciation clarity.
- Whenever a clear error happens: (1) Acknowledge effort honestly, (2) write_on_whiteboard the clean model sentence, (3) have the student repeat it smoothly (chunking if needed), and (4) IMMEDIATELY ask a brand-new Transfer Question that requires using that EXACT same pattern on a fresh personal example so the pattern sticks permanently!`,
  },
  debate_story: {
    label: '스토리텔링 · 논리 설득 훈련',
    shortLabel: '스토리 · 토론',
    desc: '초6·심화 추천 · 기승전결 이야기 & 의견+이유 2가지+반론 대응',
    prompt: `SPEAKING FOCUS — STORYTELLING & LOGICAL PERSUASION:
- Push the student to speak in structured mini-speeches rather than single lines!
- For stories: guide them through Beginning → Middle → Ending ("What happened first? Then what happened? How did it end?").
- For opinions: ask for Opinion + 2 Reasons + an Example, then play friendly devil's advocate ("Hmm, what if someone says the opposite? How would you convince them?") and invite them to challenge or question your view too!`,
  },
};

const CONNECTOR_RE =
  /\b(because|so|but|however|although|though|when|while|after|before|if|unless|first|then|finally|actually|for example|also|and then)\b/i;

const QUESTION_START_RE =
  /^(do|does|did|can|could|will|would|should|shall|may|might|is|are|am|was|were|have|has|had|what|why|how|where|when|who|whose|which)\b/i;

function tokenizeEnglishWords(text = '') {
  const matches = String(text).match(/[A-Za-z]+(?:'[A-Za-z]+)?/g);
  return matches || [];
}

/**
 * Deterministic, objective speaking fluency analysis from a session transcript.
 */
export function analyzeConversationSpeaking(transcript = []) {
  const userTurns = (Array.isArray(transcript) ? transcript : [])
    .filter((t) => t && t.role === 'user' && typeof t.text === 'string')
    .map((t) => t.text.trim())
    .filter((txt) => tokenizeEnglishWords(txt).length > 0);

  if (userTurns.length === 0) {
    return {
      studentTurns: 0,
      totalWords: 0,
      avgWordsPerTurn: 0,
      fullSentenceTurns: 0,
      fullSentenceRate: 0,
      connectorTurns: 0,
      questionTurns: 0,
      shortAnswerTurns: 0,
      longestUtterance: '',
      longestWordCount: 0,
    };
  }

  let totalWords = 0;
  let fullSentenceTurns = 0;
  let connectorTurns = 0;
  let questionTurns = 0;
  let shortAnswerTurns = 0;
  let longestUtterance = '';
  let longestWordCount = 0;

  for (const text of userTurns) {
    const words = tokenizeEnglishWords(text);
    const wc = words.length;
    totalWords += wc;

    if (wc >= 5) {
      fullSentenceTurns++;
    } else if (wc <= 3) {
      shortAnswerTurns++;
    }

    if (CONNECTOR_RE.test(text)) {
      connectorTurns++;
    }

    if (text.includes('?') || (wc >= 3 && QUESTION_START_RE.test(text))) {
      questionTurns++;
    }

    if (wc > longestWordCount) {
      longestWordCount = wc;
      longestUtterance = text;
    }
  }

  return {
    studentTurns: userTurns.length,
    totalWords,
    avgWordsPerTurn: Math.round((totalWords / userTurns.length) * 10) / 10,
    fullSentenceTurns,
    fullSentenceRate: Math.round((fullSentenceTurns / userTurns.length) * 100),
    connectorTurns,
    questionTurns,
    shortAnswerTurns,
    longestUtterance,
    longestWordCount,
  };
}

/**
 * Build a personalized Cross-Session Learner Memory object & prompt block from
 * the child's recent sessions and due FSRS review cards.
 */
export function buildLearnerMemory({ studentId, history = [], fsrsDeck = [], now = Date.now() }) {
  const studentSessions = (Array.isArray(history) ? history : [])
    .filter((s) => (s.studentId || 'grade3') === studentId)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const recentSessions = studentSessions.slice(0, 4);
  const lastSession = recentSessions[0] || null;

  // Collect recurring habits (prefer explicit AI-identified habits, fall back to recent correction categories/examples)
  const recurringHabits = [];
  const seenHabit = new Set();
  for (const sess of recentSessions) {
    const habits = sess?.report?.recurringHabits;
    if (Array.isArray(habits)) {
      for (const h of habits) {
        const clean = String(h || '').trim();
        if (clean && !seenHabit.has(clean.toLowerCase()) && recurringHabits.length < 3) {
          seenHabit.add(clean.toLowerCase());
          recurringHabits.push(clean);
        }
      }
    }
  }

  // Collect recent real correction pairs so the tutor knows exact errors to watch & recycle
  const recentUpgrades = [];
  const seenUpgrade = new Set();
  for (const sess of recentSessions.slice(0, 2)) {
    const corrs = sess?.report?.corrections;
    if (Array.isArray(corrs)) {
      for (const c of corrs) {
        const orig = String(c?.original || '').trim();
        const imp = String(c?.improved || '').trim();
        if (orig && imp && !seenUpgrade.has(imp.toLowerCase()) && recentUpgrades.length < 3) {
          seenUpgrade.add(imp.toLowerCase());
          recentUpgrades.push({ original: orig, improved: imp, category: c.category || '표현' });
        }
      }
    }
  }

  // Pick up to 3 high-priority FSRS phrases for natural 1–2 min warm-up spiral review
  const studentCards = (Array.isArray(fsrsDeck) ? fsrsDeck : []).filter((c) => c.studentId === studentId);
  const prioritizedCards = [...studentCards].sort((a, b) => {
    const aDue = (a.due || 0) <= now ? 0 : 1;
    const bDue = (b.due || 0) <= now ? 0 : 1;
    if (aDue !== bDue) return aDue - bDue;
    return (b.lapses || 0) - (a.lapses || 0);
  });
  const reviewPhrases = prioritizedCards
    .slice(0, 3)
    .map((c) => ({ front: String(c.front || '').trim(), back: String(c.back || '').trim() }))
    .filter((c) => c.front);

  // Average words per turn from the most recent session (if available)
  let lastAvgWords = null;
  if (lastSession) {
    const stats = lastSession.speakingStats || analyzeConversationSpeaking(lastSession.transcript || []);
    if (stats.studentTurns >= 2) {
      lastAvgWords = stats.avgWordsPerTurn;
    }
  }

  // Build prompt block for Gemini Live
  const lines = [];
  if (lastSession) {
    lines.push(
      `- Last lesson: "${lastSession.topicLabel}" (${lastSession.durationLabel || ''}${
        lastAvgWords ? `, student averaged ${lastAvgWords} words/turn` : ''
      }).`
    );
    if (lastAvgWords !== null && lastAvgWords < 5.5) {
      lines.push(
        `- Fluency target today: Last class the student averaged ${lastAvgWords} words/turn. Gently coach them toward 6+ word complete sentences using "because / so / when"!`
      );
    }
  }
  if (recurringHabits.length > 0) {
    lines.push(`- Recurring speaking habits to actively watch & improve today:`);
    for (const h of recurringHabits) {
      lines.push(`  * ${h}`);
    }
  }
  if (recentUpgrades.length > 0) {
    lines.push(`- Specific past utterances to recycle & verify they improved:`);
    for (const u of recentUpgrades) {
      lines.push(`  * Previously said "${u.original}" -> target: "${u.improved}"`);
    }
  }
  if (reviewPhrases.length > 0) {
    lines.push(
      `- Spiral Review Phrases (weave 1–2 of these naturally into your 2-minute Warm-Up so the student recalls and uses them aloud!):`
    );
    for (const p of reviewPhrases) {
      lines.push(`  * "${p.front}"`);
    }
  }

  const promptBlock =
    lines.length > 0
      ? `\n[LEARNER MEMORY — PERSONALIZED CONTINUITY FROM PAST LESSONS]
You remember this student from previous classes! Use this memory naturally (don't read it robotically):
${lines.join('\n')}`
      : '';

  return {
    hasHistory: recentSessions.length > 0,
    sessionCount: studentSessions.length,
    lastTopic: lastSession?.topicLabel || null,
    lastAvgWords,
    recurringHabits,
    recentUpgrades,
    reviewPhrases,
    promptBlock,
  };
}

/**
 * Silent live telemetry payload attached to classroom tool responses so the live tutor
 * gets objective mid-class feedback without interrupting the audio stream.
 */
export function buildMidCallCoachFeedback(transcript = []) {
  const stats = analyzeConversationSpeaking(transcript);
  if (stats.studentTurns < 2) {
    return {
      studentTurns: stats.studentTurns,
      coachTip: 'Early in class—keep questions warm, easy to start, and listen patiently.',
    };
  }

  const tips = [];
  if (stats.avgWordsPerTurn < 4.5) {
    tips.push(
      `Student averages ${stats.avgWordsPerTurn} words/turn so far—scaffold fuller sentences with a starter ("Try starting with: 'I think ... because ...'") before moving on.`
    );
  } else if (stats.avgWordsPerTurn >= 8) {
    tips.push(
      `Student is speaking richly (${stats.avgWordsPerTurn} words/turn)! Celebrate and challenge them with a deeper "Why / What if" follow-up.`
    );
  }

  if (stats.studentTurns >= 4 && stats.questionTurns === 0) {
    tips.push(
      'Student has not asked a question yet—soon invite them to ask YOU one question in English ("Now you ask me a question!").'
    );
  }

  if (stats.connectorTurns === 0 && stats.studentTurns >= 3) {
    tips.push('Encourage using a connector like "because", "so", or "when" to extend their next answer.');
  }

  return {
    studentTurns: stats.studentTurns,
    avgWordsPerTurn: stats.avgWordsPerTurn,
    fullSentenceRatePct: stats.fullSentenceRate,
    studentQuestionsAsked: stats.questionTurns,
    coachTip:
      tips.join(' ') ||
      'Great speaking momentum! Keep balancing warm follow-ups with 1-point coaching and transfer questions.',
  };
}

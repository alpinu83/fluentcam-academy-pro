/**
 * FSRS (Free Spaced Repetition Scheduler — inspired by open-spaced-repetition/ts-fsrs)
 * + Per-student Vocabulary & Sentence Upgrade Flashcard Deck
 * + Native Pronunciation TTS & Voice Shadowing Recorder
 */

const DECK_STORAGE_KEY = 'fluentcam_fsrs_deck_v1';

// Standard FSRS-4.5 default weights (17 parameters)
const W = [
  0.4072, 1.1829, 3.1262, 15.4722, 7.2102, 0.5316, 1.0651, 0.0234,
  1.616, 0.1544, 1.0824, 1.9813, 0.0953, 0.2975, 2.2042, 0.2407, 2.9466,
];

export const RATING = {
  AGAIN: 1,
  HARD: 2,
  GOOD: 3,
  EASY: 4,
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function createFsrsCard({
  id,
  studentId,
  front,
  back,
  example = '',
  source = '교재 핵심 표현',
  kind = 'vocab', // 'vocab' | 'upgrade'
}) {
  return {
    id: id || `card_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    studentId,
    front,
    back,
    example,
    source,
    kind,
    due: Date.now(),
    stability: 0,
    difficulty: 5,
    reps: 0,
    lapses: 0,
    state: 'new', // 'new' | 'learning' | 'review'
    lastReview: null,
  };
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function initStability(rating) {
  return Math.max(0.1, W[rating - 1]);
}

function initDifficulty(rating) {
  return clamp(W[4] - Math.exp(W[5] * (rating - 1)) + 1, 1, 10);
}

function nextDifficulty(d, rating) {
  const next = d - W[6] * (rating - 3);
  return clamp(W[7] * initDifficulty(RATING.EASY) + (1 - W[7]) * next, 1, 10);
}

function retrievability(elapsedDays, stability) {
  if (stability <= 0) return 0;
  return Math.pow(1 + elapsedDays / (9 * stability), -1);
}

export function previewFsrsSchedules(card, now = Date.now()) {
  const results = {};
  for (const r of [RATING.AGAIN, RATING.HARD, RATING.GOOD, RATING.EASY]) {
    results[r] = scheduleFsrsCard(card, r, now);
  }
  return results;
}

export function scheduleFsrsCard(card, rating, now = Date.now()) {
  const next = { ...card, lastReview: now };
  const elapsedDays = card.lastReview ? Math.max(0, (now - card.lastReview) / DAY_MS) : 0;

  if (card.state === 'new' || card.reps === 0) {
    next.difficulty = initDifficulty(rating);
    next.stability = initStability(rating);
    next.reps = 1;

    if (rating === RATING.AGAIN) {
      next.state = 'learning';
      next.lapses = (card.lapses || 0) + 1;
      next.due = now + 5 * 60 * 1000; // 5 min
      next.intervalLabel = '5분 후';
    } else if (rating === RATING.HARD) {
      next.state = 'learning';
      next.due = now + 12 * 60 * 1000; // 12 min
      next.intervalLabel = '12분 후';
    } else if (rating === RATING.GOOD) {
      const days = Math.max(1, Math.round(next.stability));
      next.state = 'review';
      next.due = now + days * DAY_MS;
      next.intervalLabel = `${days}일 후`;
    } else {
      const days = Math.max(4, Math.round(next.stability));
      next.state = 'review';
      next.due = now + days * DAY_MS;
      next.intervalLabel = `${days}일 후`;
    }
    return next;
  }

  const r = retrievability(elapsedDays, Math.max(0.1, card.stability));
  next.difficulty = nextDifficulty(card.difficulty || 5, rating);
  next.reps = (card.reps || 0) + 1;

  if (rating === RATING.AGAIN) {
    next.lapses = (card.lapses || 0) + 1;
    next.stability = Math.max(
      0.2,
      W[11] * Math.pow(next.difficulty, -W[12]) * (Math.pow(card.stability + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r))
    );
    next.state = 'learning';
    next.due = now + 10 * 60 * 1000;
    next.intervalLabel = '10분 후';
  } else {
    const hardPenalty = rating === RATING.HARD ? W[15] : 1;
    const easyBonus = rating === RATING.EASY ? W[16] : 1;
    const growth =
      Math.exp(W[8]) *
      (11 - next.difficulty) *
      Math.pow(Math.max(0.1, card.stability), -W[9]) *
      (Math.exp(W[10] * (1 - r)) - 1) *
      hardPenalty *
      easyBonus;

    next.stability = Math.max(0.5, card.stability * (1 + Math.max(0.15, growth)));
    const rawDays = Math.max(1, Math.round(next.stability));
    const days = rating === RATING.HARD ? Math.max(1, Math.round(rawDays * 0.8)) : rawDays;
    next.state = 'review';
    next.due = now + days * DAY_MS;
    next.intervalLabel = days === 1 ? '내일' : `${days}일 후`;
  }

  return next;
}

const STARTER_CARDS = [
  // Grade 3 starter deck
  createFsrsCard({
    id: 'seed_g3_1',
    studentId: 'grade3',
    front: 'Could I have a strawberry smoothie, please?',
    back: '딸기 스무디 하나 주시겠어요?',
    example: 'At Sunny Cafe: "Could I have a strawberry smoothie without whipped cream, please?"',
    source: 'Sunny Cafe 교재',
    kind: 'upgrade',
  }),
  createFsrsCard({
    id: 'seed_g3_2',
    studentId: 'grade3',
    front: 'curious',
    back: '호기심이 많은',
    example: 'Pip is a very curious little penguin who dreams of flying.',
    source: 'Magic Zoo 교재',
    kind: 'vocab',
  }),
  createFsrsCard({
    id: 'seed_g3_3',
    studentId: 'grade3',
    front: 'It can fly super fast!',
    back: '그것은 엄청 빠르게 날 수 있어요! (can + 동사원형)',
    example: 'My magic pet dragon can fly super fast above the clouds.',
    source: '핵심 문법 쉐도잉',
    kind: 'upgrade',
  }),
  createFsrsCard({
    id: 'seed_g3_4',
    studentId: 'grade3',
    front: 'meaningful',
    back: '소중한, 의미 있는',
    example: 'This keychain is meaningful because my best friend gave it to me.',
    source: 'Mystery Show & Tell 교재',
    kind: 'vocab',
  }),
  // Grade 6 starter deck
  createFsrsCard({
    id: 'seed_g6_1',
    studentId: 'grade6',
    front: "That's a fair point, however...",
    back: '일리가 있는 말씀이지만, 반면에...',
    example: "That's a fair point, however human teachers understand students' emotions better.",
    source: '주니어 토론 핵심 패턴',
    kind: 'upgrade',
  }),
  createFsrsCard({
    id: 'seed_g6_2',
    studentId: 'grade6',
    front: 'grab a bite',
    back: '간단히 뭐 좀 먹다',
    example: "After visiting Tower Bridge, let's grab a bite at the street food market.",
    source: 'London Travel Vlog 교재',
    kind: 'vocab',
  }),
  createFsrsCard({
    id: 'seed_g6_3',
    studentId: 'grade6',
    front: 'much better at understanding feelings',
    back: '감정을 이해하는 것을 훨씬 더 잘하는',
    example: 'Human teachers are much better at understanding how students feel.',
    source: 'Future School 2050 교정',
    kind: 'upgrade',
  }),
  createFsrsCard({
    id: 'seed_g6_4',
    studentId: 'grade6',
    front: 'From my perspective,',
    back: '제 관점에서는,',
    example: 'From my perspective, setting clear phone-free zones is the smartest compromise.',
    source: 'Smartphones 토론 교재',
    kind: 'vocab',
  }),
];

export function loadFsrsDeck() {
  try {
    const raw = localStorage.getItem(DECK_STORAGE_KEY);
    if (!raw) {
      saveFsrsDeck(STARTER_CARDS);
      return [...STARTER_CARDS];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [...STARTER_CARDS];
  } catch {
    return [...STARTER_CARDS];
  }
}

export function saveFsrsDeck(cards) {
  localStorage.setItem(DECK_STORAGE_KEY, JSON.stringify(cards.slice(0, 300)));
}

export function ingestLessonIntoFsrsDeck({ studentId, topicLabel, report, whiteboardNotes = [] }) {
  const deck = loadFsrsDeck();
  const existingFronts = new Set(
    deck.filter((c) => c.studentId === studentId).map((c) => c.front.trim().toLowerCase())
  );

  let added = 0;

  if (Array.isArray(report?.corrections)) {
    for (const c of report.corrections) {
      const front = (c.improved || '').trim();
      if (!front || existingFronts.has(front.toLowerCase())) continue;
      existingFronts.add(front.toLowerCase());
      deck.unshift(
        createFsrsCard({
          studentId,
          front,
          back: c.explanation || '원어민 자연스러운 표현',
          example: c.original ? `내가 했던 말: "${c.original}"` : '',
          source: `${topicLabel} (교정)`,
          kind: 'upgrade',
        })
      );
      added++;
    }
  }

  if (Array.isArray(report?.vocabulary)) {
    for (const v of report.vocabulary) {
      const front = (v.phrase || '').trim();
      if (!front || existingFronts.has(front.toLowerCase())) continue;
      existingFronts.add(front.toLowerCase());
      deck.unshift(
        createFsrsCard({
          studentId,
          front,
          back: v.meaning || '',
          example: v.example || '',
          source: `${topicLabel} (단어)`,
          kind: 'vocab',
        })
      );
      added++;
    }
  }

  for (const note of whiteboardNotes) {
    const front = (note.englishSentence || '').trim();
    if (!front || existingFronts.has(front.toLowerCase())) continue;
    existingFronts.add(front.toLowerCase());
    deck.unshift(
      createFsrsCard({
        studentId,
        front,
        back: note.koreanTip || '선생님 칠판 판서 표현',
        source: `${topicLabel} (칠판 판서)`,
        kind: 'upgrade',
      })
    );
    added++;
  }

  if (added > 0) saveFsrsDeck(deck);
  return added;
}

/**
 * Play crisp native English TTS for flashcard & shadowing practice.
 */
export function speakEnglishNative(text, { rate = 0.95, lang = 'en-US' } = {}) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang;
  utter.rate = rate;

  const voices = window.speechSynthesis.getVoices();
  const preferred =
    voices.find((v) => v.lang.startsWith(lang) && /Google|Samantha|Daniel|Natural|Aria/i.test(v.name)) ||
    voices.find((v) => v.lang.startsWith('en'));
  if (preferred) utter.voice = preferred;

  window.speechSynthesis.speak(utter);
}

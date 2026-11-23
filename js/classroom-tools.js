/**
 * Gemini Live Native Tool Calling Declarations for Interactive Classroom Control.
 * Allows the AI native tutor to directly flip textbook pages, award gold stars,
 * write live corrections on the classroom whiteboard, pop up comprehension quizzes,
 * and express reactions with the 3D avatar!
 */
export function buildClassroomToolDeclarations() {
  return [
    {
      functionDeclarations: [
        {
          name: 'turn_textbook_page',
          description:
            'Flip the student’s on-screen interactive textbook to a specific 1-based page number (e.g. 1, 2, 3, or 4) when moving smoothly to the next section of the lesson.',
          parameters: {
            type: 'OBJECT',
            properties: {
              pageNumber: {
                type: 'INTEGER',
                description: '1-based page number to open (1 to 4)',
              },
              reason: {
                type: 'STRING',
                description: 'Short friendly reason, e.g. Moving to Story Reading',
              },
            },
            required: ['pageNumber'],
          },
        },
        {
          name: 'award_gold_star',
          description:
            'Award an animated Gold Star reward to the student whenever they speak a great full sentence, read well, use a new vocabulary word, or show awesome effort.',
          parameters: {
            type: 'OBJECT',
            properties: {
              reason: {
                type: 'STRING',
                description: 'Short warm praise in Korean or easy English (e.g., "완전한 문장으로 멋지게 대답했어요!")',
              },
            },
            required: ['reason'],
          },
        },
        {
          name: 'write_on_whiteboard',
          description:
            'Write a helpful English sentence pattern, key vocabulary phrase, or gentle upgraded sentence onto the student’s live classroom chalkboard so they can see and repeat it clearly.',
          parameters: {
            type: 'OBJECT',
            properties: {
              englishSentence: {
                type: 'STRING',
                description: 'Clear English expression or corrected sentence to display on the chalkboard',
              },
              koreanTip: {
                type: 'STRING',
                description: 'Brief easy Korean explanation or meaning',
              },
            },
            required: ['englishSentence', 'koreanTip'],
          },
        },
        {
          name: 'show_pop_quiz',
          description:
            'Display a quick interactive 3-option multiple choice mini-quiz card on the student’s screen to check comprehension or vocabulary during the lesson.',
          parameters: {
            type: 'OBJECT',
            properties: {
              question: {
                type: 'STRING',
                description: 'Short clear English quiz question',
              },
              options: {
                type: 'ARRAY',
                items: { type: 'STRING' },
                description: 'Exactly 3 short answer choices in English',
              },
              correctIndex: {
                type: 'INTEGER',
                description: '0-based index of the correct answer (0, 1, or 2)',
              },
              explanation: {
                type: 'STRING',
                description: 'Short friendly Korean explanation shown after answering',
              },
            },
            required: ['question', 'options', 'correctIndex'],
          },
        },
        {
          name: 'set_tutor_expression',
          description:
            'Update the 3D tutor avatar facial expression or hand gesture to react warmly to the student.',
          parameters: {
            type: 'OBJECT',
            properties: {
              mood: {
                type: 'STRING',
                description: 'One of: happy, neutral, love, surprised',
              },
              gesture: {
                type: 'STRING',
                description: 'Optional hand gesture: thumbup, handup, ok, none',
              },
            },
            required: ['mood'],
          },
        },
        {
          name: 'adjust_speaking_pace',
          description:
            'Notify the classroom UI whenever you adjust your speaking speed in response to the student saying you are too fast, asking to repeat, hesitating, or asking for a faster challenge.',
          parameters: {
            type: 'OBJECT',
            properties: {
              pace: {
                type: 'STRING',
                description: 'One of: slow, normal, fast',
              },
              reason: {
                type: 'STRING',
                description: 'Brief Korean note, e.g. "아이가 빠르다고 해서 천천히 또박또박 조절했어요"',
              },
            },
            required: ['pace'],
          },
        },
      ],
    },
  ];
}

/**
 * Play a warm, gentle celebratory chime when the child earns a Gold Star or gets a quiz right.
 */
export function playRewardChime(kind = 'star') {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const notes = kind === 'quiz' ? [523.25, 659.25, 783.99] : [587.33, 880, 1174.66];

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.085);
      gain.gain.setValueAtTime(0.001, now + i * 0.085);
      gain.gain.exponentialRampToValueAtTime(0.14, now + i * 0.085 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.085 + 0.32);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.085);
      osc.stop(now + i * 0.085 + 0.34);
    });

    setTimeout(() => ctx.close().catch(() => {}), 800);
  } catch {
    // AudioContext blocked or unavailable
  }
}

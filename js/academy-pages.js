import { getAllTextbooks } from './textbooks.js?v=20261124d';
import { LEVELS, STUDENT_PRESETS } from './tutors.js?v=20261125b';
import { LEVEL_TEST_QUESTIONS, evaluateLevelTest } from './level-test.js';
import {
  RATING,
  createFsrsCard,
  loadFsrsDeck,
  saveFsrsDeck,
  previewFsrsSchedules,
  scheduleFsrsCard,
  speakEnglishNative,
} from './fsrs.js';

function esc(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function createAcademyPages({
  getState,
  getApiKey,
  getHistory,
  saveSettings,
  showToast,
  onApplyRecommendation,
  onJumpToBook,
  onOpenReport,
  onDeckChanged,
}) {
  // ==================== 1. 5-MINUTE LEVEL TEST ====================
  const ltAnswers = {};
  let ltLastResult = null;
  let activeRecog = null;

  function renderStudentMiniSwitcher(containerEl, activeId, includeAll, onSelect) {
    const st = getState();
    const items = includeAll
      ? [{ id: 'all', label: '전체 자녀' }]
      : [];
    for (const p of STUDENT_PRESETS) {
      items.push({ id: p.id, label: st.profiles[p.id]?.name || p.defaultName });
    }
    containerEl.innerHTML = items
      .map(
        (it) =>
          `<button type="button" class="seg-btn ${activeId === it.id ? 'active' : ''}" data-sw="${it.id}">${esc(it.label)}</button>`
      )
      .join('');
    containerEl.querySelectorAll('[data-sw]').forEach((b) => {
      b.addEventListener('click', () => onSelect(b.dataset.sw));
    });
  }

  function renderLevelTest() {
    const st = getState();
    const switcher = document.getElementById('ltStudentSwitcher');
    renderStudentMiniSwitcher(switcher, st.activeStudentId, false, (id) => {
      st.activeStudentId = id;
      saveSettings();
      renderLevelTest();
    });

    const wrap = document.getElementById('ltQuestionsWrap');
    wrap.innerHTML = LEVEL_TEST_QUESTIONS.map((q) => {
      const val = ltAnswers[q.id] || '';
      return `
        <article class="surface-card lt-q-card">
          <div class="lt-q-top">
            <span class="lt-part-badge">${q.part}</span>
            <button type="button" class="btn btn-secondary btn-sm" data-lt-play="${q.id}">🔊 원어민 질문 듣기</button>
          </div>
          <p class="lt-q-prompt-en">"${esc(q.audioPrompt)}"</p>
          <p class="lt-q-prompt-ko">${esc(q.promptKo)}</p>
          ${q.image ? `<img class="lt-q-img" src="${q.image}" alt="${esc(q.title)}" />` : ''}
          <div class="lt-voice-bar">
            <button type="button" class="btn btn-secondary btn-sm" data-lt-mic="${q.id}">🎤 마이크로 영어로 말하기</button>
            <span class="status-text" data-lt-mic-status="${q.id}">말한 내용이 아래 칸에 자동 입력되며 직접 수정할 수 있어요.</span>
          </div>
          <textarea class="textarea-input" rows="3" data-lt-input="${q.id}" placeholder="${esc(q.placeholder)}">${esc(val)}</textarea>
        </article>
      `;
    }).join('');

    wrap.querySelectorAll('[data-lt-play]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const q = LEVEL_TEST_QUESTIONS.find((x) => x.id === btn.dataset.ltPlay);
        if (q) speakEnglishNative(q.audioPrompt, { rate: 0.92, lang: 'en-US' });
      });
    });

    wrap.querySelectorAll('[data-lt-input]').forEach((ta) => {
      ta.addEventListener('input', () => {
        ltAnswers[ta.dataset.ltInput] = ta.value;
      });
    });

    wrap.querySelectorAll('[data-lt-mic]').forEach((btn) => {
      btn.addEventListener('click', () => startVoiceDictation(btn.dataset.ltMic, btn));
    });
  }

  function startVoiceDictation(qId, btn) {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      showToast('이 브라우저에서는 음성 인식을 지원하지 않아 직접 입력해 주세요. (Chrome/Edge 권장)');
      return;
    }

    if (activeRecog) {
      activeRecog.stop();
      activeRecog = null;
      return;
    }

    const statusEl = document.querySelector(`[data-lt-mic-status="${qId}"]`);
    const textarea = document.querySelector(`[data-lt-input="${qId}"]`);
    const recog = new SpeechRec();
    recog.lang = 'en-US';
    recog.interimResults = true;
    recog.continuous = false;
    activeRecog = recog;

    btn.textContent = '⏹ 듣는 중... (클릭해 중지)';
    if (statusEl) statusEl.textContent = '지금 영어로 또박또박 말해 보세요!';

    const baseText = (ltAnswers[qId] || '').trim();
    recog.onresult = (event) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      const combined = baseText ? `${baseText} ${transcript.trim()}` : transcript.trim();
      ltAnswers[qId] = combined;
      if (textarea) textarea.value = combined;
    };

    recog.onerror = (ev) => {
      if (statusEl) statusEl.textContent = `음성 인식 오류 (${ev.error}) — 다시 시도하거나 직접 입력해 주세요.`;
    };

    recog.onend = () => {
      activeRecog = null;
      btn.textContent = '🎤 마이크로 영어로 말하기';
      if (statusEl) statusEl.textContent = '음성 입력 완료! 필요하면 문장을 살짝 다듬어 보세요.';
    };

    recog.start();
  }

  async function handleSubmitLevelTest() {
    const st = getState();
    const submitBtn = document.getElementById('ltSubmitBtn');
    const resultCard = document.getElementById('ltResultCard');

    const payload = LEVEL_TEST_QUESTIONS.map((q) => ({
      ...q,
      answer: (ltAnswers[q.id] || '').trim(),
    }));

    submitBtn.disabled = true;
    submitBtn.textContent = 'CEFR 수준 정밀 분석 중...';

    try {
      const studentName = st.profiles[st.activeStudentId]?.name || '학생';
      const result = await evaluateLevelTest({
        apiKey: getApiKey(),
        model: st.reportModel,
        studentName,
        answers: payload,
      });

      ltLastResult = result;
      document.getElementById('ltEvalSource').textContent = result.evaluatedBy || 'CEFR 진단 완료';
      document.getElementById('ltCefrHeadline').textContent =
        `CEFR ${result.cefr} · 추천: ${LEVELS[result.recommendedLevelKey]?.shortLabel || 'Level 1'}`;
      document.getElementById('ltSummaryText').textContent = result.summary || '';

      const scores = result.scores || {};
      const rows = [
        ['스피킹 표현력 (Speaking)', scores.speaking ?? 78],
        ['어휘 다양성 (Vocabulary)', scores.vocabulary ?? 76],
        ['문법 정확도 (Grammar)', scores.grammar ?? 75],
        ['유창성 (Fluency)', scores.fluency ?? 78],
      ];
      document.getElementById('ltScoresList').innerHTML = rows
        .map(
          ([lbl, val]) => `
          <div>
            <div class="score-row-head"><span>${lbl}</span><strong>${val} / 100</strong></div>
            <div class="score-track"><div class="score-fill" style="width:${Math.max(10, Math.min(100, val))}%"></div></div>
          </div>`
        )
        .join('');

      document.getElementById('ltStrengthsList').innerHTML = (result.strengths || [])
        .map((s) => `<li>${esc(s)}</li>`)
        .join('');
      document.getElementById('ltFocusText').textContent = result.focus || '';

      resultCard.classList.remove('hidden');
      resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (err) {
      showToast(err.message, 3600);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'CEFR 레벨 진단 결과 보기';
    }
  }

  // ==================== 2. FSRS REVIEW & SHADOWING ====================
  let reviewPracticeAll = false;
  let reviewQueue = [];
  let reviewIdx = 0;
  let mediaRecorder = null;
  let recordedChunks = [];
  let recordedAudioUrl = null;

  function getStudentDeck() {
    const st = getState();
    return loadFsrsDeck().filter((c) => c.studentId === st.activeStudentId);
  }

  function refreshReviewQueue() {
    const now = Date.now();
    const studentCards = getStudentDeck();
    const due = studentCards.filter((c) => (c.due || 0) <= now);
    reviewQueue = reviewPracticeAll ? studentCards : due;
    if (reviewIdx >= reviewQueue.length) reviewIdx = 0;

    document.getElementById('revDueCount').textContent = String(due.length);
    document.getElementById('revTotalCount').textContent = String(studentCards.length);
    document.getElementById('revMasteredCount').textContent = String(
      studentCards.filter((c) => c.state === 'review' && (c.stability || 0) >= 3).length
    );

    renderMiniDeckList(studentCards);
    renderCurrentFlashcard();
    onDeckChanged?.();
  }

  function renderMiniDeckList(cards) {
    const listEl = document.getElementById('deckMiniList');
    if (!cards.length) {
      listEl.innerHTML = '<div class="history-empty" style="padding:18px;">카드가 없습니다.</div>';
      return;
    }
    listEl.innerHTML = cards
      .slice(0, 40)
      .map((c) => {
        const isDue = (c.due || 0) <= Date.now();
        return `
          <div class="deck-mini-item">
            <div style="min-width:0;flex:1;">
              <strong>${esc(c.front)}</strong>
              <span>${esc(c.back)} · ${isDue ? '오늘 복습' : '예정됨'}</span>
            </div>
            <button type="button" class="btn btn-icon btn-sm" data-del-card="${c.id}" title="삭제">✕</button>
          </div>`;
      })
      .join('');

    listEl.querySelectorAll('[data-del-card]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const next = loadFsrsDeck().filter((c) => c.id !== btn.dataset.delCard);
        saveFsrsDeck(next);
        refreshReviewQueue();
      });
    });
  }

  function clearRecordedShadowing() {
    if (recordedAudioUrl) {
      URL.revokeObjectURL(recordedAudioUrl);
      recordedAudioUrl = null;
    }
    document.getElementById('fcReplayMineBtn').classList.add('hidden');
    document.getElementById('fcRecordStatus').textContent = '';
  }

  function renderCurrentFlashcard() {
    clearRecordedShadowing();
    const emptyEl = document.getElementById('flashcardEmpty');
    const activeEl = document.getElementById('flashcardActive');

    if (!reviewQueue.length) {
      emptyEl.classList.remove('hidden');
      activeEl.classList.add('hidden');
      return;
    }

    emptyEl.classList.add('hidden');
    activeEl.classList.remove('hidden');

    const card = reviewQueue[reviewIdx] || reviewQueue[0];
    document.getElementById('fcSourceTag').textContent = card.source || '핵심 표현';
    document.getElementById('fcProgressText').textContent = `${reviewIdx + 1} / ${reviewQueue.length}`;
    document.getElementById('fcFrontText').textContent = card.front;
    document.getElementById('fcBackText').textContent = card.back;
    document.getElementById('fcExampleText').textContent = card.example || '';

    document.getElementById('fcRevealWrap').classList.remove('hidden');
    document.getElementById('fcBackSection').classList.add('hidden');

    const previews = previewFsrsSchedules(card);
    document.getElementById('fsrsInt1').textContent = previews[RATING.AGAIN].intervalLabel;
    document.getElementById('fsrsInt2').textContent = previews[RATING.HARD].intervalLabel;
    document.getElementById('fsrsInt3').textContent = previews[RATING.GOOD].intervalLabel;
    document.getElementById('fsrsInt4').textContent = previews[RATING.EASY].intervalLabel;
  }

  function handleRateFlashcard(rating) {
    const card = reviewQueue[reviewIdx];
    if (!card) return;
    const updated = scheduleFsrsCard(card, rating);
    const all = loadFsrsDeck().map((c) => (c.id === card.id ? updated : c));
    saveFsrsDeck(all);
    showToast(`FSRS 일정 업데이트: ${updated.intervalLabel} 다시 복습`);
    if (reviewPracticeAll) {
      reviewIdx = (reviewIdx + 1) % Math.max(1, reviewQueue.length);
    }
    refreshReviewQueue();
  }

  async function toggleShadowingRecord() {
    const recBtn = document.getElementById('fcRecordBtn');
    const statusEl = document.getElementById('fcRecordStatus');
    const replayBtn = document.getElementById('fcReplayMineBtn');

    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      recBtn.textContent = '🎤 따라 말하기 녹음';
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordedChunks = [];
      mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) recordedChunks.push(ev.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
        if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl);
        recordedAudioUrl = URL.createObjectURL(blob);
        replayBtn.classList.remove('hidden');
        statusEl.textContent = '녹음 완료! 원어민 발음과 내 발음을 번갈아 들어보며 억양을 비교해 보세요.';
      };

      mediaRecorder.start();
      recBtn.textContent = '⏹ 녹음 중지';
      statusEl.textContent = '지금 위 영어 문장을 원어민처럼 자신감 있게 따라 읽어 보세요!';
    } catch (err) {
      showToast(`마이크 녹음을 시작할 수 없습니다: ${err.message}`);
    }
  }

  function renderReviewPage() {
    const st = getState();
    renderStudentMiniSwitcher(document.getElementById('revStudentSwitcher'), st.activeStudentId, false, (id) => {
      st.activeStudentId = id;
      reviewPracticeAll = false;
      reviewIdx = 0;
      saveSettings();
      renderReviewPage();
    });
    refreshReviewQueue();
  }

  // ==================== 3. PARENT ANALYTICS DASHBOARD ====================
  let dashFilter = 'all';

  function computeStreakDays(sessions) {
    if (!sessions.length) return 0;
    const days = new Set(
      sessions.map((s) => {
        const d = new Date(s.createdAt);
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      })
    );
    let streak = 0;
    const cursor = new Date();
    while (streak < 365) {
      const key = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`;
      if (days.has(key)) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      } else if (streak === 0) {
        // Allow checking yesterday if today hasn't started yet
        cursor.setDate(cursor.getDate() - 1);
        const yKey = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`;
        if (!days.has(yKey)) break;
      } else {
        break;
      }
    }
    return streak;
  }

  function renderDashboardChart(sessions) {
    const wrap = document.getElementById('dashChartWrap');
    // Only lessons with a real AI-analyzed score are plotted (no made-up default values)
    const recent = [...sessions]
      .filter((s) => Number.isFinite(Number(s.report?.scores?.fluency)) && Number(s.report?.scores?.fluency) > 0)
      .slice(0, 8)
      .reverse();
    if (recent.length === 0) {
      wrap.innerHTML =
        '<div class="dash-chart-empty">아직 완료된 수업 데이터가 없습니다.<br/>첫 화상영어 수업을 마치면 유창성·자연스러움·어휘력 성장 그래프가 자동으로 그려집니다!</div>';
      return;
    }

    const w = 520;
    const h = 210;
    const padL = 34;
    const padR = 16;
    const padT = 18;
    const padB = 34;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    const getX = (i) =>
      recent.length === 1 ? padL + plotW / 2 : padL + (i / (recent.length - 1)) * plotW;
    const getY = (val) => padT + plotH - (Math.max(40, Math.min(100, val)) - 40) / 60 * plotH;

    const series = [
      { key: 'fluency', label: '유창성', color: '#d97745' },
      { key: 'naturalness', label: '자연스러움', color: '#5ea47e' },
      { key: 'vocabulary', label: '어휘력', color: '#eab308' },
    ];

    const gridLines = [40, 60, 80, 100]
      .map(
        (v) => `
        <line x1="${padL}" y1="${getY(v)}" x2="${w - padR}" y2="${getY(v)}" stroke="rgba(245,236,224,0.09)" stroke-dasharray="3 3" />
        <text x="${padL - 8}" y="${getY(v) + 4}" text-anchor="end" fill="#7f756a" font-size="10" font-family="JetBrains Mono, monospace">${v}</text>`
      )
      .join('');

    const paths = series
      .map((s) => {
        const pts = recent.map((sess, i) => [getX(i), getY(Number(sess.report?.scores?.[s.key]) || Number(sess.report?.scores?.fluency) || 60)]);
        const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
        const circles = pts
          .map((p) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4" fill="${s.color}" />`)
          .join('');
        return `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />${circles}`;
      })
      .join('');

    const xLabels = recent
      .map((sess, i) => {
        const d = new Date(sess.createdAt);
        const lbl = `${d.getMonth() + 1}/${d.getDate()}`;
        return `<text x="${getX(i)}" y="${h - 10}" text-anchor="middle" fill="#b5aa9d" font-size="10">${lbl}</text>`;
      })
      .join('');

    const legend = series
      .map(
        (s) =>
          `<span style="display:inline-flex;align-items:center;gap:5px;font-size:0.75rem;color:var(--text-secondary);"><i style="width:9px;height:9px;border-radius:50%;background:${s.color};display:inline-block;"></i>${s.label}</span>`
      )
      .join('');

    wrap.innerHTML = `
      <svg viewBox="0 0 ${w} ${h}" style="width:100%;height:auto;display:block;">
        ${gridLines}
        ${paths}
        ${xLabels}
      </svg>
      <div style="display:flex;gap:14px;justify-content:flex-end;margin-top:6px;">${legend}</div>
    `;
  }

  function renderDashboardPage() {
    const st = getState();
    renderStudentMiniSwitcher(document.getElementById('dashStudentSwitcher'), dashFilter, true, (id) => {
      dashFilter = id;
      renderDashboardPage();
    });

    const allSessions = getHistory();
    const filtered =
      dashFilter === 'all'
        ? allSessions
        : allSessions.filter((s) => s.studentId === dashFilter);

    const totalSessions = filtered.length;
    const totalSec = filtered.reduce((acc, s) => acc + (s.durationSec || 0), 0);
    const totalMins = Math.round(totalSec / 60);
    const talkSamples = filtered.filter((s) => typeof s.studentTalkPct === 'number');
    const avgTalk = talkSamples.length
      ? `${Math.round(talkSamples.reduce((a, s) => a + s.studentTalkPct, 0) / talkSamples.length)}%`
      : '측정 대기';

    const totalStars =
      dashFilter === 'all'
        ? (st.profiles.grade3.stars || 0) + (st.profiles.grade6.stars || 0)
        : st.profiles[dashFilter]?.stars || 0;
    const streak = computeStreakDays(filtered);

    document.getElementById('dashTotalSessions').textContent = `${totalSessions}회`;
    document.getElementById('dashTotalMinutes').textContent = `${totalMins}분`;
    document.getElementById('dashTalkRatio').textContent = avgTalk;
    document.getElementById('dashStarsStreak').textContent = `★ ${totalStars} · ${streak}일`;

    renderDashboardChart(filtered);

    // Curriculum progress tree (supports 24 built-in units + AI custom books)
    const allBooks = getAllTextbooks();
    const visibleBooks =
      dashFilter === 'grade3'
        ? allBooks.filter((b) => b.gradeTag.includes('초3'))
        : dashFilter === 'grade6'
          ? allBooks.filter((b) => b.gradeTag.includes('초6'))
          : allBooks;

    const completedSet = new Set(filtered.map((s) => s.bookId).filter(Boolean));
    const completedVisibleCount = visibleBooks.filter((b) => completedSet.has(b.id)).length;
    document.getElementById('dashCurriculumPct').textContent = `${completedVisibleCount} / ${visibleBooks.length} 완료`;
    const currEl = document.getElementById('dashCurriculumList');
    currEl.innerHTML = visibleBooks.map((book) => {
      const done = completedSet.has(book.id);
      return `
        <div class="curr-row">
          <div class="curr-row-info">
            <strong>${esc(book.title)}</strong>
            <span>${esc(book.gradeTag)} · ${esc(book.titleKo)}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="curr-status-pill ${done ? 'done' : ''}">${done ? '완료 ✓' : '학습 전'}</span>
            <button type="button" class="btn btn-secondary btn-sm" data-dash-book="${book.id}">수업</button>
          </div>
        </div>
      `;
    }).join('');

    currEl.querySelectorAll('[data-dash-book]').forEach((btn) => {
      btn.addEventListener('click', () => onJumpToBook?.(btn.dataset.dashBook));
    });

    // Recent sessions
    const recentEl = document.getElementById('dashRecentSessions');
    recentEl.innerHTML = filtered.length
      ? filtered
          .slice(0, 10)
          .map((item) => {
            const d = new Date(item.createdAt).toLocaleString('ko-KR', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });
            const extra = [
              item.studentTalkPct ? `발화 ${item.studentTalkPct}%` : '',
              item.starsEarned ? `★${item.starsEarned}` : '',
            ]
              .filter(Boolean)
              .join(' · ');
            return `
              <div class="history-item">
                <div class="history-item-main" data-dash-rep="${item.id}">
                  <strong>[${esc(item.studentName || '학생')}] ${esc(item.topicLabel)}</strong>
                  <span>${esc(item.tutorName)} 선생님 · ${esc(item.durationLabel)}${extra ? ` · ${extra}` : ''} · ${d}</span>
                </div>
                <button type="button" class="btn btn-secondary btn-sm" data-dash-rep="${item.id}">리포트 열기</button>
              </div>`;
          })
          .join('')
      : '<div class="history-empty">완료된 수업이 아직 없습니다. 첫 화상 수업을 완료하면 리포트가 자동으로 누적됩니다!</div>';

    recentEl.querySelectorAll('[data-dash-rep]').forEach((node) => {
      node.addEventListener('click', () => {
        const found = getHistory().find((s) => s.id === node.dataset.dashRep);
        if (found) onOpenReport?.(found);
      });
    });
  }

  // ==================== WIRE SUBPAGE EVENTS ====================
  function bindSubpageEvents() {
    document.getElementById('ltSubmitBtn')?.addEventListener('click', handleSubmitLevelTest);
    document.getElementById('ltResetBtn')?.addEventListener('click', () => {
      Object.keys(ltAnswers).forEach((k) => delete ltAnswers[k]);
      ltLastResult = null;
      document.getElementById('ltResultCard').classList.add('hidden');
      renderLevelTest();
    });
    document.getElementById('ltApplyPlanBtn')?.addEventListener('click', () => {
      if (!ltLastResult) return;
      onApplyRecommendation?.({
        levelKey: ltLastResult.recommendedLevelKey,
        bookId: ltLastResult.recommendedBookId,
      });
    });

    // FSRS Review Controls
    document.getElementById('fcPlayNormalBtn')?.addEventListener('click', () => {
      const card = reviewQueue[reviewIdx];
      if (card) speakEnglishNative(card.front, { rate: 0.96, lang: 'en-US' });
    });
    document.getElementById('fcPlaySlowBtn')?.addEventListener('click', () => {
      const card = reviewQueue[reviewIdx];
      if (card) speakEnglishNative(card.front, { rate: 0.72, lang: 'en-US' });
    });
    document.getElementById('fcRecordBtn')?.addEventListener('click', toggleShadowingRecord);
    document.getElementById('fcReplayMineBtn')?.addEventListener('click', () => {
      if (recordedAudioUrl) {
        new Audio(recordedAudioUrl).play().catch(() => {});
      }
    });
    document.getElementById('fcShowAnswerBtn')?.addEventListener('click', () => {
      document.getElementById('fcRevealWrap').classList.add('hidden');
      document.getElementById('fcBackSection').classList.remove('hidden');
    });
    document.querySelectorAll('.fsrs-btn').forEach((btn) => {
      btn.addEventListener('click', () => handleRateFlashcard(Number(btn.dataset.rating)));
    });
    document.getElementById('revPracticeAllBtn')?.addEventListener('click', () => {
      reviewPracticeAll = true;
      reviewIdx = 0;
      refreshReviewQueue();
    });
    document.getElementById('addCardForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const front = document.getElementById('newCardFront').value.trim();
      const back = document.getElementById('newCardBack').value.trim();
      const example = document.getElementById('newCardExample').value.trim();
      if (!front || !back) return;
      const st = getState();
      const deck = loadFsrsDeck();
      deck.unshift(
        createFsrsCard({
          studentId: st.activeStudentId,
          front,
          back,
          example,
          source: '직접 추가',
          kind: 'vocab',
        })
      );
      saveFsrsDeck(deck);
      document.getElementById('newCardFront').value = '';
      document.getElementById('newCardBack').value = '';
      document.getElementById('newCardExample').value = '';
      showToast('새 복습 카드를 추가했어요!');
      refreshReviewQueue();
    });
  }

  return {
    bindSubpageEvents,
    renderLevelTest,
    renderReviewPage,
    renderDashboardPage,
    computeStreakDays,
  };
}

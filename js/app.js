import {
  TUTORS,
  STUDENT_PRESETS,
  LEVELS,
  CORRECTION_MODES,
  buildSystemInstruction,
} from './tutors.js';
import { TEXTBOOKS } from './textbooks.js';
import { GeminiLiveClient, PcmAudioPlayer } from './gemini-live.js';
import { Avatar3DController } from './avatar-3d.js';
import { buildClassroomToolDeclarations, playRewardChime } from './classroom-tools.js';
import { ClassroomWhiteboard } from './whiteboard.js';
import { loadFsrsDeck, ingestLessonIntoFsrsDeck } from './fsrs.js';
import { createAcademyPages } from './academy-pages.js';
import {
  requestSpeakingHints,
  translateUtterance,
  generateStudyReport,
  reportToMarkdown,
} from './feedback.js';

const STORAGE_KEYS = {
  API_KEY: 'fluentcam_gemini_api_key',
  SETTINGS: 'fluentcam_academy_pro_v3',
  HISTORY: 'fluentcam_history_v1',
};

const SUBTITLE_MODES = [
  { key: 'visible', label: '자막 켜짐' },
  { key: 'blur', label: '리스닝 블러' },
  { key: 'hidden', label: '자막 꺼짐' },
];

const defaultProfiles = {
  grade3: {
    name: '초3 학생',
    levelKey: 'elem3_mid',
    correctionKey: 'gentle',
    bookMode: 'library',
    selectedBookId: 'magic-zoo',
    stars: 0,
  },
  grade6: {
    name: '초6 학생',
    levelKey: 'elem6_high',
    correctionKey: 'gentle',
    bookMode: 'library',
    selectedBookId: 'future-school-2050',
    stars: 0,
  },
};

const state = {
  activeView: 'lobby',
  activeStudentId: 'grade3',
  profiles: structuredClone(defaultProfiles),

  selectedTutorId: 'maya',
  levelKey: 'elem3_mid',
  correctionKey: 'gentle',
  avatarMode: '3d', // '3d' | 'portrait'
  enableTools: true,

  // Textbook / Mode state
  bookFilter: 'all',
  bookMode: 'library',
  selectedBookId: 'magic-zoo',
  customBookTitle: '',
  customBookContent: '',
  customTopic: '',

  // Preview modal
  previewBookId: null,
  previewPageIdx: 0,

  // Model & streaming
  liveModel: 'gemini-3.8-live',
  customLiveModel: '',
  reportModel: 'gemini-3.5-flash-lite',
  videoIntervalMs: 1200,
  shareCamera: true,

  // Lobby preview media
  lobbyStream: null,
  lobbyAudioCtx: null,
  lobbyMicRaf: null,

  // Active call resources
  inCall: false,
  callStream: null,
  captureAudioCtx: null,
  captureWorkletNode: null,
  liveClient: null,
  audioPlayer: null,
  avatar3d: null,
  using3dInCall: false,
  videoTimerId: null,
  callTimerId: null,
  callStartMs: 0,
  waveRafId: null,
  micMuted: false,
  camEnabled: true,
  subtitleModeIdx: 0,

  // Live Classroom Metrics & Tools
  studentSpeakingMs: 0,
  sessionStarsEarned: 0,
  sessionWhiteboardNotes: [],
  activeQuiz: null,

  // Classroom active book
  activeCallTextbook: null,
  activeCallPageIdx: 0,
  activeSidebarTab: 'book',

  // Transcript state
  transcript: [],
  activeUserTurn: null,
  activeTutorTurn: null,

  // Active report & history filter
  currentReportSession: null,
  historyStudentFilter: 'all',
};

const el = {
  topHeader: document.getElementById('topHeader'),
  brandHomeBtn: document.getElementById('brandHomeBtn'),
  openHistoryBtn: document.getElementById('openHistoryBtn'),
  historyCountBadge: document.getElementById('historyCountBadge'),
  reviewDueBadge: document.getElementById('reviewDueBadge'),
  headerStarCount: document.getElementById('headerStarCount'),

  lobbyView: document.getElementById('lobbyView'),
  levelTestView: document.getElementById('levelTestView'),
  reviewView: document.getElementById('reviewView'),
  dashboardView: document.getElementById('dashboardView'),

  studentPresetGrid: document.getElementById('studentPresetGrid'),
  studentNameInput: document.getElementById('studentNameInput'),
  profileStreakText: document.getElementById('profileStreakText'),

  lobbyVideo: document.getElementById('lobbyVideo'),
  lobbyVideoFallback: document.getElementById('lobbyVideoFallback'),
  lobbyMicBar: document.getElementById('lobbyMicBar'),
  previewDeviceStatus: document.getElementById('previewDeviceStatus'),
  toggleLobbyCamBtn: document.getElementById('toggleLobbyCamBtn'),
  shareCamCheckbox: document.getElementById('shareCamCheckbox'),

  apiKeyInput: document.getElementById('apiKeyInput'),
  toggleApiKeyVisBtn: document.getElementById('toggleApiKeyVisBtn'),
  avatarModePills: document.getElementById('avatarModePills'),
  liveModelSelect: document.getElementById('liveModelSelect'),
  customLiveModelInput: document.getElementById('customLiveModelInput'),
  reportModelSelect: document.getElementById('reportModelSelect'),
  videoIntervalSelect: document.getElementById('videoIntervalSelect'),
  enableToolsCheckbox: document.getElementById('enableToolsCheckbox'),

  quickLevelTestBtn: document.getElementById('quickLevelTestBtn'),
  levelPills: document.getElementById('levelPills'),
  correctionCards: document.getElementById('correctionCards'),

  selectedBookSummary: document.getElementById('selectedBookSummary'),
  bookFilterTabs: document.getElementById('bookFilterTabs'),
  textbookGrid: document.getElementById('textbookGrid'),
  customBookPanel: document.getElementById('customBookPanel'),
  customBookTitleInput: document.getElementById('customBookTitleInput'),
  customBookContentInput: document.getElementById('customBookContentInput'),
  freeTalkPanel: document.getElementById('freeTalkPanel'),
  customTopicInput: document.getElementById('customTopicInput'),

  tutorGrid: document.getElementById('tutorGrid'),
  selectedTutorSummary: document.getElementById('selectedTutorSummary'),
  lobbyError: document.getElementById('lobbyError'),
  startCallBtn: document.getElementById('startCallBtn'),
  previewSampleReportBtn: document.getElementById('previewSampleReportBtn'),

  callView: document.getElementById('callView'),
  tutorStageCard: document.getElementById('tutorStageCard'),
  callAvatar3dMount: document.getElementById('callAvatar3dMount'),
  avatar3dStatusBadge: document.getElementById('avatar3dStatusBadge'),
  callTutorImg: document.getElementById('callTutorImg'),
  callTutorName: document.getElementById('callTutorName'),
  callTutorState: document.getElementById('callTutorState'),
  callStarCount: document.getElementById('callStarCount'),
  callStudentChip: document.getElementById('callStudentChip'),
  visionSharingBadge: document.getElementById('visionSharingBadge'),
  callTimer: document.getElementById('callTimer'),
  tutorWaveCanvas: document.getElementById('tutorWaveCanvas'),
  subtitleOverlay: document.getElementById('subtitleOverlay'),
  subtitleSpeaker: document.getElementById('subtitleSpeaker'),
  subtitleText: document.getElementById('subtitleText'),
  callUserVideo: document.getElementById('callUserVideo'),
  callUserCamOff: document.getElementById('callUserCamOff'),
  pipStudentLabel: document.getElementById('pipStudentLabel'),
  sendSnapshotBtn: document.getElementById('sendSnapshotBtn'),

  chalkboardBanner: document.getElementById('chalkboardBanner'),
  chalkboardSentence: document.getElementById('chalkboardSentence'),
  chalkboardTip: document.getElementById('chalkboardTip'),
  closeChalkboardBtn: document.getElementById('closeChalkboardBtn'),

  starCelebrateBanner: document.getElementById('starCelebrateBanner'),
  starCelebrateReason: document.getElementById('starCelebrateReason'),

  popQuizCard: document.getElementById('popQuizCard'),
  popQuizQuestion: document.getElementById('popQuizQuestion'),
  popQuizOptions: document.getElementById('popQuizOptions'),
  popQuizFeedback: document.getElementById('popQuizFeedback'),
  closePopQuizBtn: document.getElementById('closePopQuizBtn'),

  micToggleBtn: document.getElementById('micToggleBtn'),
  micToggleLabel: document.getElementById('micToggleLabel'),
  micOnIcon: document.getElementById('micOnIcon'),
  micOffIcon: document.getElementById('micOffIcon'),
  callMicRing: document.getElementById('callMicRing'),

  camToggleBtn: document.getElementById('camToggleBtn'),
  camToggleLabel: document.getElementById('camToggleLabel'),
  camOnIcon: document.getElementById('camOnIcon'),
  camOffIcon: document.getElementById('camOffIcon'),

  toggleAvatarViewBtn: document.getElementById('toggleAvatarViewBtn'),
  toggleAvatarViewLabel: document.getElementById('toggleAvatarViewLabel'),
  subtitleModeBtn: document.getElementById('subtitleModeBtn'),
  subtitleModeLabel: document.getElementById('subtitleModeLabel'),
  toggleSidebarBtn: document.getElementById('toggleSidebarBtn'),
  closeSidebarBtn: document.getElementById('closeSidebarBtn'),
  expandPanelBtn: document.getElementById('expandPanelBtn'),
  callSidebar: document.getElementById('callSidebar'),
  endCallBtn: document.getElementById('endCallBtn'),

  tabBookBtn: document.getElementById('tabBookBtn'),
  tabChatBtn: document.getElementById('tabChatBtn'),
  callBookPane: document.getElementById('callBookPane'),
  callChatPane: document.getElementById('callChatPane'),
  callBookStepBadge: document.getElementById('callBookStepBadge'),
  callBookHeading: document.getElementById('callBookHeading'),
  callBookScroll: document.getElementById('callBookScroll'),
  callBookNav: document.getElementById('callBookNav'),
  prevBookPageBtn: document.getElementById('prevBookPageBtn'),
  nextBookPageBtn: document.getElementById('nextBookPageBtn'),
  bookPageDots: document.getElementById('bookPageDots'),

  wbToggleBtn: document.getElementById('wbToggleBtn'),
  wbColorsGroup: document.getElementById('wbColorsGroup'),
  wbHighlighterBtn: document.getElementById('wbHighlighterBtn'),
  wbEraserBtn: document.getElementById('wbEraserBtn'),
  wbUndoBtn: document.getElementById('wbUndoBtn'),
  wbClearBtn: document.getElementById('wbClearBtn'),
  wbSendSketchBtn: document.getElementById('wbSendSketchBtn'),
  bookWhiteboardCanvas: document.getElementById('bookWhiteboardCanvas'),

  callTopicSub: document.getElementById('callTopicSub'),
  transcriptList: document.getElementById('transcriptList'),
  helperTray: document.getElementById('helperTray'),
  helperTrayTitle: document.getElementById('helperTrayTitle'),
  helperTrayBody: document.getElementById('helperTrayBody'),
  closeHelperTrayBtn: document.getElementById('closeHelperTrayBtn'),
  getHintBtn: document.getElementById('getHintBtn'),
  translateLastBtn: document.getElementById('translateLastBtn'),
  chatTextForm: document.getElementById('chatTextForm'),
  chatTextInput: document.getElementById('chatTextInput'),

  reportView: document.getElementById('reportView'),
  reportLoading: document.getElementById('reportLoading'),
  reportContent: document.getElementById('reportContent'),
  reportTutorImg: document.getElementById('reportTutorImg'),
  reportPraiseBadge: document.getElementById('reportPraiseBadge'),
  reportHeadline: document.getElementById('reportHeadline'),
  reportMetaLine: document.getElementById('reportMetaLine'),
  reportSummaryText: document.getElementById('reportSummaryText'),
  reportNextTopicText: document.getElementById('reportNextTopicText'),
  reportScoresList: document.getElementById('reportScoresList'),
  correctionsCount: document.getElementById('correctionsCount'),
  reportCorrectionsList: document.getElementById('reportCorrectionsList'),
  reportVocabGrid: document.getElementById('reportVocabGrid'),
  reportFullTranscript: document.getElementById('reportFullTranscript'),
  goFsrsFromReportBtn: document.getElementById('goFsrsFromReportBtn'),
  copyMarkdownBtn: document.getElementById('copyMarkdownBtn'),
  downloadMarkdownBtn: document.getElementById('downloadMarkdownBtn'),
  backToLobbyBtn: document.getElementById('backToLobbyBtn'),

  bookPreviewModal: document.getElementById('bookPreviewModal'),
  bookPreviewMeta: document.getElementById('bookPreviewMeta'),
  bookPreviewTitle: document.getElementById('bookPreviewTitle'),
  bookPreviewBody: document.getElementById('bookPreviewBody'),
  closeBookPreviewBtn: document.getElementById('closeBookPreviewBtn'),
  previewPrevPageBtn: document.getElementById('previewPrevPageBtn'),
  previewNextPageBtn: document.getElementById('previewNextPageBtn'),
  previewPageCounter: document.getElementById('previewPageCounter'),
  selectPreviewBookBtn: document.getElementById('selectPreviewBookBtn'),

  historyModal: document.getElementById('historyModal'),
  closeHistoryBtn: document.getElementById('closeHistoryBtn'),
  historyFilterBar: document.getElementById('historyFilterBar'),
  historyList: document.getElementById('historyList'),

  toast: document.getElementById('toast'),
  captureCanvas: document.getElementById('captureCanvas'),
};

const whiteboard = new ClassroomWhiteboard(el.bookWhiteboardCanvas);

// ==================== HELPERS ====================
let toastTimer = null;
function showToast(msg, duration = 2600) {
  el.toast.textContent = msg;
  el.toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.add('hidden'), duration);
}

function showLobbyError(msg) {
  if (!msg) {
    el.lobbyError.classList.add('hidden');
    el.lobbyError.textContent = '';
    return;
  }
  el.lobbyError.textContent = msg;
  el.lobbyError.classList.remove('hidden');
}

function getSelectedTutor() {
  return TUTORS.find((t) => t.id === state.selectedTutorId) || TUTORS[0];
}

function getActiveProfile() {
  return state.profiles[state.activeStudentId] || state.profiles.grade3;
}

function getStudentDisplayName() {
  const name = getActiveProfile().name?.trim();
  if (name) return name;
  return state.activeStudentId === 'grade6' ? '초6 학생' : '초3 학생';
}

function getSelectedTextbookObj() {
  if (state.bookMode === 'freetalk') return null;
  if (state.bookMode === 'custom') {
    const content = state.customBookContent.trim();
    if (!content) return null;
    return {
      id: 'custom-book',
      gradeTag: state.activeStudentId === 'grade6' ? '초6 직접 교재' : '초3 직접 교재',
      levelRange: LEVELS[state.levelKey]?.shortLabel || '',
      title: state.customBookTitle.trim() || '직접 입력한 영어 교재',
      customContent: content,
      pages: [
        {
          step: 'Custom Lesson Material',
          heading: state.customBookTitle.trim() || '내 수업 지문',
          instructionKo: '선생님과 함께 지문을 읽고 궁금한 표현을 질문해 보세요.',
          readingTitle: state.customBookTitle.trim() || 'Reading Passage',
          readingParagraphs: content
            .split(/\n{2,}/)
            .map((p) => p.trim())
            .filter(Boolean),
        },
      ],
    };
  }
  return TEXTBOOKS.find((b) => b.id === state.selectedBookId) || TEXTBOOKS[0];
}

function getActiveLiveModel() {
  if (state.liveModel === 'custom') return state.customLiveModel.trim() || 'gemini-3.8-live';
  return state.liveModel;
}

function getLessonTitleLabel() {
  const book = getSelectedTextbookObj();
  if (book) return book.title;
  if (state.customTopic.trim()) return `프리토킹 · ${state.customTopic.trim()}`;
  return '자유 프리토킹';
}

function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function mergeTranscriptChunk(existing, incoming) {
  const prev = existing || '';
  const next = incoming || '';
  if (!prev) return next.trimStart();
  if (!next) return prev;
  if (next.startsWith(prev)) return next;
  const needsSpace =
    !/\s$/.test(prev) &&
    !/^[\s.,!?;:'"’”)\]]/.test(next) &&
    /[A-Za-z0-9가-힣]$/.test(prev) &&
    /^[A-Za-z0-9가-힣]/.test(next);
  return needsSpace ? `${prev} ${next}` : `${prev}${next}`;
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.HISTORY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(items) {
  localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(items.slice(0, 50)));
  updateBadges();
}

function updateBadges() {
  const hist = loadHistory();
  el.historyCountBadge.textContent = String(hist.length);
  const dueCount = loadFsrsDeck().filter(
    (c) => c.studentId === state.activeStudentId && (c.due || 0) <= Date.now()
  ).length;
  el.reviewDueBadge.textContent = String(dueCount);
  el.headerStarCount.textContent = String(getActiveProfile().stars || 0);

  const studentHist = hist.filter((h) => h.studentId === state.activeStudentId);
  const streak = academyPages.computeStreakDays(studentHist);
  el.profileStreakText.textContent = `연속 학습 ${streak}일 · ★ ${getActiveProfile().stars || 0}`;
}

function syncCurrentProfileFields() {
  const p = getActiveProfile();
  p.levelKey = state.levelKey;
  p.correctionKey = state.correctionKey;
  p.bookMode = state.bookMode;
  p.selectedBookId = state.selectedBookId;
}

function saveSettings() {
  syncCurrentProfileFields();
  localStorage.setItem(
    STORAGE_KEYS.SETTINGS,
    JSON.stringify({
      activeStudentId: state.activeStudentId,
      profiles: state.profiles,
      selectedTutorId: state.selectedTutorId,
      avatarMode: state.avatarMode,
      enableTools: state.enableTools,
      liveModel: state.liveModel,
      customLiveModel: state.customLiveModel,
      reportModel: state.reportModel,
      videoIntervalMs: state.videoIntervalMs,
      shareCamera: state.shareCamera,
      customBookTitle: state.customBookTitle,
      customBookContent: state.customBookContent,
    })
  );
  updateBadges();
}

function applyActiveProfileToState() {
  const p = getActiveProfile();
  state.levelKey = LEVELS[p.levelKey] ? p.levelKey : 'elem3_mid';
  state.correctionKey = CORRECTION_MODES[p.correctionKey] ? p.correctionKey : 'gentle';
  state.bookMode = p.bookMode || 'library';
  state.selectedBookId = TEXTBOOKS.some((b) => b.id === p.selectedBookId)
    ? p.selectedBookId
    : state.activeStudentId === 'grade6'
      ? 'future-school-2050'
      : 'magic-zoo';
}

function restoreSettings() {
  const savedKey = localStorage.getItem(STORAGE_KEYS.API_KEY);
  if (savedKey) el.apiKeyInput.value = savedKey;

  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) {
      applyActiveProfileToState();
      return;
    }
    const saved = JSON.parse(raw);
    if (saved.profiles) {
      state.profiles = {
        grade3: { ...defaultProfiles.grade3, ...(saved.profiles.grade3 || {}) },
        grade6: { ...defaultProfiles.grade6, ...(saved.profiles.grade6 || {}) },
      };
    }
    if (saved.activeStudentId && state.profiles[saved.activeStudentId]) {
      state.activeStudentId = saved.activeStudentId;
    }
    if (saved.selectedTutorId && TUTORS.some((t) => t.id === saved.selectedTutorId)) {
      state.selectedTutorId = saved.selectedTutorId;
    }
    if (saved.avatarMode === '3d' || saved.avatarMode === 'portrait') {
      state.avatarMode = saved.avatarMode;
    }
    if (typeof saved.enableTools === 'boolean') state.enableTools = saved.enableTools;
    if (saved.liveModel) state.liveModel = saved.liveModel;
    if (saved.customLiveModel) state.customLiveModel = saved.customLiveModel;
    if (saved.reportModel) state.reportModel = saved.reportModel;
    if (typeof saved.videoIntervalMs === 'number') state.videoIntervalMs = saved.videoIntervalMs;
    if (typeof saved.shareCamera === 'boolean') state.shareCamera = saved.shareCamera;
    if (typeof saved.customBookTitle === 'string') state.customBookTitle = saved.customBookTitle;
    if (typeof saved.customBookContent === 'string') state.customBookContent = saved.customBookContent;
  } catch {
    // ignore
  }
  applyActiveProfileToState();
}

function switchView(viewName) {
  state.activeView = viewName;
  el.lobbyView.classList.toggle('hidden', viewName !== 'lobby');
  el.levelTestView.classList.toggle('hidden', viewName !== 'leveltest');
  el.reviewView.classList.toggle('hidden', viewName !== 'review');
  el.dashboardView.classList.toggle('hidden', viewName !== 'dashboard');
  el.callView.classList.toggle('hidden', viewName !== 'call');
  el.reportView.classList.toggle('hidden', viewName !== 'report');
  el.topHeader.classList.toggle('hidden', viewName === 'call');

  document.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.nav === viewName);
  });

  if (viewName === 'lobby') renderAllLobby();
  if (viewName === 'leveltest') academyPages.renderLevelTest();
  if (viewName === 'review') academyPages.renderReviewPage();
  if (viewName === 'dashboard') academyPages.renderDashboardPage();
}

const academyPages = createAcademyPages({
  getState: () => state,
  getApiKey: () => el.apiKeyInput.value.trim(),
  getHistory: loadHistory,
  saveSettings,
  showToast,
  onApplyRecommendation: ({ levelKey, bookId }) => {
    if (LEVELS[levelKey]) state.levelKey = levelKey;
    if (TEXTBOOKS.some((b) => b.id === bookId)) {
      state.bookMode = 'library';
      state.bookFilter = 'all';
      state.selectedBookId = bookId;
    }
    saveSettings();
    switchView('lobby');
    showToast('CEFR 진단 추천 레벨과 교재를 바로 적용했어요!');
  },
  onJumpToBook: (bookId) => {
    state.bookMode = 'library';
    state.bookFilter = 'all';
    state.selectedBookId = bookId;
    saveSettings();
    switchView('lobby');
    showToast('선택한 교재로 바로 수업을 시작할 준비가 되었어요!');
  },
  onOpenReport: (session) => renderReportView(session),
  onDeckChanged: () => updateBadges(),
});

// ==================== SHARED TEXTBOOK PAGE RENDERER ====================
function renderBookPageMarkup(page, { interactive = false } = {}) {
  const sections = [];
  if (page.instructionKo) sections.push(`<p class="book-instruction">${escapeHtml(page.instructionKo)}</p>`);
  if (page.image) sections.push(`<img class="book-page-image" src="${page.image}" alt="${escapeHtml(page.heading || '')}" />`);

  if (Array.isArray(page.vocab) && page.vocab.length) {
    sections.push(`
      <div class="book-vocab-list">
        ${page.vocab
          .map(
            (v) => `
          <button type="button" class="book-vocab-item" ${interactive ? `data-ask-word="${escapeHtml(v.word)}"` : 'disabled'}>
            <div class="book-vocab-top"><strong>${escapeHtml(v.word)}</strong><span>${escapeHtml(v.meaning)}</span></div>
            <span class="book-vocab-ex">${escapeHtml(v.example || '')}</span>
          </button>`
          )
          .join('')}
      </div>
    `);
  }

  if (Array.isArray(page.readingParagraphs) && page.readingParagraphs.length) {
    sections.push(`
      <div class="book-reading-box">
        ${page.readingTitle ? `<h3>${escapeHtml(page.readingTitle)}</h3>` : ''}
        ${page.readingParagraphs.map((para) => `<p>${escapeHtml(para)}</p>`).join('')}
      </div>
    `);
  }

  if (Array.isArray(page.menuItems) && page.menuItems.length) {
    sections.push(`
      <div class="book-menu-list">
        ${page.menuItems
          .map(
            (m) => `
          <div class="book-menu-row">
            <div><strong>${escapeHtml(m.name)}</strong><span>${escapeHtml(m.desc)}</span></div>
            <span class="book-menu-price">${escapeHtml(m.price)}</span>
          </div>`
          )
          .join('')}
      </div>
    `);
  }

  if (Array.isArray(page.patterns) && page.patterns.length) {
    sections.push(`
      <div class="book-pattern-list">
        ${page.patterns.map((pt) => `<div class="book-pattern-item"><strong>${escapeHtml(pt.en)}</strong><span>${escapeHtml(pt.ko)}</span></div>`).join('')}
      </div>
    `);
  }

  if (Array.isArray(page.debatePros) && Array.isArray(page.debateCons)) {
    sections.push(`
      <div class="book-debate-grid">
        <div class="debate-col pros"><h4>찬성 근거 (Pros)</h4><ul>${page.debatePros.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul></div>
        <div class="debate-col cons"><h4>반대 근거 (Cons)</h4><ul>${page.debateCons.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul></div>
      </div>
    `);
  }

  if (Array.isArray(page.questions) && page.questions.length) {
    sections.push(`
      <div class="book-question-list">
        ${page.questions.map((q, idx) => `<div class="book-question-item"><strong>Q${idx + 1}.</strong> ${escapeHtml(q)}</div>`).join('')}
      </div>
    `);
  }

  if (Array.isArray(page.missionCards) && page.missionCards.length) {
    sections.push(`
      <div class="book-mission-list">
        ${page.missionCards.map((m) => `<div class="book-mission-item"><strong>${escapeHtml(m.label)}</strong><span>${escapeHtml(m.detail)}</span></div>`).join('')}
      </div>
    `);
  }

  if (Array.isArray(page.starters) && page.starters.length) {
    sections.push(`
      <div class="book-starters-box">
        <div class="book-starters-title">영어로 말문 트기 힌트 (Sentence Starters)</div>
        <div class="book-starter-chips">${page.starters.map((s) => `<div class="starter-chip">"${escapeHtml(s)}"</div>`).join('')}</div>
      </div>
    `);
  }

  return sections.join('');
}

// ==================== LOBBY RENDERING ====================
function renderStudentPresets() {
  el.studentPresetGrid.innerHTML = STUDENT_PRESETS.map((preset) => {
    const active = state.activeStudentId === preset.id;
    const savedProfile = state.profiles[preset.id];
    const levelShort = LEVELS[savedProfile.levelKey]?.shortLabel || '';
    return `
      <button type="button" class="student-preset-btn ${active ? 'active' : ''}" data-student-id="${preset.id}" role="radio" aria-checked="${active}">
        <span class="student-preset-grade">${preset.badge} · ${levelShort}</span>
        <strong>${escapeHtml(savedProfile.name || preset.defaultName)}</strong>
        <span class="desc">${preset.desc}</span>
      </button>
    `;
  }).join('');

  el.studentNameInput.value = getActiveProfile().name || '';

  el.studentPresetGrid.querySelectorAll('.student-preset-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      syncCurrentProfileFields();
      state.activeStudentId = btn.dataset.studentId;
      applyActiveProfileToState();
      if (state.bookMode === 'library' && (state.bookFilter === 'grade3' || state.bookFilter === 'grade6')) {
        state.bookFilter = state.activeStudentId;
      }
      saveSettings();
      renderAllLobby();
      showToast(`${getStudentDisplayName()} 프로필 설정을 불러왔어요.`);
    });
  });
}

function renderTextbooks() {
  const isCustomTab = state.bookFilter === 'custom';
  const isFreeTalkTab = state.bookFilter === 'freetalk';

  el.bookFilterTabs.querySelectorAll('.filter-tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.filter === state.bookFilter);
  });

  el.textbookGrid.classList.toggle('hidden', isCustomTab || isFreeTalkTab);
  el.customBookPanel.classList.toggle('hidden', !isCustomTab);
  el.freeTalkPanel.classList.toggle('hidden', !isFreeTalkTab);

  const completedBooks = new Set(
    loadHistory()
      .filter((s) => s.studentId === state.activeStudentId && s.bookId)
      .map((s) => s.bookId)
  );

  if (!isCustomTab && !isFreeTalkTab) {
    const filtered = TEXTBOOKS.filter((book) => {
      if (state.bookFilter === 'grade3') return book.gradeTag.includes('초3');
      if (state.bookFilter === 'grade6') return book.gradeTag.includes('초6');
      return true;
    });

    el.textbookGrid.innerHTML = filtered
      .map((book) => {
        const selected = state.bookMode === 'library' && state.selectedBookId === book.id;
        const isG6 = book.gradeTag.includes('초6');
        const done = completedBooks.has(book.id);
        return `
          <div class="book-card ${selected ? 'selected' : ''}" data-book-id="${book.id}" role="button" tabindex="0">
            <div class="book-cover-wrap">
              <img src="${book.cover}" alt="${escapeHtml(book.title)}" />
              <span class="book-grade-pill ${isG6 ? 'g6' : ''}">${book.gradeTag}</span>
              ${done ? '<span class="book-done-pill">완료 ✓</span>' : ''}
              <span class="book-selected-mark" aria-hidden="true">✓</span>
            </div>
            <div class="book-card-body">
              <span class="book-category">${book.category}</span>
              <h3>${escapeHtml(book.title)}</h3>
              <p class="book-subtitle">${escapeHtml(book.titleKo)}</p>
              <p class="book-desc">${escapeHtml(book.description)}</p>
              <div class="book-card-footer">
                <span class="book-pages-count">${book.pages.length}쪽 · ${book.levelRange}</span>
                <button type="button" class="btn btn-secondary btn-sm" data-preview-book="${book.id}">미리보기</button>
              </div>
            </div>
          </div>
        `;
      })
      .join('');

    el.textbookGrid.querySelectorAll('.book-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('[data-preview-book]')) return;
        state.bookMode = 'library';
        state.selectedBookId = card.dataset.bookId;
        saveSettings();
        renderTextbooks();
      });
    });

    el.textbookGrid.querySelectorAll('[data-preview-book]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openBookPreviewModal(btn.dataset.previewBook);
      });
    });
  }

  el.selectedBookSummary.textContent = getLessonTitleLabel();
}

function renderTutors() {
  el.tutorGrid.innerHTML = TUTORS.map((t) => {
    const selected = t.id === state.selectedTutorId;
    return `
      <button type="button" class="tutor-card ${selected ? 'selected' : ''}" data-tutor-id="${t.id}" role="radio" aria-checked="${selected}">
        <div class="tutor-thumb-wrap">
          <img src="${t.avatar}" alt="${t.name} 선생님" loading="eager" />
          <span class="tutor-accent-tag">${t.accentLabel}</span>
          <span class="tutor-selected-check" aria-hidden="true">✓</span>
        </div>
        <div class="tutor-card-body">
          <div class="tutor-card-top"><strong>${t.name}</strong><span>${t.origin}</span></div>
          <p class="tutor-specialty">${t.specialty}</p>
          <p class="tutor-bio">${t.bio}</p>
        </div>
      </button>
    `;
  }).join('');

  const cur = getSelectedTutor();
  el.selectedTutorSummary.textContent = `${cur.name} · ${cur.origin} (Voice: ${cur.voiceName})`;

  el.tutorGrid.querySelectorAll('.tutor-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.selectedTutorId = btn.dataset.tutorId;
      saveSettings();
      renderTutors();
    });
  });
}

function syncLobbyControlsFromState() {
  el.shareCamCheckbox.checked = state.shareCamera;
  el.enableToolsCheckbox.checked = state.enableTools;
  el.liveModelSelect.value = state.liveModel;
  el.customLiveModelInput.value = state.customLiveModel;
  el.customLiveModelInput.classList.toggle('hidden', state.liveModel !== 'custom');
  el.reportModelSelect.value = state.reportModel;
  el.videoIntervalSelect.value = String(state.videoIntervalMs);
  el.customBookTitleInput.value = state.customBookTitle;
  el.customBookContentInput.value = state.customBookContent;

  el.avatarModePills.querySelectorAll('.seg-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.avatarMode === state.avatarMode);
  });

  el.levelPills.querySelectorAll('.level-card').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.level === state.levelKey);
  });

  el.correctionCards.querySelectorAll('.choice-card').forEach((card) => {
    card.classList.toggle('active', card.dataset.correction === state.correctionKey);
  });
}

function renderAllLobby() {
  renderStudentPresets();
  syncLobbyControlsFromState();
  renderTextbooks();
  renderTutors();
  updateBadges();
}

// ==================== TEXTBOOK PREVIEW MODAL ====================
function renderBookPreviewPage() {
  const book = TEXTBOOKS.find((b) => b.id === state.previewBookId);
  if (!book) return;
  const page = book.pages[state.previewPageIdx] || book.pages[0];

  el.bookPreviewMeta.textContent = `${book.gradeTag} · ${book.levelRange} · ${page.step}`;
  el.bookPreviewTitle.textContent = `${book.title} — ${page.heading}`;
  el.bookPreviewBody.innerHTML = renderBookPageMarkup(page, { interactive: false });
  el.bookPreviewBody.scrollTop = 0;

  el.previewPageCounter.textContent = `${state.previewPageIdx + 1} / ${book.pages.length}`;
  el.previewPrevPageBtn.disabled = state.previewPageIdx <= 0;
  el.previewNextPageBtn.disabled = state.previewPageIdx >= book.pages.length - 1;
}

function openBookPreviewModal(bookId) {
  state.previewBookId = bookId;
  state.previewPageIdx = 0;
  renderBookPreviewPage();
  el.bookPreviewModal.classList.remove('hidden');
}

// ==================== IN-CALL TEXTBOOK & CLASSROOM TOOLS ====================
function setSidebarTab(tabName) {
  state.activeSidebarTab = tabName;
  const isBook = tabName === 'book';
  el.tabBookBtn.classList.toggle('active', isBook);
  el.tabChatBtn.classList.toggle('active', !isBook);
  el.callBookPane.classList.toggle('hidden', !isBook);
  el.callChatPane.classList.toggle('hidden', isBook);
}

function renderActiveCallBookPage({ notifyTutor = false } = {}) {
  const book = state.activeCallTextbook;
  if (!book || !Array.isArray(book.pages) || book.pages.length === 0) {
    el.tabBookBtn.classList.add('hidden');
    setSidebarTab('chat');
    return;
  }

  el.tabBookBtn.classList.remove('hidden');
  const total = book.pages.length;
  const idx = Math.max(0, Math.min(total - 1, state.activeCallPageIdx));
  state.activeCallPageIdx = idx;
  const page = book.pages[idx];

  whiteboard.clear();
  el.callBookStepBadge.textContent = `${book.title} · ${page.step}`;
  el.callBookHeading.textContent = page.heading;
  el.callBookScroll.innerHTML = renderBookPageMarkup(page, { interactive: true });
  el.callBookScroll.scrollTop = 0;

  el.callBookScroll.querySelectorAll('[data-ask-word]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const word = btn.dataset.askWord;
      if (!state.inCall || !word) return;
      state.liveClient?.sendTextTurn(
        `I clicked the word "${word}" in our textbook! Could you pronounce it clearly and give me a fun short example?`
      );
      showToast(`"${word}" 단어 발음·설명을 선생님께 요청했어요!`);
    });
  });

  el.callBookNav.classList.toggle('hidden', total <= 1);
  el.prevBookPageBtn.disabled = idx <= 0;
  el.nextBookPageBtn.disabled = idx >= total - 1;
  el.bookPageDots.innerHTML = book.pages
    .map(
      (_, i) =>
        `<button type="button" class="page-dot-btn ${i === idx ? 'active' : ''}" data-jump-page="${i}">${i + 1}</button>`
    )
    .join('');

  el.bookPageDots.querySelectorAll('[data-jump-page]').forEach((dot) => {
    dot.addEventListener('click', () => {
      const targetIdx = Number(dot.dataset.jumpPage);
      if (targetIdx !== state.activeCallPageIdx) {
        state.activeCallPageIdx = targetIdx;
        renderActiveCallBookPage({ notifyTutor: true });
      }
    });
  });

  if (notifyTutor && state.inCall) {
    state.liveClient?.sendTextTurn(
      `[Lesson Page Sync] I turned our textbook to Page ${idx + 1} (${page.step}: "${page.heading}"). Let's do this page together now!`
    );
    showToast(`교재 ${idx + 1}쪽으로 이동했어요 — AI 선생님 화면과 동기화됨`);
  }
}

let starBannerTimer = null;
function triggerGoldStar(reason) {
  state.sessionStarsEarned += 1;
  getActiveProfile().stars = (getActiveProfile().stars || 0) + 1;
  saveSettings();

  el.callStarCount.textContent = String(state.sessionStarsEarned);
  el.starCelebrateReason.textContent = reason || '멋진 영어 문장이었어요!';
  el.starCelebrateBanner.classList.remove('hidden');
  playRewardChime('star');
  state.avatar3d?.setMood('happy');
  state.avatar3d?.playGesture('thumbup', 2.8);

  clearTimeout(starBannerTimer);
  starBannerTimer = setTimeout(() => {
    el.starCelebrateBanner.classList.add('hidden');
  }, 4200);
}

function showChalkboardNote(englishSentence, koreanTip) {
  state.sessionWhiteboardNotes.push({ englishSentence, koreanTip });
  el.chalkboardSentence.textContent = englishSentence;
  el.chalkboardTip.textContent = koreanTip || '';
  el.chalkboardBanner.classList.remove('hidden');
}

function showPopQuiz({ question, options = [], correctIndex = 0, explanation = '' }) {
  state.activeQuiz = { question, options, correctIndex, explanation };
  el.popQuizQuestion.textContent = question;
  el.popQuizFeedback.classList.add('hidden');
  el.popQuizFeedback.textContent = '';

  el.popQuizOptions.innerHTML = options
    .slice(0, 4)
    .map(
      (opt, idx) =>
        `<button type="button" class="quiz-opt-btn" data-quiz-idx="${idx}">${String.fromCharCode(65 + idx)}. ${escapeHtml(opt)}</button>`
    )
    .join('');

  el.popQuizOptions.querySelectorAll('[data-quiz-idx]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const picked = Number(btn.dataset.quizIdx);
      const isRight = picked === Number(correctIndex);
      el.popQuizOptions.querySelectorAll('.quiz-opt-btn').forEach((b, i) => {
        b.disabled = true;
        if (i === Number(correctIndex)) b.classList.add('correct');
        else if (i === picked && !isRight) b.classList.add('wrong');
      });

      el.popQuizFeedback.textContent = isRight
        ? `정답이에요! ${explanation || ''}`
        : `아쉬워요! 정답은 "${options[correctIndex] || ''}"예요. ${explanation || ''}`;
      el.popQuizFeedback.classList.remove('hidden');

      if (isRight) {
        playRewardChime('quiz');
        state.avatar3d?.playGesture('thumbup', 2.2);
      }

      state.liveClient?.sendTextTurn(
        `[Pop Quiz Answer] I picked "${options[picked] || ''}" (${isRight ? 'Correct!' : `Incorrect, correct answer was "${options[correctIndex] || ''}"`}).`
      );
    });
  });

  el.popQuizCard.classList.remove('hidden');
}

async function handleGeminiToolCall(fnCall) {
  const name = fnCall.name;
  const args = fnCall.args || {};

  if (name === 'turn_textbook_page') {
    const book = state.activeCallTextbook;
    if (!book || !book.pages?.length) {
      return { ok: false, message: 'No textbook active.' };
    }
    const targetIdx = Math.max(0, Math.min(book.pages.length - 1, Number(args.pageNumber || 1) - 1));
    state.activeCallPageIdx = targetIdx;
    setSidebarTab('book');
    renderActiveCallBookPage({ notifyTutor: false });
    showToast(`선생님이 교재를 ${targetIdx + 1}쪽으로 넘겼어요!`);
    return { ok: true, currentPage: targetIdx + 1, heading: book.pages[targetIdx].heading };
  }

  if (name === 'award_gold_star') {
    triggerGoldStar(args.reason || '정말 잘했어요!');
    return { ok: true, totalSessionStars: state.sessionStarsEarned };
  }

  if (name === 'write_on_whiteboard') {
    showChalkboardNote(args.englishSentence || '', args.koreanTip || '');
    return { ok: true, displayed: true };
  }

  if (name === 'show_pop_quiz') {
    showPopQuiz(args);
    return { ok: true, quizDisplayed: true };
  }

  if (name === 'set_tutor_expression') {
    if (args.mood) state.avatar3d?.setMood(args.mood);
    if (args.gesture && args.gesture !== 'none') state.avatar3d?.playGesture(args.gesture, 2.5);
    return { ok: true };
  }

  return { ok: true };
}

// ==================== LOBBY DEVICE PREVIEW ====================
async function stopLobbyPreview() {
  if (state.lobbyMicRaf) {
    cancelAnimationFrame(state.lobbyMicRaf);
    state.lobbyMicRaf = null;
  }
  if (state.lobbyAudioCtx) {
    await state.lobbyAudioCtx.close().catch(() => {});
    state.lobbyAudioCtx = null;
  }
  if (state.lobbyStream) {
    state.lobbyStream.getTracks().forEach((t) => t.stop());
    state.lobbyStream = null;
  }
  el.lobbyVideo.srcObject = null;
  el.lobbyVideoFallback.classList.remove('hidden');
  el.lobbyMicBar.style.width = '0%';
  el.previewDeviceStatus.textContent = '대기 중';
  el.toggleLobbyCamBtn.querySelector('span').textContent = '카메라·마이크 테스트';
}

async function toggleLobbyPreview() {
  if (state.lobbyStream) {
    await stopLobbyPreview();
    return;
  }
  showLobbyError('');
  try {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      });
    } catch {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
    }

    state.lobbyStream = stream;
    const hasVideo = stream.getVideoTracks().length > 0;
    if (hasVideo) {
      el.lobbyVideo.srcObject = stream;
      el.lobbyVideoFallback.classList.add('hidden');
      el.previewDeviceStatus.textContent = '카메라 · 마이크 정상';
    } else {
      el.previewDeviceStatus.textContent = '마이크만 연결됨 (카메라 없음)';
    }

    el.toggleLobbyCamBtn.querySelector('span').textContent = '미리보기 끄기';

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    state.lobbyAudioCtx = new AudioCtx();
    const src = state.lobbyAudioCtx.createMediaStreamSource(stream);
    const analyser = state.lobbyAudioCtx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);

    const tick = () => {
      if (!state.lobbyStream) return;
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      el.lobbyMicBar.style.width = `${Math.min(100, Math.round(rms * 420))}%`;
      state.lobbyMicRaf = requestAnimationFrame(tick);
    };
    tick();
  } catch (err) {
    showLobbyError(`마이크/카메라 접근에 실패했습니다: ${err.message}`);
  }
}

// ==================== TRANSCRIPT UI ====================
function resetTranscriptUI() {
  state.transcript = [];
  state.activeUserTurn = null;
  state.activeTutorTurn = null;
  el.transcriptList.innerHTML =
    '<div class="transcript-empty">수업이 시작되면 선생님과 학생의 영어가 이곳에 실시간 기록됩니다.</div>';
}

function appendOrUpdateTurn(role, chunkText) {
  const emptyEl = el.transcriptList.querySelector('.transcript-empty');
  if (emptyEl) emptyEl.remove();

  const tutor = getSelectedTutor();
  const studentName = getStudentDisplayName();
  const isUser = role === 'user';

  if (isUser && state.activeTutorTurn) state.activeTutorTurn = null;
  else if (!isUser && state.activeUserTurn) state.activeUserTurn = null;

  let turn = isUser ? state.activeUserTurn : state.activeTutorTurn;
  if (!turn) {
    const row = document.createElement('div');
    row.className = `bubble-row ${role}`;
    const meta = document.createElement('span');
    meta.className = 'bubble-meta';
    meta.textContent = isUser ? studentName : tutor.name;
    const body = document.createElement('div');
    body.className = 'bubble-body';
    row.appendChild(meta);
    row.appendChild(body);
    el.transcriptList.appendChild(row);

    turn = { role, text: '', time: Date.now(), bodyEl: body };
    state.transcript.push(turn);
    if (isUser) state.activeUserTurn = turn;
    else state.activeTutorTurn = turn;
  }

  turn.text = mergeTranscriptChunk(turn.text, chunkText);
  turn.bodyEl.textContent = turn.text;
  el.transcriptList.scrollTop = el.transcriptList.scrollHeight;

  el.subtitleSpeaker.textContent = isUser ? studentName : `${tutor.name} (${tutor.accentLabel})`;
  el.subtitleText.textContent = turn.text;
  el.subtitleOverlay.classList.remove('revealed');
}

function finalizeActiveTurns() {
  state.activeTutorTurn = null;
  state.activeUserTurn = null;
}

// ==================== LIVE VIDEO CALL ====================
function captureWebcamJpegBase64(quality = 0.68, maxWidth = 640) {
  const video = el.callUserVideo;
  if (!state.camEnabled || !video || video.readyState < 2 || !video.videoWidth) return null;
  const scale = Math.min(1, maxWidth / video.videoWidth);
  const w = Math.max(1, Math.round(video.videoWidth * scale));
  const h = Math.max(1, Math.round(video.videoHeight * scale));
  el.captureCanvas.width = w;
  el.captureCanvas.height = h;
  const ctx = el.captureCanvas.getContext('2d');
  ctx.drawImage(video, 0, 0, w, h);
  return el.captureCanvas.toDataURL('image/jpeg', quality).split(',')[1] || null;
}

function startWaveformLoop() {
  const canvas = el.tutorWaveCanvas;
  const ctx = canvas.getContext('2d');
  const barCount = 24;

  const draw = () => {
    if (!state.inCall) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const levels = state.audioPlayer
      ? state.audioPlayer.getVisualizerLevels(barCount)
      : new Array(barCount).fill(0);
    const speaking = Boolean(state.audioPlayer?.isSpeaking);

    const w = canvas.width;
    const h = canvas.height;
    const gap = 5;
    const barW = (w - gap * (barCount - 1)) / barCount;

    for (let i = 0; i < barCount; i++) {
      const val = speaking ? Math.max(0.1, levels[i]) : 0.08;
      const barH = Math.max(4, val * (h - 8));
      const x = i * (barW + gap);
      const y = (h - barH) / 2;
      ctx.fillStyle = speaking ? 'rgba(217, 119, 69, 0.92)' : 'rgba(245, 239, 230, 0.28)';
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH, 4);
      ctx.fill();
    }

    state.waveRafId = requestAnimationFrame(draw);
  };
  draw();
}

function updateMicUI() {
  el.micToggleBtn.classList.toggle('is-off', state.micMuted);
  el.micOnIcon.classList.toggle('hidden', state.micMuted);
  el.micOffIcon.classList.toggle('hidden', !state.micMuted);
  el.micToggleLabel.textContent = state.micMuted ? '마이크 꺼짐' : '마이크 켜짐';
  if (state.micMuted) el.callMicRing.style.opacity = '0';
}

function updateCamUI() {
  el.camToggleBtn.classList.toggle('is-off', !state.camEnabled);
  el.camOnIcon.classList.toggle('hidden', !state.camEnabled);
  el.camOffIcon.classList.toggle('hidden', state.camEnabled);
  el.camToggleLabel.textContent = state.camEnabled ? '카메라 켜짐' : '카메라 꺼짐';
  el.callUserCamOff.classList.toggle('hidden', state.camEnabled);
  el.visionSharingBadge.classList.toggle('hidden', !state.camEnabled || state.videoIntervalMs === 0);
}

function updateAvatarLayerUI() {
  const show3d = state.using3dInCall && state.avatar3d?.ready;
  el.callAvatar3dMount.classList.toggle('hidden', !show3d);
  el.callTutorImg.classList.toggle('hidden', show3d);
  el.toggleAvatarViewLabel.textContent = show3d ? '3D 립싱크 중' : '실사 화면 중';
}

function applySubtitleMode() {
  const mode = SUBTITLE_MODES[state.subtitleModeIdx];
  el.subtitleOverlay.dataset.mode = mode.key;
  el.subtitleModeLabel.textContent = mode.label;
}

async function startCall() {
  showLobbyError('');
  const apiKey = el.apiKeyInput.value.trim();
  if (!apiKey) {
    showLobbyError('먼저 Google Gemini API 키를 입력해 주세요. (Google AI Studio에서 발급 가능)');
    el.apiKeyInput.focus();
    return;
  }
  if (state.bookMode === 'custom' && !state.customBookContent.trim()) {
    showLobbyError('"내 교재 붙여넣기" 탭을 선택하셨어요. 수업할 영어 지문을 입력하거나 기본 교재를 선택해 주세요.');
    el.customBookContentInput.focus();
    return;
  }

  localStorage.setItem(STORAGE_KEYS.API_KEY, apiKey);
  saveSettings();
  await stopLobbyPreview();

  const tutor = getSelectedTutor();
  const studentName = getStudentDisplayName();
  const textbook = getSelectedTextbookObj();
  const liveModel = getActiveLiveModel();
  const topicLabel = getLessonTitleLabel();

  el.startCallBtn.disabled = true;
  el.startCallBtn.querySelector('span').textContent = '교실 연결 중...';

  try {
    let stream;
    if (state.shareCamera) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: { width: { ideal: 960 }, height: { ideal: 540 }, facingMode: 'user' },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: false,
        });
        showToast('카메라를 찾을 수 없어 음성 모드로 시작합니다.');
      }
    } else {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
    }

    state.callStream = stream;
    state.camEnabled = stream.getVideoTracks().length > 0;
    state.micMuted = false;
    state.studentSpeakingMs = 0;
    state.sessionStarsEarned = 0;
    state.sessionWhiteboardNotes = [];
    state.activeCallTextbook = textbook;
    state.activeCallPageIdx = 0;

    // Show call view early so 3D WebGL canvas gets real dimensions!
    switchView('call');
    el.callTutorImg.src = tutor.avatar;
    el.callTutorImg.alt = `${tutor.name} 선생님`;
    el.callTutorImg.classList.remove('hidden');
    el.callAvatar3dMount.classList.add('hidden');
    el.callTutorName.textContent = `${tutor.name} · ${tutor.accentLabel}`;
    el.callTutorState.textContent = '교실 준비 중...';
    el.callStarCount.textContent = '0';
    el.callStudentChip.textContent = `${studentName} · ${LEVELS[state.levelKey].shortLabel}`;
    el.pipStudentLabel.textContent = studentName;
    el.callTopicSub.textContent = `${topicLabel} · ${LEVELS[state.levelKey].label}`;
    el.tutorStageCard.classList.remove('connected', 'speaking');
    el.chalkboardBanner.classList.add('hidden');
    el.starCelebrateBanner.classList.add('hidden');
    el.popQuizCard.classList.add('hidden');
    el.helperTray.classList.add('hidden');
    el.callSidebar.classList.remove('collapsed');
    resetTranscriptUI();
    whiteboard.setEnabled(false);
    whiteboard.clear();
    el.wbToggleBtn.classList.remove('active');
    el.wbColorsGroup.classList.add('hidden');

    if (textbook) {
      setSidebarTab('book');
      renderActiveCallBookPage({ notifyTutor: false });
    } else {
      el.tabBookBtn.classList.add('hidden');
      setSidebarTab('chat');
    }

    el.callUserVideo.srcObject = state.camEnabled ? stream : null;
    updateMicUI();
    updateCamUI();
    applySubtitleMode();

    // Optional 3D Real-Time Lip-Sync Avatar initialization
    let externalAudioTarget = null;
    state.using3dInCall = false;
    if (state.avatarMode === '3d') {
      el.avatar3dStatusBadge.classList.remove('hidden');
      el.callAvatar3dMount.classList.remove('hidden');
      state.avatar3d = new Avatar3DController(el.callAvatar3dMount, (status) => {
        el.avatar3dStatusBadge.textContent = status;
      });
      const ok = await state.avatar3d.init({
        avatarUrl: tutor.avatar3d,
        body: tutor.body3d,
        mood: 'happy',
      });
      el.avatar3dStatusBadge.classList.add('hidden');
      if (ok) {
        state.using3dInCall = true;
        externalAudioTarget = state.avatar3d.getAudioTarget();
      }
    }
    updateAvatarLayerUI();

    // Init PCM Audio Player (routes into TalkingHead audio graph if 3D mode is active!)
    state.audioPlayer = new PcmAudioPlayer((isSpeaking) => {
      el.tutorStageCard.classList.toggle('speaking', isSpeaking);
      if (state.inCall) {
        el.callTutorState.textContent = isSpeaking ? '말하는 중...' : '듣고 있어요';
      }
    });
    await state.audioPlayer.init(externalAudioTarget);

    // Connect Gemini Live WebSocket with Native Classroom Tools
    const systemInstruction = buildSystemInstruction({
      tutor,
      studentName,
      levelKey: state.levelKey,
      correctionKey: state.correctionKey,
      textbook,
      activePageIdx: 0,
      customTopic: state.customTopic,
    });

    state.liveClient = new GeminiLiveClient({
      onAudioChunk: (b64, sampleRate) => state.audioPlayer?.enqueueBase64Pcm(b64, sampleRate),
      onInterrupted: () => {
        state.audioPlayer?.interrupt();
        finalizeActiveTurns();
      },
      onInputTranscription: (text) => appendOrUpdateTurn('user', text),
      onOutputTranscription: (text) => appendOrUpdateTurn('tutor', text),
      onTurnComplete: () => finalizeActiveTurns(),
      onToolCall: handleGeminiToolCall,
      onError: (err) => showToast(err.message, 4000),
      onClose: ({ closedByUser, code, reason }) => {
        if (!closedByUser && state.inCall) {
          showToast(`연결이 종료되었습니다 (${code}${reason ? `: ${reason}` : ''})`, 4500);
          endCall();
        }
      },
    });

    await state.liveClient.connect({
      apiKey,
      model: liveModel,
      voiceName: tutor.voiceName,
      systemInstruction,
      tools: state.enableTools ? buildClassroomToolDeclarations() : [],
    });

    // Setup 16kHz PCM Mic AudioWorklet
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    state.captureAudioCtx = new AudioCtx();
    await state.captureAudioCtx.audioWorklet.addModule('./js/audio-worklet.js');

    const micSource = state.captureAudioCtx.createMediaStreamSource(stream);
    const workletNode = new AudioWorkletNode(state.captureAudioCtx, 'pcm16k-capture-processor');
    state.captureWorkletNode = workletNode;

    workletNode.port.onmessage = (event) => {
      const msg = event.data;
      if (!msg) return;
      if (typeof msg.rms === 'number') {
        const level = Math.min(1, msg.rms * 6.5);
        el.callMicRing.style.opacity = state.micMuted || level < 0.05 ? '0' : String(Math.min(0.95, level));
        el.callMicRing.style.transform = `scale(${0.85 + level * 0.45})`;
        if (!state.micMuted && msg.rms > 0.018 && msg.type === 'pcm') {
          state.studentSpeakingMs += 100; // 100ms chunk of active student speech
        }
      }
      if (msg.type === 'pcm' && msg.buffer && !state.micMuted) {
        state.liveClient?.sendAudioPcmBuffer(msg.buffer);
      }
    };

    const silentGain = state.captureAudioCtx.createGain();
    silentGain.gain.value = 0;
    micSource.connect(workletNode);
    workletNode.connect(silentGain);
    silentGain.connect(state.captureAudioCtx.destination);

    state.inCall = true;
    state.callStartMs = Date.now();
    el.tutorStageCard.classList.add('connected');
    el.callTutorState.textContent = '인사하는 중...';
    el.callTimer.textContent = '00:00';

    state.callTimerId = setInterval(() => {
      const elapsed = Math.floor((Date.now() - state.callStartMs) / 1000);
      el.callTimer.textContent = formatDuration(elapsed);
    }, 1000);

    if (state.camEnabled && state.videoIntervalMs > 0) {
      state.videoTimerId = setInterval(() => {
        const frame = captureWebcamJpegBase64(0.65, 560);
        if (frame) state.liveClient?.sendVideoFrameBase64(frame);
      }, state.videoIntervalMs);
    }

    startWaveformLoop();

    setTimeout(() => {
      if (!state.inCall) return;
      const firstFrame = captureWebcamJpegBase64(0.7, 640);
      if (firstFrame) state.liveClient?.sendVideoFrameBase64(firstFrame);
      state.avatar3d?.playGesture('handup', 2.0);

      const openingCue = textbook
        ? `Hi ${tutor.name}! My name is ${studentName}. I have our textbook "${textbook.title}" open to Page 1 on my screen. Please greet me warmly and kick off Page 1 with me!`
        : `Hi ${tutor.name}! My name is ${studentName}. Let's start our fun English free-talk call!`;
      state.liveClient?.sendTextTurn(openingCue);
    }, 450);
  } catch (err) {
    await teardownCallResources();
    switchView('lobby');
    showLobbyError(err.message || '화상 통화 연결 중 오류가 발생했습니다.');
  } finally {
    el.startCallBtn.disabled = false;
    el.startCallBtn.querySelector('span').textContent = '화상영어 수업 시작하기';
  }
}

async function teardownCallResources() {
  state.inCall = false;
  if (state.videoTimerId) clearInterval(state.videoTimerId);
  if (state.callTimerId) clearInterval(state.callTimerId);
  if (state.waveRafId) cancelAnimationFrame(state.waveRafId);
  state.videoTimerId = null;
  state.callTimerId = null;
  state.waveRafId = null;

  if (state.liveClient) {
    state.liveClient.disconnect();
    state.liveClient = null;
  }
  if (state.captureWorkletNode) {
    try {
      state.captureWorkletNode.disconnect();
    } catch {
      // ignore
    }
    state.captureWorkletNode = null;
  }
  if (state.captureAudioCtx) {
    await state.captureAudioCtx.close().catch(() => {});
    state.captureAudioCtx = null;
  }
  if (state.audioPlayer) {
    await state.audioPlayer.close();
    state.audioPlayer = null;
  }
  if (state.avatar3d) {
    await state.avatar3d.dispose();
    state.avatar3d = null;
  }
  if (state.callStream) {
    state.callStream.getTracks().forEach((t) => t.stop());
    state.callStream = null;
  }
  el.callUserVideo.srcObject = null;
}

async function endCall() {
  if (!state.inCall) return;

  const durationSec = Math.max(1, Math.floor((Date.now() - state.callStartMs) / 1000));
  const tutorMs = state.audioPlayer?.totalSpeakingMs || 0;
  const studentMs = state.studentSpeakingMs || 0;
  const totalSpeechMs = tutorMs + studentMs;
  const studentTalkPct = totalSpeechMs > 1500 ? Math.round((studentMs / totalSpeechMs) * 100) : null;

  const cleanTranscript = state.transcript
    .map((t) => ({ role: t.role, text: (t.text || '').trim() }))
    .filter((t) => t.text.length > 0);

  const tutor = getSelectedTutor();
  const studentName = getStudentDisplayName();
  const topicLabel = getLessonTitleLabel();
  const levelLabel = LEVELS[state.levelKey].label;
  const bookId = state.activeCallTextbook?.id || null;
  const starsEarned = state.sessionStarsEarned;
  const whiteboardNotes = [...state.sessionWhiteboardNotes];
  const apiKey = el.apiKeyInput.value.trim();

  await teardownCallResources();

  if (cleanTranscript.length < 2) {
    switchView('lobby');
    showToast('대화 내용이 짧아 리포트를 생략하고 교실로 돌아왔습니다.');
    return;
  }

  switchView('report');
  el.reportLoading.classList.remove('hidden');
  el.reportContent.classList.add('hidden');

  let reportData = null;
  try {
    reportData = await generateStudyReport({
      apiKey,
      model: state.reportModel,
      transcript: cleanTranscript,
      tutor,
      studentName,
      topicLabel,
      levelLabel,
      durationSec,
    });
  } catch (err) {
    console.error('Study report error:', err);
    showToast(`리포트 자동 분석 오류: ${err.message}`, 4500);
    reportData = {
      headline: `${studentName} 학생의 화상영어 수업 기록`,
      praiseBadge: '오늘도 영어 말하기 완주!',
      summary: 'AI 리포트 생성 중 일시적인 오류가 발생했지만, 전체 대화 스크립트는 안전하게 저장되었습니다.',
      scores: { fluency: 80, naturalness: 78, vocabulary: 76, engagement: 86 },
      corrections: [],
      vocabulary: [],
      nextTopic: '같은 교재의 핵심 표현을 FSRS 단어장에서 3분만 복습해 보세요.',
    };
  }

  // Automatically ingest lesson corrections, vocabulary & chalkboard notes into FSRS Review Deck!
  const addedCards = ingestLessonIntoFsrsDeck({
    studentId: state.activeStudentId,
    topicLabel,
    report: reportData,
    whiteboardNotes,
  });

  const sessionRecord = {
    id: `sess_${Date.now()}`,
    createdAt: Date.now(),
    studentId: state.activeStudentId,
    studentName,
    bookId,
    tutorId: tutor.id,
    tutorName: tutor.name,
    tutorAvatar: tutor.avatar,
    accentLabel: tutor.accentLabel,
    topicLabel,
    levelLabel,
    durationSec,
    durationLabel: formatDuration(durationSec),
    studentTalkPct,
    starsEarned,
    transcript: cleanTranscript,
    report: reportData,
  };

  const history = loadHistory();
  history.unshift(sessionRecord);
  saveHistory(history);

  if (addedCards > 0) {
    showToast(`오늘 배운 표현 ${addedCards}개가 FSRS 복습 단어장에 자동 등록되었어요!`, 3600);
  }
  renderReportView(sessionRecord);
}

// ==================== IN-CALL CONTROLS & HELPERS ====================
function handleToggleMic() {
  state.micMuted = !state.micMuted;
  state.captureWorkletNode?.port.postMessage({ muted: state.micMuted });
  state.callStream?.getAudioTracks().forEach((t) => {
    t.enabled = !state.micMuted;
  });
  updateMicUI();
}

async function handleToggleCam() {
  if (state.camEnabled) {
    state.callStream?.getVideoTracks().forEach((t) => {
      t.stop();
      state.callStream.removeTrack(t);
    });
    state.camEnabled = false;
    el.callUserVideo.srcObject = null;
    updateCamUI();
    return;
  }

  try {
    const camStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 960 }, height: { ideal: 540 }, facingMode: 'user' },
    });
    const videoTrack = camStream.getVideoTracks()[0];
    if (videoTrack && state.callStream) {
      state.callStream.addTrack(videoTrack);
      el.callUserVideo.srcObject = state.callStream;
      state.camEnabled = true;
      updateCamUI();
    }
  } catch (err) {
    showToast(`카메라를 켤 수 없습니다: ${err.message}`);
  }
}

function handleToggleAvatarViewInCall() {
  if (!state.avatar3d?.ready) {
    showToast('3D 아바타를 사용하려면 수업 시작 전 [3D 실시간 립싱크] 모드를 선택해 주세요.');
    return;
  }
  state.using3dInCall = !state.using3dInCall;
  updateAvatarLayerUI();
}

function handleManualSnapshot() {
  const frame = captureWebcamJpegBase64(0.82, 768);
  if (!frame) {
    showToast('카메라가 켜져 있어야 화면을 보여줄 수 있어요.');
    return;
  }
  state.liveClient?.sendVideoFrameBase64(frame);
  state.liveClient?.sendTextTurn('Look at what I am holding up to my camera right now!');
  showToast('현재 웹캠 화면을 선생님께 보냈습니다!');
}

async function handleRequestHints() {
  const apiKey = el.apiKeyInput.value.trim();
  if (!apiKey) return;

  el.helperTrayTitle.textContent = '표현 힌트 생성 중...';
  el.helperTrayBody.innerHTML = '<span style="color: var(--text-muted)">지금 대답하기 좋은 영어 문장을 찾고 있어요...</span>';
  el.helperTray.classList.remove('hidden');
  el.getHintBtn.disabled = true;

  try {
    const data = await requestSpeakingHints({
      apiKey,
      model: state.reportModel,
      transcript: state.transcript.map((t) => ({ role: t.role, text: t.text })),
      tutorName: getSelectedTutor().name,
      levelLabel: LEVELS[state.levelKey].label,
      textbookTitle: state.activeCallTextbook?.title || '',
    });
    el.helperTrayTitle.textContent = '지금 말해보면 좋은 표현 3가지';
    const hints = Array.isArray(data.hints) ? data.hints : [];
    el.helperTrayBody.innerHTML =
      hints
        .map(
          (h) => `
        <div class="hint-item">
          <strong>${escapeHtml(h.english)}</strong>
          <span>${escapeHtml(h.korean)}${h.nuance ? ` · ${escapeHtml(h.nuance)}` : ''}</span>
        </div>`
        )
        .join('') || '<span>힌트를 만들지 못했습니다.</span>';
  } catch (err) {
    el.helperTrayTitle.textContent = '힌트 오류';
    el.helperTrayBody.textContent = err.message;
  } finally {
    el.getHintBtn.disabled = false;
  }
}

async function handleTranslateLast() {
  const apiKey = el.apiKeyInput.value.trim();
  const lastTutor = [...state.transcript].reverse().find((t) => t.role === 'tutor' && t.text.trim());
  if (!lastTutor) {
    showToast('아직 해석할 선생님 문장이 없습니다.');
    return;
  }

  el.helperTrayTitle.textContent = '해석 중...';
  el.helperTrayBody.innerHTML = '<span style="color: var(--text-muted)">방금 선생님이 한 말을 해석하고 있어요...</span>';
  el.helperTray.classList.remove('hidden');
  el.translateLastBtn.disabled = true;

  try {
    const res = await translateUtterance({
      apiKey,
      model: state.reportModel,
      text: lastTutor.text,
    });
    el.helperTrayTitle.textContent = '방금 선생님 문장 해석';
    const notesHtml =
      Array.isArray(res.notes) && res.notes.length
        ? res.notes
            .map(
              (n) => `
            <div class="hint-item">
              <strong>${escapeHtml(n.expression)}</strong>
              <span>${escapeHtml(n.meaning)}</span>
            </div>`
            )
            .join('')
        : '';

    el.helperTrayBody.innerHTML = `
      <div class="hint-item">
        <strong>${escapeHtml(res.korean)}</strong>
        <span>"${escapeHtml(lastTutor.text)}"</span>
      </div>
      ${notesHtml}
    `;
  } catch (err) {
    el.helperTrayTitle.textContent = '해석 오류';
    el.helperTrayBody.textContent = err.message;
  } finally {
    el.translateLastBtn.disabled = false;
  }
}

// ==================== REPORT & HISTORY RENDERING ====================
function renderReportView(session) {
  state.currentReportSession = session;
  switchView('report');
  el.reportLoading.classList.add('hidden');
  el.reportContent.classList.remove('hidden');

  const r = session.report || {};
  const dateStr = new Date(session.createdAt).toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  el.reportTutorImg.src = session.tutorAvatar || 'assets/maya.jpg';
  if (r.praiseBadge) {
    el.reportPraiseBadge.textContent = `★ ${r.praiseBadge}${session.starsEarned ? ` · 골드스타 ${session.starsEarned}개` : ''}`;
    el.reportPraiseBadge.classList.remove('hidden');
  } else {
    el.reportPraiseBadge.classList.add('hidden');
  }

  const talkMeta = typeof session.studentTalkPct === 'number' ? ` · 학생 발화 비율 ${session.studentTalkPct}%` : '';
  el.reportHeadline.textContent = r.headline || `${session.topicLabel} 복습 리포트`;
  el.reportMetaLine.textContent = `${session.studentName || '학생'} (${session.levelLabel}) · ${session.tutorName} 선생님 · ${session.topicLabel} · ${session.durationLabel}${talkMeta} · ${dateStr}`;
  el.reportSummaryText.textContent = r.summary || '';
  el.reportNextTopicText.textContent = r.nextTopic || '다음 수업에서 오늘 배운 표현을 2번 이상 직접 써보세요!';

  const scores = r.scores || {};
  const scoreItems = [
    { label: '유창성 (Fluency)', val: scores.fluency ?? 80 },
    { label: '원어민 자연스러움 (Naturalness)', val: scores.naturalness ?? 78 },
    { label: '어휘 다양성 (Vocabulary)', val: scores.vocabulary ?? 76 },
    { label: '수업 참여도 (Engagement)', val: scores.engagement ?? 88 },
  ];
  if (typeof session.studentTalkPct === 'number') {
    scoreItems.push({ label: '학생 발화 비중 (권장 50%+)', val: session.studentTalkPct });
  }
  el.reportScoresList.innerHTML = scoreItems
    .map(
      (s) => `
      <div>
        <div class="score-row-head"><span>${s.label}</span><strong>${s.val} / 100</strong></div>
        <div class="score-track"><div class="score-fill" style="width:${Math.max(10, Math.min(100, s.val))}%"></div></div>
      </div>`
    )
    .join('');

  const corrections = Array.isArray(r.corrections) ? r.corrections : [];
  el.correctionsCount.textContent = `${corrections.length}개 제안`;
  el.reportCorrectionsList.innerHTML = corrections.length
    ? corrections
        .map(
          (c) => `
        <div class="correction-item">
          <span class="correction-tag">${escapeHtml(c.category || '자연스러운 표현')}</span>
          <p class="correction-before">${escapeHtml(c.original)}</p>
          <p class="correction-after">${escapeHtml(c.improved)}</p>
          <p class="correction-explain">${escapeHtml(c.explanation)}</p>
        </div>`
        )
        .join('')
    : '<p class="status-text">교정 항목이 없습니다.</p>';

  const vocab = Array.isArray(r.vocabulary) ? r.vocabulary : [];
  el.reportVocabGrid.innerHTML = vocab.length
    ? vocab
        .map(
          (v) => `
        <div class="vocab-card">
          <strong>${escapeHtml(v.phrase)}</strong>
          <span class="vocab-meaning">${escapeHtml(v.meaning)}</span>
          <p class="vocab-example">${escapeHtml(v.example || '')}</p>
        </div>`
        )
        .join('')
    : '<p class="status-text">추출된 핵심 표현이 없습니다.</p>';

  const transcript = Array.isArray(session.transcript) ? session.transcript : [];
  el.reportFullTranscript.innerHTML = transcript
    .map(
      (t) => `
      <div class="report-transcript-line">
        <strong>${t.role === 'user' ? escapeHtml(session.studentName || '학생') : escapeHtml(session.tutorName)}:</strong>
        <span>${escapeHtml(t.text)}</span>
      </div>`
    )
    .join('');
}

function openSampleReport() {
  const isG6 = state.activeStudentId === 'grade6';
  const sample = isG6
    ? {
        id: 'sample_g6',
        createdAt: Date.now(),
        studentName: getStudentDisplayName(),
        tutorName: 'Oliver',
        tutorAvatar: 'assets/oliver.jpg',
        accentLabel: 'UK British',
        topicLabel: 'Future School 2050 (예시 리포트)',
        levelLabel: 'Level 3 · 초6 고급 (B1)',
        durationSec: 725,
        durationLabel: '12:05',
        studentTalkPct: 58,
        starsEarned: 4,
        transcript: [
          { role: 'tutor', text: 'So in 2050, would you prefer an AI robot teacher or a human teacher?' },
          { role: 'user', text: 'In my opinion, AI teacher is good for math, because it can explain many times. But human teacher is more better for talking with friends and feelings.' },
          { role: 'tutor', text: 'That is a really thoughtful balance! Why do you think empathy matters so much in a classroom?' },
          { role: 'user', text: 'When I have hard time in school, robot cannot really feel my heart, so human teacher can cheer me up.' },
        ],
        report: {
          praiseBadge: '논리적인 미래학교 토론왕',
          headline: '자신의 입장과 이유를 영어 문장으로 또렷하게 설명한 훌륭한 토론 수업이었어요!',
          summary:
            '지문 내용을 빠르게 이해하고 AI 선생님과 인간 선생님의 장단점을 균형 있게 비교한 점이 뛰어납니다. 질문에 단답으로 끝내지 않고 because로 이유를 붙이는 습관이 잘 잡혀 있어요. 비교급 형태(much better)와 관사(a tough time)만 다듬으면 중등 심화 수준으로 금방 올라설 거예요.',
          scores: { fluency: 85, naturalness: 80, vocabulary: 82, engagement: 92 },
          corrections: [
            {
              category: '문법',
              original: 'But human teacher is more better for talking with friends and feelings.',
              improved: 'But human teachers are much better at understanding feelings and guiding teamwork.',
              explanation: "'better'를 강조할 때는 'more better' 대신 'much better'를 써요! '~을 잘하다'는 'better at ~ing'가 자연스럽습니다.",
            },
            {
              category: '자연스러운 표현',
              original: 'When I have hard time in school, robot cannot really feel my heart.',
              improved: "When I'm having a tough time at school, a robot can't truly understand how I feel.",
              explanation: "'힘든 시간을 보내다'는 관사를 넣어 'have a tough time'이라고 말하면 원어민 또래처럼 들려요.",
            },
          ],
          vocabulary: [
            { phrase: 'much better at ~ing', meaning: '~하는 것을 훨씬 더 잘하는', example: 'Human teachers are much better at encouraging students.' },
            { phrase: 'have a tough time', meaning: '힘든 시간을 보내다', example: 'My friend cheered me up when I was having a tough time.' },
            { phrase: 'empathy', meaning: '공감 능력', example: 'Real empathy is something robots still struggle with.' },
            { phrase: 'cheer someone up', meaning: '~의 기운을 북돋아 주다', example: 'A kind word from a teacher can really cheer you up.' },
          ],
          nextTopic: '다음 수업에서는 [Should Kids Have Smartphones?] 교재로 3라운드 영어 찬반 토론에 도전해 보세요!',
        },
      }
    : {
        id: 'sample_g3',
        createdAt: Date.now(),
        studentName: getStudentDisplayName(),
        tutorName: 'Maya',
        tutorAvatar: 'assets/maya.jpg',
        accentLabel: 'US West Coast',
        topicLabel: 'A Day at the Magic Zoo (예시 리포트)',
        levelLabel: 'Level 1 · 초3 중급 (A1+~A2)',
        durationSec: 540,
        durationLabel: '09:00',
        studentTalkPct: 54,
        starsEarned: 3,
        transcript: [
          { role: 'tutor', text: 'Look at Page 1! What is the cute little penguin wearing on his head?' },
          { role: 'user', text: 'He is wearing brown goggles! I think he want to fly in the sky.' },
          { role: 'tutor', text: 'Awesome! If you had a magic pet, what superpower would it have?' },
          { role: 'user', text: 'My magic pet is small dragon. It can flying very fast and make ice cream!' },
        ],
        report: {
          praiseBadge: '상상력 가득 스토리텔러',
          headline: '그림을 보고 자신감 있게 영어로 대답하고 멋진 마법 동물까지 소개했어요!',
          summary:
            '선생님의 질문을 정확히 알아듣고 씩씩하게 자기 생각을 영어로 표현한 점이 정말 멋졌습니다! 특히 아이스크림을 만드는 마법 드래곤 아이디어가 너무 창의적이었어요. 조동사 can 뒤에 동사원형(can fly)을 쓰는 패턴만 한 번 더 연습하면 문장이 훨씬 깔끔해질 거예요.',
          scores: { fluency: 81, naturalness: 77, vocabulary: 78, engagement: 94 },
          corrections: [
            {
              category: '문법',
              original: 'I think he want to fly in the sky.',
              improved: 'I think he wants to fly in the sky.',
              explanation: "주어가 'he(그)'일 때는 현재형 동사 뒤에 '-s'를 붙여 'he wants'라고 말해요!",
            },
            {
              category: '문법',
              original: 'It can flying very fast and make ice cream!',
              improved: 'It can fly super fast and make ice cream!',
              explanation: "'can(~할 수 있다)' 다음에는 '-ing'를 빼고 원래 모양인 'can fly'로 써야 해요.",
            },
          ],
          vocabulary: [
            { phrase: 'aviator goggles', meaning: '비행 고글 안경', example: 'Pip wears cool brown goggles.' },
            { phrase: 'super fast', meaning: '엄청 빠르게', example: 'My magic dragon can fly super fast!' },
            { phrase: 'curious', meaning: '호기심이 많은', example: 'The curious penguin looked at the balloons.' },
            { phrase: 'float up', meaning: '위로 둥둥 떠오르다', example: 'The red balloons floated up into the clouds.' },
          ],
          nextTopic: "다음 수업에서는 [Let's Order at Sunny Cafe!] 교재로 영어로 스무디와 크루아상을 직접 주문하는 역할극을 해보세요!",
        },
      };
  renderReportView(sample);
}

function renderHistoryModalList() {
  const all = loadHistory();
  const names = [...new Set(all.map((s) => s.studentName || '학생'))];

  el.historyFilterBar.innerHTML =
    names.length > 1
      ? ['all', ...names]
          .map(
            (name) =>
              `<button type="button" class="filter-tab ${state.historyStudentFilter === name ? 'active' : ''}" data-hist-filter="${escapeHtml(name)}">${name === 'all' ? '전체 학생' : escapeHtml(name)}</button>`
          )
          .join('')
      : '';

  el.historyFilterBar.querySelectorAll('[data-hist-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.historyStudentFilter = btn.dataset.histFilter;
      renderHistoryModalList();
    });
  });

  const filtered =
    state.historyStudentFilter === 'all'
      ? all
      : all.filter((s) => (s.studentName || '학생') === state.historyStudentFilter);

  el.historyList.innerHTML = filtered.length
    ? filtered
        .map((item) => {
          const d = new Date(item.createdAt).toLocaleString('ko-KR', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
          return `
            <div class="history-item">
              <div class="history-item-main" data-open-id="${item.id}">
                <strong>[${escapeHtml(item.studentName || '학생')}] ${escapeHtml(item.topicLabel)}</strong>
                <span>${escapeHtml(item.tutorName)} 선생님 · ${escapeHtml(item.durationLabel)} · ${d}</span>
              </div>
              <button type="button" class="btn btn-icon btn-sm" data-delete-id="${item.id}" title="삭제">삭제</button>
            </div>
          `;
        })
        .join('')
    : '<div class="history-empty">아직 저장된 수업 노트가 없습니다.<br/>첫 화상영어 수업을 마치면 자동으로 이곳에 기록됩니다.</div>';

  el.historyList.querySelectorAll('[data-open-id]').forEach((node) => {
    node.addEventListener('click', () => {
      const found = loadHistory().find((s) => s.id === node.dataset.openId);
      if (found) {
        el.historyModal.classList.add('hidden');
        renderReportView(found);
      }
    });
  });

  el.historyList.querySelectorAll('[data-delete-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = loadHistory().filter((s) => s.id !== btn.dataset.deleteId);
      saveHistory(next);
      renderHistoryModalList();
    });
  });
}

function openHistoryModal() {
  state.historyStudentFilter = 'all';
  renderHistoryModalList();
  el.historyModal.classList.remove('hidden');
}

// ==================== EVENT WIRING ====================
function bindEvents() {
  el.brandHomeBtn.addEventListener('click', () => {
    if (!state.inCall) switchView('lobby');
  });

  document.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!state.inCall) switchView(btn.dataset.nav);
    });
  });

  el.quickLevelTestBtn.addEventListener('click', () => switchView('leveltest'));

  el.studentNameInput.addEventListener('input', () => {
    getActiveProfile().name = el.studentNameInput.value;
    saveSettings();
    renderStudentPresets();
  });

  el.toggleLobbyCamBtn.addEventListener('click', toggleLobbyPreview);
  el.shareCamCheckbox.addEventListener('change', () => {
    state.shareCamera = el.shareCamCheckbox.checked;
    saveSettings();
  });
  el.enableToolsCheckbox.addEventListener('change', () => {
    state.enableTools = el.enableToolsCheckbox.checked;
    saveSettings();
  });

  el.apiKeyInput.addEventListener('change', () => {
    localStorage.setItem(STORAGE_KEYS.API_KEY, el.apiKeyInput.value.trim());
  });
  el.toggleApiKeyVisBtn.addEventListener('click', () => {
    el.apiKeyInput.type = el.apiKeyInput.type === 'password' ? 'text' : 'password';
  });

  el.avatarModePills.querySelectorAll('.seg-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.avatarMode = btn.dataset.avatarMode;
      saveSettings();
      syncLobbyControlsFromState();
    });
  });

  el.liveModelSelect.addEventListener('change', () => {
    state.liveModel = el.liveModelSelect.value;
    el.customLiveModelInput.classList.toggle('hidden', state.liveModel !== 'custom');
    saveSettings();
  });
  el.customLiveModelInput.addEventListener('input', () => {
    state.customLiveModel = el.customLiveModelInput.value;
    saveSettings();
  });
  el.reportModelSelect.addEventListener('change', () => {
    state.reportModel = el.reportModelSelect.value;
    saveSettings();
  });
  el.videoIntervalSelect.addEventListener('change', () => {
    state.videoIntervalMs = Number(el.videoIntervalSelect.value);
    saveSettings();
  });

  el.levelPills.querySelectorAll('.level-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.levelKey = btn.dataset.level;
      saveSettings();
      syncLobbyControlsFromState();
      renderStudentPresets();
    });
  });

  el.correctionCards.querySelectorAll('.choice-card').forEach((card) => {
    card.addEventListener('click', () => {
      state.correctionKey = card.dataset.correction;
      saveSettings();
      syncLobbyControlsFromState();
    });
  });

  el.bookFilterTabs.querySelectorAll('.filter-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const filter = tab.dataset.filter;
      state.bookFilter = filter;
      if (filter === 'custom') state.bookMode = 'custom';
      else if (filter === 'freetalk') state.bookMode = 'freetalk';
      else state.bookMode = 'library';
      saveSettings();
      renderTextbooks();
    });
  });

  el.customBookTitleInput.addEventListener('input', () => {
    state.customBookTitle = el.customBookTitleInput.value;
    saveSettings();
    el.selectedBookSummary.textContent = getLessonTitleLabel();
  });
  el.customBookContentInput.addEventListener('input', () => {
    state.customBookContent = el.customBookContentInput.value;
    saveSettings();
    el.selectedBookSummary.textContent = getLessonTitleLabel();
  });
  el.customTopicInput.addEventListener('input', () => {
    state.customTopic = el.customTopicInput.value;
    el.selectedBookSummary.textContent = getLessonTitleLabel();
  });

  el.startCallBtn.addEventListener('click', startCall);
  el.previewSampleReportBtn.addEventListener('click', openSampleReport);

  // Textbook preview modal
  el.closeBookPreviewBtn.addEventListener('click', () => el.bookPreviewModal.classList.add('hidden'));
  el.bookPreviewModal.addEventListener('click', (e) => {
    if (e.target === el.bookPreviewModal) el.bookPreviewModal.classList.add('hidden');
  });
  el.previewPrevPageBtn.addEventListener('click', () => {
    if (state.previewPageIdx > 0) {
      state.previewPageIdx -= 1;
      renderBookPreviewPage();
    }
  });
  el.previewNextPageBtn.addEventListener('click', () => {
    const book = TEXTBOOKS.find((b) => b.id === state.previewBookId);
    if (book && state.previewPageIdx < book.pages.length - 1) {
      state.previewPageIdx += 1;
      renderBookPreviewPage();
    }
  });
  el.selectPreviewBookBtn.addEventListener('click', () => {
    if (state.previewBookId) {
      state.bookMode = 'library';
      if (state.bookFilter === 'custom' || state.bookFilter === 'freetalk') state.bookFilter = 'all';
      state.selectedBookId = state.previewBookId;
      saveSettings();
      renderTextbooks();
      el.bookPreviewModal.classList.add('hidden');
      showToast(`"${getLessonTitleLabel()}" 교재를 선택했어요!`);
    }
  });

  // In-Call Controls
  el.micToggleBtn.addEventListener('click', handleToggleMic);
  el.camToggleBtn.addEventListener('click', handleToggleCam);
  el.toggleAvatarViewBtn.addEventListener('click', handleToggleAvatarViewInCall);
  el.sendSnapshotBtn.addEventListener('click', handleManualSnapshot);
  el.endCallBtn.addEventListener('click', endCall);

  el.closeChalkboardBtn.addEventListener('click', () => el.chalkboardBanner.classList.add('hidden'));
  el.closePopQuizBtn.addEventListener('click', () => el.popQuizCard.classList.add('hidden'));

  el.subtitleModeBtn.addEventListener('click', () => {
    state.subtitleModeIdx = (state.subtitleModeIdx + 1) % SUBTITLE_MODES.length;
    applySubtitleMode();
  });
  el.subtitleOverlay.addEventListener('click', () => {
    if (el.subtitleOverlay.dataset.mode === 'blur') el.subtitleOverlay.classList.toggle('revealed');
  });

  el.toggleSidebarBtn.addEventListener('click', () => el.callSidebar.classList.toggle('collapsed'));
  el.closeSidebarBtn.addEventListener('click', () => el.callSidebar.classList.add('collapsed'));
  el.expandPanelBtn.addEventListener('click', () => {
    el.callSidebar.classList.toggle('expanded');
    setTimeout(() => whiteboard.resizeToParent(), 220);
  });

  el.tabBookBtn.addEventListener('click', () => setSidebarTab('book'));
  el.tabChatBtn.addEventListener('click', () => setSidebarTab('chat'));

  el.prevBookPageBtn.addEventListener('click', () => {
    if (state.activeCallPageIdx > 0) {
      state.activeCallPageIdx -= 1;
      renderActiveCallBookPage({ notifyTutor: true });
    }
  });
  el.nextBookPageBtn.addEventListener('click', () => {
    const total = state.activeCallTextbook?.pages?.length || 0;
    if (state.activeCallPageIdx < total - 1) {
      state.activeCallPageIdx += 1;
      renderActiveCallBookPage({ notifyTutor: true });
    }
  });

  // Whiteboard drawing toolbar
  el.wbToggleBtn.addEventListener('click', () => {
    const next = !whiteboard.enabled;
    whiteboard.setEnabled(next);
    el.wbToggleBtn.classList.toggle('active', next);
    el.wbColorsGroup.classList.toggle('hidden', !next);
    if (next) showToast('교재 위에서 자유롭게 동그라미·밑줄·그림을 그려보세요!');
  });
  document.querySelectorAll('[data-wb-color]').forEach((dot) => {
    dot.addEventListener('click', () => {
      document.querySelectorAll('[data-wb-color]').forEach((d) => d.classList.remove('active'));
      dot.classList.add('active');
      el.wbHighlighterBtn.classList.remove('active');
      el.wbEraserBtn.classList.remove('active');
      whiteboard.setTool('pen');
      whiteboard.setColor(dot.dataset.wbColor);
    });
  });
  el.wbHighlighterBtn.addEventListener('click', () => {
    whiteboard.setTool('highlighter');
    el.wbHighlighterBtn.classList.add('active');
    el.wbEraserBtn.classList.remove('active');
  });
  el.wbEraserBtn.addEventListener('click', () => {
    whiteboard.setTool('eraser');
    el.wbEraserBtn.classList.add('active');
    el.wbHighlighterBtn.classList.remove('active');
  });
  el.wbUndoBtn.addEventListener('click', () => whiteboard.undo());
  el.wbClearBtn.addEventListener('click', () => whiteboard.clear());
  el.wbSendSketchBtn.addEventListener('click', () => {
    if (!whiteboard.hasDrawing()) {
      showToast('먼저 교재 위에 펜으로 표시하거나 그림을 그려주세요!');
      return;
    }
    const heading = state.activeCallTextbook?.pages?.[state.activeCallPageIdx]?.heading || 'Whiteboard';
    const b64 = whiteboard.exportJpegBase64(heading);
    if (b64) {
      state.liveClient?.sendVideoFrameBase64(b64);
      state.liveClient?.sendTextTurn(
        `Look at what I just drew or circled on our classroom whiteboard for "${heading}"! Tell me what you think!`
      );
      showToast('화이트보드 그림을 선생님께 보냈어요!');
    }
  });

  // Helper & text chat
  el.getHintBtn.addEventListener('click', handleRequestHints);
  el.translateLastBtn.addEventListener('click', handleTranslateLast);
  el.closeHelperTrayBtn.addEventListener('click', () => el.helperTray.classList.add('hidden'));

  el.chatTextForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = el.chatTextInput.value.trim();
    if (!text || !state.inCall) return;
    el.chatTextInput.value = '';
    appendOrUpdateTurn('user', text);
    finalizeActiveTurns();
    state.liveClient?.sendTextTurn(text);
  });

  // Report controls
  el.goFsrsFromReportBtn.addEventListener('click', () => switchView('review'));
  el.copyMarkdownBtn.addEventListener('click', async () => {
    if (!state.currentReportSession) return;
    await navigator.clipboard.writeText(reportToMarkdown(state.currentReportSession));
    showToast('복습 노트가 마크다운 형식으로 복사되었습니다.');
  });
  el.downloadMarkdownBtn.addEventListener('click', () => {
    if (!state.currentReportSession) return;
    const md = reportToMarkdown(state.currentReportSession);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fluentcam-note-${new Date(state.currentReportSession.createdAt).toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  });
  el.backToLobbyBtn.addEventListener('click', () => switchView('lobby'));

  // History modal
  el.openHistoryBtn.addEventListener('click', openHistoryModal);
  el.closeHistoryBtn.addEventListener('click', () => el.historyModal.classList.add('hidden'));
  el.historyModal.addEventListener('click', (e) => {
    if (e.target === el.historyModal) el.historyModal.classList.add('hidden');
  });

  academyPages.bindSubpageEvents();
}

// ==================== INIT ====================
function init() {
  restoreSettings();
  bindEvents();
  switchView('lobby');
}

init();

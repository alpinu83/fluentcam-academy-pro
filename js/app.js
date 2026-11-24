import {
  TUTORS,
  STUDENT_PRESETS,
  SPEAKING_PACES,
  LEVELS,
  CORRECTION_MODES,
  buildSystemInstruction,
} from './tutors.js?v=20261124d';
import {
  SPEAKING_FOCUS_MODES,
  analyzeConversationSpeaking,
  buildLearnerMemory,
  buildMidCallCoachFeedback,
} from './speaking-coach.js?v=20261124b';
import {
  getAllTextbooks,
  formatSingleTextbookPage,
  loadCustomAiTextbooks,
  loadDeletedAiBookIds,
  saveCustomAiTextbook,
  deleteCustomAiTextbook,
} from './textbooks.js?v=20261124d';
import { GeminiLiveClient, PcmAudioPlayer } from './gemini-live.js?v=20261124d';
import { Avatar3DController } from './avatar-3d.js';
import { buildClassroomToolDeclarations, playRewardChime } from './classroom-tools.js';
import { ClassroomWhiteboard } from './whiteboard.js';
import { loadFsrsDeck, ingestLessonIntoFsrsDeck } from './fsrs.js';
import { createAcademyPages } from './academy-pages.js?v=20261124d';
import {
  generateAiTextbook,
  generateStudyReport,
  reportToMarkdown,
} from './feedback.js?v=20261124d';
import {
  DEFAULT_SYNC_REPO,
  cleanGitHubToken,
  createGitHubCloudSync,
  loadGitHubSyncConfig,
  saveGitHubSyncConfig,
} from './cloud-sync.js?v=20261123c';

const STORAGE_KEYS = {
  API_KEY: 'fluentcam_gemini_api_key',
  SETTINGS: 'fluentcam_academy_pro_v4',
  HISTORY: 'fluentcam_history_v1',
  PARENT_PIN: 'fluentcam_parent_pin_v1',
  AI_BOOKS: 'fluentcam_ai_generated_books_v1',
  DELETED_AI_BOOKS: 'fluentcam_deleted_ai_books_v1',
  FSRS_DECK: 'fluentcam_fsrs_deck_v1',
  SETTINGS_UPDATED_AT: 'fluentcam_settings_updated_at_v1',
  API_KEY_UPDATED_AT: 'fluentcam_api_key_updated_at_v1',
  PIN_UPDATED_AT: 'fluentcam_pin_updated_at_v1',
};

const LEGACY_BOOK_ID_MAP = {
  'magic-zoo': 'g3-01-magic-zoo',
  'sunny-cafe': 'g3-02-sunny-cafe',
  'mystery-show-tell': 'g3-03-show-and-tell',
  'future-school-2050': 'g6-01-future-school',
  'london-travel-vlog': 'g6-02-london-vlog',
  'kids-debate-smartphones': 'g6-03-debate-smartphones',
};

const SUBTITLE_LABELS = {
  hidden: '자막 꺼짐 · 순수 리스닝',
  blur: '리스닝 블러 자막',
  visible: '자막 켜짐',
};

const NOISE_LABELS = {
  low: '잡음 차단: 약함',
  medium: '잡음 차단: 보통',
  high: '잡음 차단: 강함',
};

const TURN_WAIT_CONFIG = {
  normal: { ms: 1500, label: '보통 (1.5초)' },
  patient: { ms: 2400, label: '넉넉하게 (2.4초)' },
  extra: { ms: 3400, label: '아주 여유롭게 (3.4초)' },
};

const defaultProfiles = {
  grade3: {
    name: '초3 학생',
    levelKey: 'elem3_mid',
    correctionKey: 'gentle',
    speakingFocus: 'balanced',
    subtitleMode: 'hidden',
    speakingPace: 'slow',
    tutorId: 'maya',
    bookMode: 'library',
    selectedBookId: 'g3-01-magic-zoo',
    customBookTitle: '',
    customBookContent: '',
    customTopic: '',
    stars: 0,
  },
  grade6: {
    name: '초6 학생',
    levelKey: 'elem6_high',
    correctionKey: 'gentle',
    speakingFocus: 'balanced',
    subtitleMode: 'hidden',
    speakingPace: 'normal',
    tutorId: 'oliver',
    bookMode: 'library',
    selectedBookId: 'g6-01-future-school',
    customBookTitle: '',
    customBookContent: '',
    customTopic: '',
    stars: 0,
  },
};

const state = {
  activeView: 'kidhome', // 'kidhome' | 'parent' | 'review' | 'leveltest' | 'call' | 'report'
  parentUnlocked: false,
  activeParentTab: 'edu', // 'edu' | 'dash' | 'system'

  activeStudentId: 'grade3',
  profiles: structuredClone(defaultProfiles),

  // Mirrored from active student profile
  selectedTutorId: 'maya',
  levelKey: 'elem3_mid',
  correctionKey: 'gentle',
  speakingFocus: 'balanced',
  subtitleMode: 'hidden', // 'hidden' | 'blur' | 'visible' (Parent-locked)
  speakingPace: 'slow', // 'slow' | 'normal' | 'fast'
  bookFilter: 'all',
  bookMode: 'library',
  selectedBookId: 'g3-01-magic-zoo',
  customBookTitle: '',
  customBookContent: '',
  customTopic: '',

  // Global classroom & noise controls (configured in Parent Admin)
  avatarMode: '3d', // '3d' | 'portrait'
  enableTools: true,
  noiseSensitivity: 'medium', // 'low' | 'medium' | 'high'
  turnWaitMode: 'patient', // 'normal' (1.5s) | 'patient' (2.4s) | 'extra' (3.4s)
  speechMode: 'auto', // 'auto' | 'ptt'

  // Preview modal
  previewBookId: null,
  previewPageIdx: 0,
  previewReadOnly: false,

  // Model & streaming (100% Google AI Studio Free-Tier optimized)
  liveModel: 'gemini-3.8-live',
  customLiveModel: '',
  reportModel: 'gemini-3.8-flash',
  videoIntervalMs: 0, // Manual snapshot default (prevents Gemini Live audio+video 1011 drops on iPad)
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
  callPttMode: false,
  pttPressed: false,
  livePace: 'normal',
  videoTimerId: null,
  callTimerId: null,
  callStartMs: 0,
  waveRafId: null,
  micMuted: false,
  camEnabled: true,

  // 1011 / Wi-Fi / 10-min seamless auto-reconnect state
  isReconnecting: false,
  reconnectAttempts: 0,
  reconnectTimerId: null,
  stableResetTimerId: null,
  pendingGoAwayRotation: false,
  activeCallConfig: null,

  // Live Classroom Metrics & Tools
  studentSpeakingMs: 0,
  sessionStarsEarned: 0,
  sessionWhiteboardNotes: [],
  activeQuiz: null,

  // Classroom active book
  activeCallTextbook: null,
  activeCallPageIdx: 0,

  // Silent Transcript state (for post-call Study Report & FSRS)
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
  cloudSyncBadgeBtn: document.getElementById('cloudSyncBadgeBtn'),
  cloudSyncBadgeLabel: document.getElementById('cloudSyncBadgeLabel'),
  openHistoryBtn: document.getElementById('openHistoryBtn'),
  historyCountBadge: document.getElementById('historyCountBadge'),
  reviewDueBadge: document.getElementById('reviewDueBadge'),
  headerStarCount: document.getElementById('headerStarCount'),
  openParentGateBtn: document.getElementById('openParentGateBtn'),
  parentGateBtnLabel: document.getElementById('parentGateBtnLabel'),

  // Kid Home
  kidHomeView: document.getElementById('kidHomeView'),
  kidApiNotice: document.getElementById('kidApiNotice'),
  kidNoticeOpenParentBtn: document.getElementById('kidNoticeOpenParentBtn'),
  kidProfileCards: document.getElementById('kidProfileCards'),
  kidLaunchTutorImg: document.getElementById('kidLaunchTutorImg'),
  kidLaunchBadge: document.getElementById('kidLaunchBadge'),
  kidLaunchTitle: document.getElementById('kidLaunchTitle'),
  kidLaunchSub: document.getElementById('kidLaunchSub'),
  kidLaunchModeChip: document.getElementById('kidLaunchModeChip'),
  kidLaunchNoiseChip: document.getElementById('kidLaunchNoiseChip'),
  kidLaunchSubChip: document.getElementById('kidLaunchSubChip'),
  kidLaunchPaceChip: document.getElementById('kidLaunchPaceChip'),
  kidStartCallBtn: document.getElementById('kidStartCallBtn'),
  kidPreviewBookBtn: document.getElementById('kidPreviewBookBtn'),
  kidGoReviewBtn: document.getElementById('kidGoReviewBtn'),
  kidHomeError: document.getElementById('kidHomeError'),

  // Parent View
  parentView: document.getElementById('parentView'),
  lockParentBtn: document.getElementById('lockParentBtn'),
  parentTabEdu: document.getElementById('parentTabEdu'),
  parentTabDash: document.getElementById('parentTabDash'),
  parentTabSystem: document.getElementById('parentTabSystem'),

  levelTestView: document.getElementById('levelTestView'),
  reviewView: document.getElementById('reviewView'),

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
  noiseGateCards: document.getElementById('noiseGateCards'),
  turnWaitCards: document.getElementById('turnWaitCards'),
  speechModePills: document.getElementById('speechModePills'),
  liveModelSelect: document.getElementById('liveModelSelect'),
  customLiveModelInput: document.getElementById('customLiveModelInput'),
  reportModelSelect: document.getElementById('reportModelSelect'),
  videoIntervalSelect: document.getElementById('videoIntervalSelect'),
  enableToolsCheckbox: document.getElementById('enableToolsCheckbox'),

  ghSyncStatusBadge: document.getElementById('ghSyncStatusBadge'),
  ghSyncRepoInput: document.getElementById('ghSyncRepoInput'),
  ghSyncTokenInput: document.getElementById('ghSyncTokenInput'),
  ghSyncTokenHint: document.getElementById('ghSyncTokenHint'),
  toggleGhTokenVisBtn: document.getElementById('toggleGhTokenVisBtn'),
  ghSyncStatusMeta: document.getElementById('ghSyncStatusMeta'),
  ghConnectSyncBtn: document.getElementById('ghConnectSyncBtn'),
  ghSyncNowBtn: document.getElementById('ghSyncNowBtn'),
  ghDisconnectBtn: document.getElementById('ghDisconnectBtn'),

  syncIncludeKeyCheckbox: document.getElementById('syncIncludeKeyCheckbox'),
  copySyncLinkBtn: document.getElementById('copySyncLinkBtn'),
  exportBackupBtn: document.getElementById('exportBackupBtn'),
  importBackupBtn: document.getElementById('importBackupBtn'),
  importBackupInput: document.getElementById('importBackupInput'),

  pinStatusHint: document.getElementById('pinStatusHint'),
  changePinForm: document.getElementById('changePinForm'),
  newPinInput: document.getElementById('newPinInput'),
  confirmPinInput: document.getElementById('confirmPinInput'),

  pinModal: document.getElementById('pinModal'),
  closePinModalBtn: document.getElementById('closePinModalBtn'),
  pinUnlockForm: document.getElementById('pinUnlockForm'),
  pinModalHint: document.getElementById('pinModalHint'),
  pinUnlockInput: document.getElementById('pinUnlockInput'),
  pinErrorMsg: document.getElementById('pinErrorMsg'),

  quickLevelTestBtn: document.getElementById('quickLevelTestBtn'),
  levelPills: document.getElementById('levelPills'),
  correctionCards: document.getElementById('correctionCards'),
  speakingFocusCards: document.getElementById('speakingFocusCards'),
  parentMemoryBadge: document.getElementById('parentMemoryBadge'),
  parentMemoryBody: document.getElementById('parentMemoryBody'),
  subtitleSettingCards: document.getElementById('subtitleSettingCards'),
  paceSettingCards: document.getElementById('paceSettingCards'),

  selectedBookSummary: document.getElementById('selectedBookSummary'),
  bookFilterTabs: document.getElementById('bookFilterTabs'),
  countAllBooks: document.getElementById('countAllBooks'),
  countG3Books: document.getElementById('countG3Books'),
  countG6Books: document.getElementById('countG6Books'),
  countAiBooks: document.getElementById('countAiBooks'),
  aiBookGeneratorBar: document.getElementById('aiBookGeneratorBar'),
  aiBookGenForm: document.getElementById('aiBookGenForm'),
  aiBookGradeSelect: document.getElementById('aiBookGradeSelect'),
  aiBookTopicInput: document.getElementById('aiBookTopicInput'),
  generateAiBookBtn: document.getElementById('generateAiBookBtn'),
  textbookGrid: document.getElementById('textbookGrid'),
  customBookPanel: document.getElementById('customBookPanel'),
  customBookTitleInput: document.getElementById('customBookTitleInput'),
  customBookContentInput: document.getElementById('customBookContentInput'),
  freeTalkPanel: document.getElementById('freeTalkPanel'),
  customTopicInput: document.getElementById('customTopicInput'),

  tutorGrid: document.getElementById('tutorGrid'),
  selectedTutorSummary: document.getElementById('selectedTutorSummary'),
  previewSampleReportBtn: document.getElementById('previewSampleReportBtn'),

  // Call View (Pure Immersion — No Cheating Aids)
  callView: document.getElementById('callView'),
  tutorStageCard: document.getElementById('tutorStageCard'),
  callAvatar3dMount: document.getElementById('callAvatar3dMount'),
  avatar3dStatusBadge: document.getElementById('avatar3dStatusBadge'),
  callTutorImg: document.getElementById('callTutorImg'),
  callTutorName: document.getElementById('callTutorName'),
  callTutorState: document.getElementById('callTutorState'),
  callPaceBadge: document.getElementById('callPaceBadge'),
  callNoiseGateBadge: document.getElementById('callNoiseGateBadge'),
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

  pttHoldBtn: document.getElementById('pttHoldBtn'),
  togglePttModeBtn: document.getElementById('togglePttModeBtn'),
  togglePttModeLabel: document.getElementById('togglePttModeLabel'),

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
  toggleSidebarBtn: document.getElementById('toggleSidebarBtn'),
  closeSidebarBtn: document.getElementById('closeSidebarBtn'),
  expandPanelBtn: document.getElementById('expandPanelBtn'),
  callSidebar: document.getElementById('callSidebar'),
  endCallBtn: document.getElementById('endCallBtn'),

  callBookPane: document.getElementById('callBookPane'),
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

  // Report View
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
  reportSpeakingMetricsCard: document.getElementById('reportSpeakingMetricsCard'),
  reportSpeakingSub: document.getElementById('reportSpeakingSub'),
  reportSpeakingKpis: document.getElementById('reportSpeakingKpis'),
  reportLongestBox: document.getElementById('reportLongestBox'),
  reportLongestText: document.getElementById('reportLongestText'),
  reportHabitsBox: document.getElementById('reportHabitsBox'),
  reportHabitsList: document.getElementById('reportHabitsList'),
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
let cloudSync = null;

// ==================== HELPERS ====================
let toastTimer = null;
function showToast(msg, duration = 2600) {
  el.toast.textContent = msg;
  el.toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.add('hidden'), duration);
}

function showKidError(msg) {
  if (!msg) {
    el.kidHomeError.classList.add('hidden');
    el.kidHomeError.textContent = '';
    return;
  }
  el.kidHomeError.textContent = msg;
  el.kidHomeError.classList.remove('hidden');
}

function getParentPin() {
  return localStorage.getItem(STORAGE_KEYS.PARENT_PIN) || '0000';
}

function getProfile(studentId = state.activeStudentId) {
  return state.profiles[studentId] || state.profiles.grade3;
}

function getTutorById(id) {
  return TUTORS.find((t) => t.id === id) || TUTORS[0];
}

function getSelectedTutor() {
  return getTutorById(state.selectedTutorId);
}

function getStudentDisplayName(studentId = state.activeStudentId) {
  const p = getProfile(studentId);
  if (p.name && p.name.trim()) return p.name.trim();
  return studentId === 'grade6' ? '초6 학생' : '초3 학생';
}

function getTextbookForProfile(p) {
  if (p.bookMode === 'freetalk') return null;
  if (p.bookMode === 'custom') {
    const content = (p.customBookContent || '').trim();
    if (!content) return null;
    return {
      id: 'custom-book',
      gradeTag: '직접 입력 교재',
      levelRange: LEVELS[p.levelKey]?.shortLabel || '',
      title: (p.customBookTitle || '').trim() || '직접 입력한 영어 교재',
      cover: 'assets/book_future_school.jpg',
      customContent: content,
      pages: [
        {
          step: 'Custom Lesson Material',
          heading: (p.customBookTitle || '').trim() || '내 수업 지문',
          instructionKo: '선생님과 함께 지문을 읽고 영어로 대화해 보세요.',
          readingTitle: (p.customBookTitle || '').trim() || 'Reading Passage',
          readingParagraphs: content.split(/\n{2,}/).map((x) => x.trim()).filter(Boolean),
        },
      ],
    };
  }
  const allBooks = getAllTextbooks();
  return allBooks.find((b) => b.id === p.selectedBookId) || allBooks[0];
}

function getSelectedTextbookObj() {
  syncCurrentProfileFields();
  return getTextbookForProfile(getProfile());
}

function getLessonTitleLabel(p = getProfile()) {
  const book = getTextbookForProfile(p);
  if (book) return book.title;
  if (p.customTopic && p.customTopic.trim()) return `프리토킹 · ${p.customTopic.trim()}`;
  return '자유 프리토킹';
}

function getActiveLiveModel() {
  if (state.liveModel === 'custom') return state.customLiveModel.trim() || 'gemini-3.8-live';
  return state.liveModel;
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

function saveHistory(items, { skipSync = false } = {}) {
  localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(items.slice(0, 60)));
  updateBadges();
  if (!skipSync) cloudSync?.schedulePush();
}

function updateBadges() {
  const hist = loadHistory();
  el.historyCountBadge.textContent = String(hist.length);
  const dueCount = loadFsrsDeck().filter(
    (c) => c.studentId === state.activeStudentId && (c.due || 0) <= Date.now()
  ).length;
  el.reviewDueBadge.textContent = String(dueCount);
  el.headerStarCount.textContent = String(getProfile().stars || 0);

  const studentHist = hist.filter((h) => h.studentId === state.activeStudentId);
  const streak = academyPages.computeStreakDays(studentHist);
  el.profileStreakText.textContent = `연속 학습 ${streak}일 · ★ ${getProfile().stars || 0}`;

  el.parentGateBtnLabel.textContent = state.parentUnlocked ? '🔓 부모 관리 중' : '🔒 부모 관리';
}

function syncCurrentProfileFields() {
  const p = getProfile();
  p.levelKey = state.levelKey;
  p.correctionKey = state.correctionKey;
  p.speakingFocus = state.speakingFocus;
  p.subtitleMode = state.subtitleMode;
  p.speakingPace = state.speakingPace;
  p.tutorId = state.selectedTutorId;
  p.bookMode = state.bookMode;
  p.selectedBookId = state.selectedBookId;
  p.customBookTitle = state.customBookTitle;
  p.customBookContent = state.customBookContent;
  p.customTopic = state.customTopic;
}

function applyActiveProfileToState() {
  const p = getProfile();
  const allBooks = getAllTextbooks();
  state.levelKey = LEVELS[p.levelKey] ? p.levelKey : 'elem3_mid';
  state.correctionKey = CORRECTION_MODES[p.correctionKey] ? p.correctionKey : 'gentle';
  state.speakingFocus = SPEAKING_FOCUS_MODES[p.speakingFocus] ? p.speakingFocus : 'balanced';
  state.subtitleMode = ['hidden', 'blur', 'visible'].includes(p.subtitleMode) ? p.subtitleMode : 'hidden';
  state.speakingPace = SPEAKING_PACES[p.speakingPace]
    ? p.speakingPace
    : state.activeStudentId === 'grade6'
      ? 'normal'
      : 'slow';
  state.selectedTutorId = TUTORS.some((t) => t.id === p.tutorId)
    ? p.tutorId
    : state.activeStudentId === 'grade6'
      ? 'oliver'
      : 'maya';
  state.bookMode = p.bookMode || 'library';
  const mappedId = LEGACY_BOOK_ID_MAP[p.selectedBookId] || p.selectedBookId;
  state.selectedBookId = allBooks.some((b) => b.id === mappedId)
    ? mappedId
    : state.activeStudentId === 'grade6'
      ? 'g6-01-future-school'
      : 'g3-01-magic-zoo';
  state.customBookTitle = p.customBookTitle || '';
  state.customBookContent = p.customBookContent || '';
  state.customTopic = p.customTopic || '';
  state.bookFilter = state.bookMode === 'custom' ? 'custom' : state.bookMode === 'freetalk' ? 'freetalk' : 'all';
}

function saveSettings({ skipSync = false } = {}) {
  syncCurrentProfileFields();
  localStorage.setItem(
    STORAGE_KEYS.SETTINGS,
    JSON.stringify({
      activeStudentId: state.activeStudentId,
      profiles: state.profiles,
      avatarMode: state.avatarMode,
      enableTools: state.enableTools,
      noiseSensitivity: state.noiseSensitivity,
      turnWaitMode: state.turnWaitMode,
      speechMode: state.speechMode,
      liveModel: state.liveModel,
      customLiveModel: state.customLiveModel,
      reportModel: state.reportModel,
      videoIntervalMs: state.videoIntervalMs,
      shareCamera: state.shareCamera,
    })
  );
  if (!skipSync) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS_UPDATED_AT, String(Date.now()));
    cloudSync?.schedulePush();
  }
  updateBadges();
}

function restoreSettings() {
  const savedKey = localStorage.getItem(STORAGE_KEYS.API_KEY);
  if (savedKey) el.apiKeyInput.value = savedKey;

  try {
    const raw =
      localStorage.getItem(STORAGE_KEYS.SETTINGS) ||
      localStorage.getItem('fluentcam_academy_pro_v3');
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved.profiles) {
        const migrateBook = (id, fallback) => LEGACY_BOOK_ID_MAP[id] || id || fallback;
        state.profiles = {
          grade3: {
            ...defaultProfiles.grade3,
            ...(saved.profiles.grade3 || {}),
            selectedBookId: migrateBook(saved.profiles.grade3?.selectedBookId, 'g3-01-magic-zoo'),
          },
          grade6: {
            ...defaultProfiles.grade6,
            ...(saved.profiles.grade6 || {}),
            selectedBookId: migrateBook(saved.profiles.grade6?.selectedBookId, 'g6-01-future-school'),
          },
        };
      }
      if (saved.activeStudentId && state.profiles[saved.activeStudentId]) {
        state.activeStudentId = saved.activeStudentId;
      }
      if (saved.avatarMode === '3d' || saved.avatarMode === 'portrait') state.avatarMode = saved.avatarMode;
      if (typeof saved.enableTools === 'boolean') state.enableTools = saved.enableTools;
      if (['low', 'medium', 'high'].includes(saved.noiseSensitivity)) state.noiseSensitivity = saved.noiseSensitivity;
      if (['normal', 'patient', 'extra'].includes(saved.turnWaitMode)) state.turnWaitMode = saved.turnWaitMode;
      if (['auto', 'ptt'].includes(saved.speechMode)) state.speechMode = saved.speechMode;
      if (saved.liveModel) {
        state.liveModel =
          saved.liveModel === 'gemini-2.5-flash-native-audio-preview-12-2025'
            ? 'gemini-3.8-live'
            : saved.liveModel;
      }
      if (saved.customLiveModel) state.customLiveModel = saved.customLiveModel;
      if (saved.reportModel) {
        state.reportModel =
          saved.reportModel === 'gemini-2.5-flash' ? 'gemini-3.8-flash' : saved.reportModel;
      }
      if (typeof saved.videoIntervalMs === 'number') state.videoIntervalMs = saved.videoIntervalMs;
      if (typeof saved.shareCamera === 'boolean') state.shareCamera = saved.shareCamera;
    }
  } catch {
    // ignore
  }
  applyActiveProfileToState();
}

function setParentTab(tabName) {
  state.activeParentTab = tabName;
  document.querySelectorAll('[data-parent-tab]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.parentTab === tabName);
  });
  el.parentTabEdu.classList.toggle('hidden', tabName !== 'edu');
  el.parentTabDash.classList.toggle('hidden', tabName !== 'dash');
  el.parentTabSystem.classList.toggle('hidden', tabName !== 'system');

  if (tabName === 'edu') renderParentEducationTab();
  if (tabName === 'dash') academyPages.renderDashboardPage();
  if (tabName === 'system') syncParentSystemControls();
}

function switchView(viewName) {
  state.activeView = viewName;
  el.kidHomeView.classList.toggle('hidden', viewName !== 'kidhome');
  el.parentView.classList.toggle('hidden', viewName !== 'parent');
  el.levelTestView.classList.toggle('hidden', viewName !== 'leveltest');
  el.reviewView.classList.toggle('hidden', viewName !== 'review');
  el.callView.classList.toggle('hidden', viewName !== 'call');
  el.reportView.classList.toggle('hidden', viewName !== 'report');
  el.topHeader.classList.toggle('hidden', viewName === 'call');

  document.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.nav === viewName);
  });

  if (viewName === 'kidhome') renderKidHome();
  if (viewName === 'parent') setParentTab(state.activeParentTab);
  if (viewName === 'leveltest') academyPages.renderLevelTest();
  if (viewName === 'review') academyPages.renderReviewPage();
  updateBadges();
}

const academyPages = createAcademyPages({
  getState: () => state,
  getApiKey: () => el.apiKeyInput.value.trim(),
  getHistory: loadHistory,
  saveSettings,
  showToast,
  onApplyRecommendation: ({ levelKey, bookId }) => {
    if (LEVELS[levelKey]) state.levelKey = levelKey;
    const mappedId = LEGACY_BOOK_ID_MAP[bookId] || bookId;
    if (getAllTextbooks().some((b) => b.id === mappedId)) {
      state.bookMode = 'library';
      state.bookFilter = 'all';
      state.selectedBookId = mappedId;
    }
    saveSettings();
    switchView('kidhome');
    showToast('CEFR 진단 추천 레벨과 교재를 바로 적용했어요!');
  },
  onJumpToBook: (bookId) => {
    state.bookMode = 'library';
    state.bookFilter = 'all';
    state.selectedBookId = bookId;
    saveSettings();
    setParentTab('edu');
    showToast('선택한 교재를 현재 학생에게 배정했어요!');
  },
  onOpenReport: (session) => renderReportView(session),
  onDeckChanged: () => updateBadges(),
});

// ==================== KID-SIMPLE LAUNCH HOME ====================
function renderKidHome() {
  showKidError('');
  const hasKey = Boolean(el.apiKeyInput.value.trim());
  el.kidApiNotice.classList.toggle('hidden', hasKey);

  const hist = loadHistory();
  el.kidProfileCards.innerHTML = STUDENT_PRESETS.map((preset) => {
    const p = getProfile(preset.id);
    const active = state.activeStudentId === preset.id;
    const tutor = getTutorById(p.tutorId);
    const book = getTextbookForProfile(p);
    const bookTitle = book ? book.title : getLessonTitleLabel(p);
    const bookThumb = book?.cover || tutor.avatar;
    const streak = academyPages.computeStreakDays(hist.filter((h) => h.studentId === preset.id));

    return `
      <button type="button" class="kid-profile-card ${active ? 'selected' : ''}" data-kid-select="${preset.id}" role="radio" aria-checked="${active}">
        <div class="kid-profile-top">
          <span class="kid-grade-tag">${preset.badge} · ${LEVELS[p.levelKey]?.shortLabel || ''}</span>
          <span class="kid-stars-mini">★ ${p.stars || 0} · ${streak}일 연속</span>
        </div>
        <div>
          <div class="kid-profile-name">${escapeHtml(p.name || preset.defaultName)}</div>
          <div class="kid-profile-level">담당 선생님: ${tutor.name} (${tutor.accentLabel})</div>
        </div>
        <div class="kid-assigned-row">
          <img src="${bookThumb}" alt="" />
          <div style="min-width:0;">
            <strong>${escapeHtml(bookTitle)}</strong>
            <span>${book ? `${book.pages.length}쪽 인터랙티브 교재` : '자유 영어 회화'}</span>
          </div>
        </div>
      </button>
    `;
  }).join('');

  el.kidProfileCards.querySelectorAll('[data-kid-select]').forEach((card) => {
    card.addEventListener('click', () => {
      syncCurrentProfileFields();
      state.activeStudentId = card.dataset.kidSelect;
      applyActiveProfileToState();
      saveSettings();
      renderKidHome();
    });
  });

  // Update Launch Card for selected kid
  const curName = getStudentDisplayName();
  const curTutor = getSelectedTutor();
  const curBook = getSelectedTextbookObj();
  const curLevel = LEVELS[state.levelKey]?.shortLabel || '';

  el.kidLaunchTutorImg.src = curTutor.avatar;
  el.kidLaunchBadge.textContent = `${curName} · ${curLevel}`;
  el.kidLaunchTitle.textContent = `${curTutor.name} 선생님과 수업 시작하기`;
  el.kidLaunchSub.textContent = curBook
    ? `오늘의 교재: ${curBook.title} (${curBook.titleKo || curBook.gradeTag})`
    : `오늘의 수업: ${getLessonTitleLabel()}`;
  el.kidLaunchModeChip.textContent = state.avatarMode === '3d' ? '3D 실시간 립싱크 아바타' : '실사 스튜디오 화면';
  el.kidLaunchNoiseChip.textContent =
    state.speechMode === 'ptt' ? '눌러서 말하기 모드' : NOISE_LABELS[state.noiseSensitivity] || '잡음 차단 ON';
  el.kidLaunchSubChip.textContent = SUBTITLE_LABELS[state.subtitleMode] || '자막 꺼짐 · 순수 리스닝';
  el.kidLaunchPaceChip.textContent = SPEAKING_PACES[state.speakingPace]?.shortLabel || '보통 속도';
  el.kidPreviewBookBtn.classList.toggle('hidden', !curBook || curBook.id === 'custom-book');
}

// ==================== PARENT PIN GATE ====================
function openPinModal() {
  if (state.parentUnlocked) {
    switchView('parent');
    return;
  }
  const isDefault = getParentPin() === '0000';
  el.pinModalHint.innerHTML = isDefault
    ? '4자리 숫자 비밀번호를 입력해 주세요. (최초 기본값: <strong>0000</strong>)'
    : '부모 관리 4자리 숫자 비밀번호를 입력해 주세요.';
  el.pinUnlockInput.value = '';
  el.pinErrorMsg.classList.add('hidden');
  el.pinModal.classList.remove('hidden');
  setTimeout(() => el.pinUnlockInput.focus(), 60);
}

function lockParentMode() {
  state.parentUnlocked = false;
  stopLobbyPreview();
  switchView('kidhome');
  showToast('부모 관리 모드를 잠그고 아이 수업 화면으로 돌아왔습니다.');
}

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

  return sections.join('');
}

// ==================== PARENT EDUCATION & SYSTEM TABS ====================
function renderStudentPresets() {
  el.studentPresetGrid.innerHTML = STUDENT_PRESETS.map((preset) => {
    const active = state.activeStudentId === preset.id;
    const savedProfile = getProfile(preset.id);
    const levelShort = LEVELS[savedProfile.levelKey]?.shortLabel || '';
    return `
      <button type="button" class="student-preset-btn ${active ? 'active' : ''}" data-student-id="${preset.id}" role="radio" aria-checked="${active}">
        <span class="student-preset-grade">${preset.badge} · ${levelShort}</span>
        <strong>${escapeHtml(savedProfile.name || preset.defaultName)}</strong>
        <span class="desc">${preset.desc}</span>
      </button>
    `;
  }).join('');

  el.studentNameInput.value = getProfile().name || '';

  el.studentPresetGrid.querySelectorAll('.student-preset-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      syncCurrentProfileFields();
      state.activeStudentId = btn.dataset.studentId;
      applyActiveProfileToState();
      saveSettings();
      renderParentEducationTab();
      showToast(`${getStudentDisplayName()} 교육 세팅을 불러왔어요.`);
    });
  });
}

function renderTextbooks() {
  const isCustomTab = state.bookFilter === 'custom';
  const isFreeTalkTab = state.bookFilter === 'freetalk';
  const allBooks = getAllTextbooks();
  const g3Count = allBooks.filter((b) => b.gradeTag.includes('초3')).length;
  const g6Count = allBooks.filter((b) => b.gradeTag.includes('초6')).length;
  const aiCount = allBooks.filter((b) => b.isAiGenerated).length;

  el.countAllBooks.textContent = String(allBooks.length);
  el.countG3Books.textContent = String(g3Count);
  el.countG6Books.textContent = String(g6Count);
  el.countAiBooks.textContent = String(aiCount);

  el.bookFilterTabs.querySelectorAll('.filter-tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.filter === state.bookFilter);
  });

  el.aiBookGeneratorBar.classList.toggle('hidden', isCustomTab || isFreeTalkTab);
  el.textbookGrid.classList.toggle('hidden', isCustomTab || isFreeTalkTab);
  el.customBookPanel.classList.toggle('hidden', !isCustomTab);
  el.freeTalkPanel.classList.toggle('hidden', !isFreeTalkTab);

  // Sync AI generator grade dropdown with currently edited student
  el.aiBookGradeSelect.value = state.activeStudentId === 'grade6' ? 'grade6' : 'grade3';

  const completedBooks = new Set(
    loadHistory()
      .filter((s) => s.studentId === state.activeStudentId && s.bookId)
      .map((s) => s.bookId)
  );

  if (!isCustomTab && !isFreeTalkTab) {
    const filtered = allBooks.filter((book) => {
      if (state.bookFilter === 'grade3') return book.gradeTag.includes('초3');
      if (state.bookFilter === 'grade6') return book.gradeTag.includes('초6');
      if (state.bookFilter === 'ai') return Boolean(book.isAiGenerated);
      return true;
    });

    if (filtered.length === 0) {
      el.textbookGrid.innerHTML =
        '<div class="history-empty" style="grid-column: 1 / -1;">아직 AI로 생성한 맞춤 교재가 없습니다.<br/>위 입력창에 아이가 좋아하는 주제를 입력해 새 4쪽 교재를 만들어 보세요!</div>';
    } else {
      el.textbookGrid.innerHTML = filtered
        .map((book) => {
          const selected = state.bookMode === 'library' && state.selectedBookId === book.id;
          const isG6 = book.gradeTag.includes('초6');
          const done = completedBooks.has(book.id);
          return `
            <div class="book-card ${selected ? 'selected' : ''}" data-book-id="${book.id}" role="button" tabindex="0">
              <div class="book-cover-wrap">
                <img src="${book.cover}" alt="${escapeHtml(book.title)}" />
                <span class="book-grade-pill ${isG6 ? 'g6' : ''}">${escapeHtml(book.gradeTag)}</span>
                ${done ? '<span class="book-done-pill">완료 ✓</span>' : ''}
                <span class="book-selected-mark" aria-hidden="true">✓</span>
              </div>
              <div class="book-card-body">
                <span class="book-category">${escapeHtml(book.category)}</span>
                <h3>${escapeHtml(book.title)}</h3>
                <p class="book-subtitle">${escapeHtml(book.titleKo)}</p>
                <p class="book-desc">${escapeHtml(book.description)}</p>
                <div class="book-card-footer">
                  <span class="book-pages-count">${book.pages.length}쪽 · ${escapeHtml(book.levelRange)}</span>
                  <div class="book-card-footer-btns">
                    ${book.isAiGenerated ? `<button type="button" class="book-del-ai-btn" data-del-ai-book="${book.id}">삭제</button>` : ''}
                    <button type="button" class="btn btn-secondary btn-sm" data-preview-book="${book.id}">미리보기</button>
                  </div>
                </div>
              </div>
            </div>
          `;
        })
        .join('');

      el.textbookGrid.querySelectorAll('.book-card').forEach((card) => {
        card.addEventListener('click', (e) => {
          if (e.target.closest('[data-preview-book]') || e.target.closest('[data-del-ai-book]')) return;
          state.bookMode = 'library';
          state.selectedBookId = card.dataset.bookId;
          saveSettings();
          renderTextbooks();
        });
      });

      el.textbookGrid.querySelectorAll('[data-preview-book]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          openBookPreviewModal(btn.dataset.previewBook, { readOnly: false });
        });
      });

      el.textbookGrid.querySelectorAll('[data-del-ai-book]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const delId = btn.dataset.delAiBook;
          deleteCustomAiTextbook(delId);
          if (state.selectedBookId === delId) {
            state.selectedBookId = state.activeStudentId === 'grade6' ? 'g6-01-future-school' : 'g3-01-magic-zoo';
            saveSettings();
          }
          renderTextbooks();
          showToast('AI 생성 교재를 삭제했습니다.');
        });
      });
    }
  }

  el.selectedBookSummary.textContent = getLessonTitleLabel();
}

async function handleGenerateAiBook(e) {
  e.preventDefault();
  const apiKey = el.apiKeyInput.value.trim();
  const topic = el.aiBookTopicInput.value.trim();
  const grade = el.aiBookGradeSelect.value;

  if (!apiKey) {
    showToast('먼저 [3. API 키 · 잡음 차단 · 비밀번호] 탭에서 Gemini API 키를 입력해 주세요.', 3800);
    setParentTab('system');
    return;
  }
  if (!topic) return;

  el.generateAiBookBtn.disabled = true;
  el.generateAiBookBtn.textContent = '✨ 4쪽 교재 생성 중...';

  try {
    const newBook = await generateAiTextbook({
      apiKey,
      model: state.reportModel,
      topic,
      grade,
    });
    saveCustomAiTextbook(newBook);
    state.bookMode = 'library';
    state.selectedBookId = newBook.id;
    state.bookFilter = 'ai';
    el.aiBookTopicInput.value = '';
    saveSettings();
    renderTextbooks();
    showToast(`새 4쪽 교재 "${newBook.title}"가 생성되어 바로 배정되었습니다!`, 3600);
  } catch (err) {
    showToast(err.message || '교재 생성 중 오류가 발생했습니다.', 4200);
  } finally {
    el.generateAiBookBtn.disabled = false;
    el.generateAiBookBtn.textContent = '✨ 4쪽 교재 생성';
  }
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
  el.selectedTutorSummary.textContent = `${cur.name} · ${cur.origin} (${cur.voiceName})`;

  el.tutorGrid.querySelectorAll('.tutor-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.selectedTutorId = btn.dataset.tutorId;
      saveSettings();
      renderTutors();
    });
  });
}

function renderParentMemoryPreview() {
  if (!el.parentMemoryBadge || !el.parentMemoryBody) return;
  const mem = buildLearnerMemory({
    studentId: state.activeStudentId,
    history: loadHistory(),
    fsrsDeck: loadFsrsDeck(),
  });

  if (!mem.hasHistory && mem.reviewPhrases.length === 0) {
    el.parentMemoryBadge.textContent = '첫 수업 준비 중';
    el.parentMemoryBody.textContent =
      '수업을 1회 이상 완료하면 아이의 약점 습관·평균 문장 길이·복습 표현을 AI 선생님이 자동으로 기억해 다음 수업 워밍업에 반영합니다.';
    return;
  }

  const avgNote = mem.lastAvgWords ? ` · 직전 평균 ${mem.lastAvgWords}단어/턴` : '';
  el.parentMemoryBadge.textContent = mem.hasHistory
    ? `누적 ${mem.sessionCount}회 수업 연계${avgNote}`
    : `FSRS 복습 표현 ${mem.reviewPhrases.length}개 연계`;

  const items = [];
  if (mem.lastTopic) {
    items.push(`<li><strong>직전 수업:</strong> ${escapeHtml(mem.lastTopic)}</li>`);
  }
  if (mem.recurringHabits.length > 0) {
    items.push(
      `<li><strong>집중 보완 습관:</strong> ${mem.recurringHabits.map((h) => escapeHtml(h)).join(' / ')}</li>`
    );
  } else if (mem.recentUpgrades.length > 0) {
    items.push(
      `<li><strong>지난 교정 재훈련:</strong> "${escapeHtml(mem.recentUpgrades[0].improved)}"</li>`
    );
  }
  if (mem.reviewPhrases.length > 0) {
    const phraseList = mem.reviewPhrases.map((p) => `"${escapeHtml(p.front)}"`).join(', ');
    items.push(`<li><strong>워밍업 자동 복습 표현:</strong> ${phraseList}</li>`);
  }
  el.parentMemoryBody.innerHTML = `<ul>${items.join('')}</ul>`;
}

function renderParentEducationTab() {
  renderStudentPresets();
  el.levelPills.querySelectorAll('.level-card').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.level === state.levelKey);
  });
  el.correctionCards.querySelectorAll('.choice-card').forEach((card) => {
    card.classList.toggle('active', card.dataset.correction === state.correctionKey);
  });
  el.speakingFocusCards?.querySelectorAll('.choice-card').forEach((card) => {
    card.classList.toggle('active', card.dataset.speakingFocus === state.speakingFocus);
  });
  el.subtitleSettingCards.querySelectorAll('.choice-card').forEach((card) => {
    card.classList.toggle('active', card.dataset.subtitleMode === state.subtitleMode);
  });
  el.paceSettingCards.querySelectorAll('.choice-card').forEach((card) => {
    card.classList.toggle('active', card.dataset.pace === state.speakingPace);
  });
  el.avatarModePills.querySelectorAll('.seg-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.avatarMode === state.avatarMode);
  });
  el.customBookTitleInput.value = state.customBookTitle;
  el.customBookContentInput.value = state.customBookContent;
  el.customTopicInput.value = state.customTopic;

  renderParentMemoryPreview();
  renderTextbooks();
  renderTutors();
  updateBadges();
}

function syncParentSystemControls() {
  el.shareCamCheckbox.checked = state.shareCamera;
  el.enableToolsCheckbox.checked = state.enableTools;
  el.liveModelSelect.value = state.liveModel;
  el.customLiveModelInput.value = state.customLiveModel;
  el.customLiveModelInput.classList.toggle('hidden', state.liveModel !== 'custom');
  el.reportModelSelect.value = state.reportModel;
  el.videoIntervalSelect.value = String(state.videoIntervalMs);

  el.noiseGateCards.querySelectorAll('.choice-card').forEach((c) => {
    c.classList.toggle('active', c.dataset.noise === state.noiseSensitivity);
  });
  el.turnWaitCards?.querySelectorAll('.choice-card').forEach((c) => {
    c.classList.toggle('active', c.dataset.turnWait === state.turnWaitMode);
  });
  el.speechModePills.querySelectorAll('.seg-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.speechMode === state.speechMode);
  });
  el.pinStatusHint.textContent = getParentPin() === '0000' ? '현재 기본값: 0000 (변경을 권장해요)' : '사용자 비밀번호 설정됨';

  const ghCfg = loadGitHubSyncConfig();
  if (!el.ghSyncRepoInput.value.trim() || ghCfg.enabled) {
    el.ghSyncRepoInput.value = ghCfg.repo || DEFAULT_SYNC_REPO;
  }
  // Never wipe an unsaved token the parent just typed/pasted before clicking Connect
  if (ghCfg.token && !el.ghSyncTokenInput.value.trim()) {
    el.ghSyncTokenInput.value = ghCfg.token;
  }
  updateGhTokenHint();
  cloudSync?.emitCurrentStatus();
}

// ==================== TEXTBOOK PREVIEW MODAL ====================
function renderBookPreviewPage() {
  const book = getAllTextbooks().find((b) => b.id === state.previewBookId);
  if (!book) return;
  const page = book.pages[state.previewPageIdx] || book.pages[0];

  el.bookPreviewMeta.textContent = `${book.gradeTag} · ${book.levelRange} · ${page.step}`;
  el.bookPreviewTitle.textContent = `${book.title} — ${page.heading}`;
  el.bookPreviewBody.innerHTML = renderBookPageMarkup(page, { interactive: false });
  el.bookPreviewBody.scrollTop = 0;

  el.previewPageCounter.textContent = `${state.previewPageIdx + 1} / ${book.pages.length}`;
  el.previewPrevPageBtn.disabled = state.previewPageIdx <= 0;
  el.previewNextPageBtn.disabled = state.previewPageIdx >= book.pages.length - 1;
  el.selectPreviewBookBtn.classList.toggle('hidden', state.previewReadOnly);
}

function openBookPreviewModal(bookId, { readOnly = false } = {}) {
  state.previewBookId = bookId;
  state.previewPageIdx = 0;
  state.previewReadOnly = readOnly;
  renderBookPreviewPage();
  el.bookPreviewModal.classList.remove('hidden');
}

// ==================== IN-CALL TEXTBOOK & CLASSROOM TOOLS ====================
function renderActiveCallBookPage({ notifyTutor = false } = {}) {
  const book = state.activeCallTextbook;
  whiteboard.clear();

  if (!book || !Array.isArray(book.pages) || book.pages.length === 0) {
    const topicLabel = getLessonTitleLabel();
    el.callBookStepBadge.textContent = 'Free Talk · 화이트보드';
    el.callBookHeading.textContent = topicLabel;
    el.callBookScroll.innerHTML = `
      <div class="freetalk-board-card">
        <h3>🎤 순수 화상 프리토킹 교실</h3>
        <p>교재 없이 원어민 선생님과 얼굴을 보며 자유롭게 영어로 대화해요!<br/>위 <b>✏️ 펜 판서</b> 버튼을 누르면 그림을 그려 선생님께 바로 보여줄 수 있습니다.</p>
      </div>
    `;
    el.callBookNav.classList.add('hidden');
    return;
  }

  const total = book.pages.length;
  const idx = Math.max(0, Math.min(total - 1, state.activeCallPageIdx));
  state.activeCallPageIdx = idx;
  const page = book.pages[idx];

  el.callBookStepBadge.textContent = `${book.title} · ${page.step}`;
  el.callBookHeading.textContent = page.heading;
  el.callBookScroll.innerHTML = renderBookPageMarkup(page, { interactive: true });
  el.callBookScroll.scrollTop = 0;

  el.callBookScroll.querySelectorAll('[data-ask-word]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const word = btn.dataset.askWord;
      if (!state.inCall || !word) return;
      state.liveClient?.sendTextTurn(
        `I clicked the word "${word}" in our textbook! Could you pronounce it clearly and ask me to make a short sentence with it?`
      );
      showToast(`"${word}" 단어 발음·연습을 선생님께 요청했어요!`);
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
    const pageDetail = formatSingleTextbookPage(page, idx + 1);
    state.liveClient?.sendTextTurn(
      `[Lesson Page Sync] I turned our textbook to Page ${idx + 1}. Practice this page now:\n${pageDetail}`
    );
    showToast(`교재 ${idx + 1}쪽으로 이동했어요 — AI 선생님 화면과 동기화됨`);
  }
}

let starBannerTimer = null;
function triggerGoldStar(reason) {
  state.sessionStarsEarned += 1;
  getProfile().stars = (getProfile().stars || 0) + 1;
  saveSettings();

  el.callStarCount.textContent = String(state.sessionStarsEarned);
  el.starCelebrateReason.textContent = reason || '완전한 문장으로 정말 잘했어요!';
  el.starCelebrateBanner.classList.remove('hidden');
  playRewardChime('star');
  state.avatar3d?.setMood('happy');
  state.avatar3d?.playGesture('thumbup', 2.8);

  clearTimeout(starBannerTimer);
  starBannerTimer = setTimeout(() => el.starCelebrateBanner.classList.add('hidden'), 4200);
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

function updateCallPaceUI(paceKey) {
  const valid = SPEAKING_PACES[paceKey] ? paceKey : 'normal';
  state.livePace = valid;
  el.callPaceBadge.textContent = SPEAKING_PACES[valid].shortLabel;
  el.callPaceBadge.classList.toggle('is-slow', valid === 'slow');
}

async function handleGeminiToolCall(fnCall) {
  const name = fnCall.name;
  const args = fnCall.args || {};
  const coachSnap = buildMidCallCoachFeedback(state.transcript);
  const coachNote =
    coachSnap && coachSnap.studentTurns >= 2 && coachSnap.coachTip ? coachSnap.coachTip : '';

  if (name === 'turn_textbook_page') {
    const book = state.activeCallTextbook;
    if (!book || !book.pages?.length) return { ok: false, message: 'No textbook active.' };
    const targetIdx = Math.max(0, Math.min(book.pages.length - 1, Number(args.pageNumber || 1) - 1));
    state.activeCallPageIdx = targetIdx;
    renderActiveCallBookPage({ notifyTutor: false });
    showToast(`선생님이 교재를 ${targetIdx + 1}쪽으로 넘겼어요!`);
    return {
      ok: true,
      currentPage: targetIdx + 1,
      heading: book.pages[targetIdx].heading,
      pageContent: formatSingleTextbookPage(book.pages[targetIdx], targetIdx + 1),
      ...(coachNote ? { coachNote } : {}),
    };
  }

  if (name === 'award_gold_star') {
    triggerGoldStar(args.reason || '정말 잘했어요!');
    return { ok: true, totalSessionStars: state.sessionStarsEarned, ...(coachNote ? { coachNote } : {}) };
  }

  if (name === 'write_on_whiteboard') {
    showChalkboardNote(args.englishSentence || '', args.koreanTip || '');
    return { ok: true, displayed: true, ...(coachNote ? { coachNote } : {}) };
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

  if (name === 'adjust_speaking_pace') {
    const nextPace = SPEAKING_PACES[args.pace] ? args.pace : 'slow';
    updateCallPaceUI(nextPace);
    showToast(
      args.reason || `선생님이 말하는 속도를 [${SPEAKING_PACES[nextPace].label}]로 자동 조절했어요!`,
      3400
    );
    return { ok: true, activePace: nextPace };
  }

  return { ok: true };
}

// ==================== DEVICE PREVIEW (IN PARENT SYSTEM TAB) ====================
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
      el.previewDeviceStatus.textContent = '마이크만 연결됨';
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
    showToast(`마이크/카메라 접근 실패: ${err.message}`, 3600);
  }
}

// ==================== SILENT TRANSCRIPT RECORDER (FOR POST-CALL REPORT) ====================
function resetTranscriptUI() {
  state.transcript = [];
  state.activeUserTurn = null;
  state.activeTutorTurn = null;
  el.subtitleText.textContent = '잠시만 기다려 주세요. 원어민 선생님이 교실에 입장하고 있습니다...';
}

function appendOrUpdateTurn(role, chunkText) {
  const tutor = getSelectedTutor();
  const studentName = getStudentDisplayName();
  const isUser = role === 'user';

  if (isUser && state.activeTutorTurn) state.activeTutorTurn = null;
  else if (!isUser && state.activeUserTurn) state.activeUserTurn = null;

  let turn = isUser ? state.activeUserTurn : state.activeTutorTurn;
  if (!turn) {
    turn = { role, text: '', time: Date.now() };
    state.transcript.push(turn);
    if (isUser) state.activeUserTurn = turn;
    else state.activeTutorTurn = turn;
  }

  turn.text = mergeTranscriptChunk(turn.text, chunkText);

  // Only show live subtitle overlay when Parent Admin enabled 'visible' or 'blur'
  if (state.subtitleMode !== 'hidden') {
    el.subtitleSpeaker.textContent = isUser ? studentName : `${tutor.name} (${tutor.accentLabel})`;
    el.subtitleText.textContent = turn.text;
    el.subtitleOverlay.classList.remove('revealed');
  }
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
  let smoothEnergy = 0;

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

    let energySum = 0;
    for (let i = 0; i < barCount; i++) {
      const val = speaking ? Math.max(0.1, levels[i]) : 0.08;
      energySum += levels[i] || 0;
      const barH = Math.max(4, val * (h - 8));
      const x = i * (barW + gap);
      const y = (h - barH) / 2;
      ctx.fillStyle = speaking ? 'rgba(217, 119, 69, 0.92)' : 'rgba(245, 239, 230, 0.28)';
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH, 4);
      ctx.fill();
    }

    // Subtle audio-reactive studio presence in Portrait mode
    if (!state.using3dInCall) {
      const avg = speaking ? energySum / barCount : 0;
      smoothEnergy = smoothEnergy * 0.78 + avg * 0.22;
      const scale = 1.01 + smoothEnergy * 0.028;
      const yShift = -smoothEnergy * 3.2;
      el.callTutorImg.style.transform = `scale(${scale.toFixed(4)}) translateY(${yShift.toFixed(2)}px)`;
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

function updatePttUI() {
  el.pttHoldBtn.classList.toggle('hidden', !state.callPttMode);
  el.pttHoldBtn.classList.toggle('holding', state.pttPressed);
  el.togglePttModeLabel.textContent = state.callPttMode ? '눌러말하기 중' : '자동 감지';
  if (state.callPttMode) {
    el.callNoiseGateBadge.textContent = state.pttPressed ? '🎤 말하는 중!' : '눌러서 말하기 (Space)';
    el.callNoiseGateBadge.classList.toggle('active-voice', state.pttPressed);
  }
}

function setPttPressed(pressed) {
  if (!state.inCall || !state.callPttMode || state.micMuted) return;
  if (state.pttPressed === pressed) return;
  state.pttPressed = pressed;
  state.captureWorkletNode?.port.postMessage({ pttPressed: pressed });
  updatePttUI();
}

function updateCamUI() {
  el.camToggleBtn.classList.toggle('is-off', !state.camEnabled);
  el.camOnIcon.classList.toggle('hidden', !state.camEnabled);
  el.camOffIcon.classList.toggle('hidden', state.camEnabled);
  el.camToggleLabel.textContent = state.camEnabled ? '카메라' : '카메라 꺼짐';
  el.callUserCamOff.classList.toggle('hidden', state.camEnabled);
  el.visionSharingBadge.classList.toggle('hidden', !state.camEnabled || state.videoIntervalMs === 0);
}

function updateAvatarLayerUI() {
  const show3d = state.using3dInCall && state.avatar3d?.ready;
  el.callAvatar3dMount.classList.toggle('hidden', !show3d);
  el.callTutorImg.classList.toggle('hidden', show3d);
  el.toggleAvatarViewLabel.textContent = show3d ? '3D 립싱크' : '실사 화면';
}

function applySubtitleMode() {
  // Strictly controlled by Parent Admin setting (hidden | blur | visible)
  el.subtitleOverlay.dataset.mode = state.subtitleMode || 'hidden';
}

async function startCall() {
  showKidError('');
  const apiKey = el.apiKeyInput.value.trim();
  if (!apiKey) {
    showKidError('아직 Gemini API 키가 등록되지 않았어요. 오른쪽 위 [🔒 부모 관리]에서 API 키를 입력해 주세요.');
    return;
  }

  saveSettings();
  await stopLobbyPreview();

  const tutor = getSelectedTutor();
  const studentName = getStudentDisplayName();
  const textbook = getSelectedTextbookObj();
  const liveModel = getActiveLiveModel();

  el.kidStartCallBtn.disabled = true;
  el.kidStartCallBtn.querySelector('span').textContent = '선생님 교실 연결 중...';

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
    state.callPttMode = state.speechMode === 'ptt';
    state.pttPressed = false;
    state.studentSpeakingMs = 0;
    state.sessionStarsEarned = 0;
    state.sessionWhiteboardNotes = [];
    state.activeCallTextbook = textbook;
    state.activeCallPageIdx = 0;

    switchView('call');
    el.callTutorImg.src = tutor.avatar;
    el.callTutorImg.alt = `${tutor.name} 선생님`;
    el.callTutorImg.classList.remove('hidden');
    el.callTutorImg.style.transform = '';
    el.callAvatar3dMount.classList.add('hidden');
    el.callTutorName.textContent = `${tutor.name} · ${tutor.accentLabel}`;
    el.callTutorState.textContent = '교실 준비 중...';
    el.callStarCount.textContent = '0';
    el.callStudentChip.textContent = `${studentName} · ${LEVELS[state.levelKey].shortLabel}`;
    el.pipStudentLabel.textContent = studentName;
    el.tutorStageCard.classList.remove('connected', 'speaking');
    el.chalkboardBanner.classList.add('hidden');
    el.starCelebrateBanner.classList.add('hidden');
    el.popQuizCard.classList.add('hidden');
    el.callSidebar.classList.remove('collapsed');
    resetTranscriptUI();
    whiteboard.setEnabled(false);
    whiteboard.clear();
    el.wbToggleBtn.classList.remove('active');
    el.wbColorsGroup.classList.add('hidden');

    renderActiveCallBookPage({ notifyTutor: false });

    el.callUserVideo.srcObject = state.camEnabled ? stream : null;
    updateMicUI();
    updatePttUI();
    updateCamUI();
    applySubtitleMode();
    updateCallPaceUI(state.speakingPace);

    // 3D Lip-Sync Avatar
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

    // PCM Audio Player with Echo Guard feedback to worklet
    state.audioPlayer = new PcmAudioPlayer((isSpeaking) => {
      el.tutorStageCard.classList.toggle('speaking', isSpeaking);
      state.captureWorkletNode?.port.postMessage({ tutorSpeaking: isSpeaking });
      if (state.inCall) {
        el.callTutorState.textContent = isSpeaking ? '말하는 중...' : '듣고 있어요';
      }
    });
    await state.audioPlayer.init(externalAudioTarget);

    // Build Cross-Session Learner Memory from past reports & due FSRS phrases
    const learnerMemory = buildLearnerMemory({
      studentId: state.activeStudentId,
      history: loadHistory(),
      fsrsDeck: loadFsrsDeck(),
    });

    // Connect Gemini Live WebSocket (with 1011/Wi-Fi auto-reconnect & automatic model failover)
    const systemInstruction = buildSystemInstruction({
      tutor,
      studentName,
      levelKey: state.levelKey,
      correctionKey: state.correctionKey,
      speakingFocus: state.speakingFocus,
      speakingPace: state.speakingPace,
      textbook,
      activePageIdx: 0,
      customTopic: state.customTopic,
      learnerMemoryBlock: learnerMemory.promptBlock,
    });

    const turnWaitCfg = TURN_WAIT_CONFIG[state.turnWaitMode] || TURN_WAIT_CONFIG.patient;
    const isIpadOrIos =
      /iPad|iPhone|iPod/i.test(navigator.userAgent || '') ||
      (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1);

    state.isReconnecting = false;
    state.reconnectAttempts = 0;
    state.pendingGoAwayRotation = false;
    state.activeCallConfig = {
      apiKey,
      model: liveModel,
      voiceName: tutor.voiceName,
      baseSystemInstruction: systemInstruction,
      tools: state.enableTools ? buildClassroomToolDeclarations() : [],
      strictNoiseGuard: state.noiseSensitivity === 'high',
      silenceDurationMs: turnWaitCfg.ms,
      isIpadOrIos,
    };

    state.liveClient = new GeminiLiveClient({
      onAudioChunk: (b64, sampleRate) => state.audioPlayer?.enqueueBase64Pcm(b64, sampleRate),
      onInterrupted: () => {
        state.audioPlayer?.interrupt();
        finalizeActiveTurns();
      },
      onInputTranscription: (text) => appendOrUpdateTurn('user', text),
      onOutputTranscription: (text) => appendOrUpdateTurn('tutor', text),
      onTurnComplete: () => {
        finalizeActiveTurns();
        if (state.pendingGoAwayRotation && state.inCall && !state.isReconnecting) {
          state.pendingGoAwayRotation = false;
          scheduleSeamlessReconnect({ code: 1000, reason: 'goAway', proactive: true });
        }
      },
      onGoAway: () => {
        // Server warns ~60s before 10-min limit: rotate smoothly on next idle turn
        state.pendingGoAwayRotation = true;
      },
      onToolCall: handleGeminiToolCall,
      onError: () => {
        // Handled cleanly inside onClose reconnect flow so we don't spam error toasts
      },
      onClose: ({ closedByUser, code, reason }) => {
        if (!closedByUser && state.inCall) {
          handleUnexpectedLiveClose({ code, reason });
        }
      },
    });

    const connectedModel = await connectLiveWithFallback({
      client: state.liveClient,
      cfg: state.activeCallConfig,
      preferredModel: liveModel,
    });
    state.activeCallConfig.model = connectedModel;
    if (connectedModel !== liveModel) {
      showToast(`안정적인 연결을 위해 [${connectedModel}] 모델로 자동 전환했어요.`, 3600);
    }

    // Smart Noise-Gate AudioWorklet (with patient mid-sentence pause hold)
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    state.captureAudioCtx = new AudioCtx();
    if (state.captureAudioCtx.state === 'suspended') {
      await state.captureAudioCtx.resume().catch(() => {});
    }
    await state.captureAudioCtx.audioWorklet.addModule('./js/audio-worklet.js?v=20261124a');

    const micSource = state.captureAudioCtx.createMediaStreamSource(stream);
    const workletNode = new AudioWorkletNode(state.captureAudioCtx, 'pcm16k-capture-processor');
    state.captureWorkletNode = workletNode;

    workletNode.port.postMessage({
      sensitivity: state.noiseSensitivity,
      turnWaitMs: turnWaitCfg.ms,
      pttMode: state.callPttMode,
      pttPressed: false,
      tutorSpeaking: false,
    });

    workletNode.port.onmessage = (event) => {
      const msg = event.data;
      if (!msg) return;

      if (msg.type === 'speechEnd') {
        if (msg.reason !== 'tutorStarted' && !state.isReconnecting) {
          state.liveClient?.sendAudioStreamEnd();
        }
        if (!state.callPttMode) {
          el.callNoiseGateBadge.textContent = NOISE_LABELS[state.noiseSensitivity] || '잡음 차단 대기';
          el.callNoiseGateBadge.classList.remove('active-voice', 'waiting-pause');
        }
        return;
      }

      if (typeof msg.rms === 'number') {
        const level = Math.min(1, msg.rms * 6.5);
        const showRing = !state.micMuted && Boolean(msg.gateOpen) && !msg.inPause && level > 0.05;
        el.callMicRing.style.opacity = showRing ? String(Math.min(0.95, level)) : '0';
        el.callMicRing.style.transform = `scale(${0.85 + level * 0.45})`;

        if (!state.callPttMode) {
          if (msg.gateOpen && msg.inPause) {
            el.callNoiseGateBadge.textContent = '⏳ 이어서 기다리는 중...';
            el.callNoiseGateBadge.classList.remove('active-voice');
            el.callNoiseGateBadge.classList.add('waiting-pause');
          } else if (msg.gateOpen) {
            el.callNoiseGateBadge.textContent = '🎤 말소리 듣는 중';
            el.callNoiseGateBadge.classList.remove('waiting-pause');
            el.callNoiseGateBadge.classList.add('active-voice');
          } else {
            el.callNoiseGateBadge.textContent = NOISE_LABELS[state.noiseSensitivity] || '잡음 차단 대기';
            el.callNoiseGateBadge.classList.remove('active-voice', 'waiting-pause');
          }
        }
      }

      if (msg.type === 'pcm' && msg.buffer && !state.micMuted && !state.isReconnecting) {
        if (!msg.inPause) state.studentSpeakingMs += 100;
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

    // iPad/iOS Guard: never spam fast 1.2s JPEG frames on iPad (triggers Gemini Live 1011 audio+video disconnect)
    const effectiveVideoIntervalMs = isIpadOrIos
      ? state.videoIntervalMs >= 3500
        ? state.videoIntervalMs
        : 0
      : state.videoIntervalMs;

    if (state.camEnabled && effectiveVideoIntervalMs > 0) {
      state.videoTimerId = setInterval(() => {
        if (state.isReconnecting || state.audioPlayer?.isSpeaking) return;
        const maxW = isIpadOrIos ? 384 : 480;
        const quality = isIpadOrIos ? 0.55 : 0.62;
        const frame = captureWebcamJpegBase64(quality, maxW);
        if (frame) state.liveClient?.sendVideoFrameBase64(frame);
      }, effectiveVideoIntervalMs);
    }

    startWaveformLoop();

    setTimeout(() => {
      if (!state.inCall) return;
      // Only push an initial camera frame if continuous video streaming is enabled (keeps manual-snapshot mode pure audio & immune to 1011)
      if (state.camEnabled && effectiveVideoIntervalMs > 0) {
        const firstFrame = captureWebcamJpegBase64(0.58, 420);
        if (firstFrame) state.liveClient?.sendVideoFrameBase64(firstFrame);
      }
      state.avatar3d?.playGesture('handup', 2.0);

      const memoryHint =
        learnerMemory.hasHistory && learnerMemory.reviewPhrases.length > 0
          ? ' Start with a warm welcome back and a quick 1-question warm-up before diving in!'
          : '';
      const openingCue = textbook
        ? `Hi ${tutor.name}! My name is ${studentName}. I have "${textbook.title}" open to Page 1.${memoryHint} Greet me warmly in 1-2 short sentences and ask ONE easy opening question!`
        : `Hi ${tutor.name}! My name is ${studentName}.${memoryHint} Greet me warmly in 1-2 short sentences and ask ONE fun question to get me speaking English!`;
      state.liveClient?.sendTextTurn(openingCue);
    }, 450);
  } catch (err) {
    await teardownCallResources();
    switchView('kidhome');
    showKidError(err.message || '화상 통화 연결 중 오류가 발생했습니다.');
  } finally {
    el.kidStartCallBtn.disabled = false;
    el.kidStartCallBtn.querySelector('span').textContent = '오늘의 화상영어 시작하기';
  }
}

// High-quality 3.x Free-Tier Live models only (never silently downgrade conversation quality to 2.5)
const LIVE_MODEL_FALLBACKS = [
  'gemini-3.8-live',
  'gemini-3.1-flash-live-preview',
  'gemini-3.8-live-extended-thinking',
];

function isPermanentLiveError(reason = '') {
  const r = String(reason || '').toLowerCase();
  return (
    r.includes('api key') ||
    r.includes('invalid_argument') ||
    r.includes('permission_denied') ||
    r.includes('billing') ||
    r.includes('unauthenticated')
  );
}

function getOrderedLiveModelCandidates(preferredModel) {
  const clean = String(preferredModel || 'gemini-3.8-live').replace(/^models\//, '').trim();
  const list = [clean, ...LIVE_MODEL_FALLBACKS];
  return [...new Set(list.filter(Boolean))];
}

function stopVideoAutoTimer() {
  if (state.videoTimerId) {
    clearInterval(state.videoTimerId);
    state.videoTimerId = null;
  }
}

function buildReconnectContinuityInstruction(baseInstruction) {
  const recent = state.transcript
    .filter((t) => t && t.text && t.text.trim())
    .slice(-6)
    .map((t) => `${t.role === 'user' ? 'Student' : 'Tutor'}: ${t.text.trim()}`)
    .join('\n');
  const activeBook = state.activeCallTextbook;
  const activePage = activeBook?.pages?.[state.activeCallPageIdx];
  const pageNote = activeBook
    ? `Currently on Page ${state.activeCallPageIdx + 1} of "${activeBook.title}".${
        activePage && state.activeCallPageIdx > 0
          ? `\nActive Page Content:\n- ${formatSingleTextbookPage(activePage, state.activeCallPageIdx + 1)}`
          : ''
      }`
    : '';
  return `${baseInstruction}

[SEAMLESS RECONNECTION CONTEXT — DO NOT RESTART THE LESSON!]
There was a brief 1-second network hiccup and you are right back in the middle of the live class!
${pageNote}
${recent ? `Most recent conversation right before the blip:\n${recent}\n` : ''}
Continue naturally right from where you left off in 1 short warm sentence (do NOT re-introduce yourself from scratch or apologize at length).`;
}

async function connectLiveWithFallback({ client, cfg, preferredModel }) {
  const candidates = getOrderedLiveModelCandidates(preferredModel);
  let lastErr = null;

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    try {
      await client.connect({
        apiKey: cfg.apiKey,
        model: candidate,
        voiceName: cfg.voiceName,
        systemInstruction: cfg.baseSystemInstruction,
        tools: cfg.tools,
        strictNoiseGuard: cfg.strictNoiseGuard,
        silenceDurationMs: cfg.silenceDurationMs,
      });
      return candidate;
    } catch (err) {
      lastErr = err;
      if (isPermanentLiveError(err?.reason || err?.message)) {
        throw err;
      }
      // Retry same model once on transient 1011 before falling over to backup Live model
      if (i === 0 && (err?.code === 1011 || err?.code === 1006)) {
        await new Promise((r) => setTimeout(r, 1200));
        try {
          await client.connect({
            apiKey: cfg.apiKey,
            model: candidate,
            voiceName: cfg.voiceName,
            systemInstruction: cfg.baseSystemInstruction,
            tools: cfg.tools,
            strictNoiseGuard: cfg.strictNoiseGuard,
            silenceDurationMs: cfg.silenceDurationMs,
          });
          return candidate;
        } catch (retryErr) {
          lastErr = retryErr;
          if (isPermanentLiveError(retryErr?.reason || retryErr?.message)) throw retryErr;
        }
      }
    }
  }
  throw lastErr || new Error('실시간 음성 서버 연결에 실패했습니다.');
}

function handleUnexpectedLiveClose({ code, reason }) {
  if (!state.inCall) return;
  if (isPermanentLiveError(reason)) {
    showToast(`API 키 또는 권한 오류가 발생했습니다 (${code}: ${reason})`, 5000);
    endCall();
    return;
  }
  // If 1011 occurred while auto video frames were running, stop auto video immediately
  if (code === 1011 && state.videoTimerId) {
    stopVideoAutoTimer();
  }
  scheduleSeamlessReconnect({ code, reason, proactive: false });
}

function scheduleSeamlessReconnect({ code = 1011, reason = '', proactive = false } = {}) {
  if (!state.inCall || state.isReconnecting || !state.activeCallConfig) return;

  const MAX_ATTEMPTS = 4;
  if (!proactive && state.reconnectAttempts >= MAX_ATTEMPTS) {
    const modelTip =
      code === 1011
        ? 'Google 실시간 서버(1011) 응답이 불안정합니다. 부모 관리 → 3번 탭에서 Live 모델을 변경하거나 잠시 후 다시 시도해 주세요.'
        : `연결이 종료되었습니다 (코드 ${code}${reason ? `: ${reason}` : ''})`;
    showToast(modelTip, 5500);
    endCall();
    return;
  }

  state.isReconnecting = true;
  if (!proactive) state.reconnectAttempts += 1;
  const attemptNum = state.reconnectAttempts;
  finalizeActiveTurns();
  state.audioPlayer?.interrupt();

  el.callTutorState.textContent = proactive
    ? '연결 새로고침 중...'
    : `다시 연결 중... (${attemptNum}/${MAX_ATTEMPTS})`;
  if (!proactive && attemptNum === 1) {
    showToast('🔄 연결이 잠시 흔들려 자동으로 이어서 연결하고 있어요!', 3200);
  }

  // Wait ~1.5s after 1011 (immediate 0ms reconnect often gets another 1011 from Google's router)
  const delayMs = proactive ? 250 : attemptNum === 1 ? 1500 : Math.min(4000, 1500 * attemptNum);

  if (state.reconnectTimerId) clearTimeout(state.reconnectTimerId);
  state.reconnectTimerId = setTimeout(async () => {
    state.reconnectTimerId = null;
    if (!state.inCall || !state.liveClient || !state.activeCallConfig) {
      state.isReconnecting = false;
      return;
    }

    const cfg = state.activeCallConfig;
    const candidates = getOrderedLiveModelCandidates(cfg.model);
    // On 2nd+ 1011 retry, rotate to a backup Live model (e.g. 3.8-live <-> 3.1-flash-live-preview <-> 2.5-native-audio)
    const nextModel =
      !proactive && code === 1011 && attemptNum >= 2
        ? candidates[(attemptNum - 1) % candidates.length]
        : cfg.model;

    // For proactive goAway rotation, try saved handle first; for 1011, always start fresh with transcript continuity
    // (Google Live API can poison resumption handles after 1011!)
    const useHandle = proactive && state.liveClient.resumptionHandle ? state.liveClient.resumptionHandle : null;
    const reconnectInstruction = useHandle
      ? cfg.baseSystemInstruction
      : buildReconnectContinuityInstruction(cfg.baseSystemInstruction);

    try {
      await state.liveClient.connect({
        apiKey: cfg.apiKey,
        model: nextModel,
        voiceName: cfg.voiceName,
        systemInstruction: reconnectInstruction,
        tools: cfg.tools,
        strictNoiseGuard: cfg.strictNoiseGuard,
        silenceDurationMs: cfg.silenceDurationMs,
        resumptionHandle: useHandle,
      });

      if (!state.inCall) return;
      cfg.model = nextModel;
      state.isReconnecting = false;
      el.callTutorState.textContent = '듣고 있어요';

      // Resume AudioContexts on iPadOS if Safari suspended them during the blip
      if (state.captureAudioCtx?.state === 'suspended') {
        state.captureAudioCtx.resume().catch(() => {});
      }
      if (state.audioPlayer?.ctx?.state === 'suspended') {
        state.audioPlayer.ctx.resume().catch(() => {});
      }

      if (!proactive) {
        showToast(
          nextModel !== getActiveLiveModel()
            ? `✅ 다시 연결되었어요! (${nextModel}로 안정화)`
            : '✅ 선생님과 다시 연결되었어요! 이어서 말해 보세요.',
          2800
        );
        // Gently prompt tutor to pick right back up if we rebuilt context cleanly
        if (!useHandle && state.transcript.length > 0) {
          state.liveClient.sendTextTurn(
            '(Connection briefly flickered and is back now. Smile warmly and continue right where we were in 1 short sentence!)'
          );
        }
      }

      // Reset failure counter once connection stays healthy for 12s
      if (state.stableResetTimerId) clearTimeout(state.stableResetTimerId);
      state.stableResetTimerId = setTimeout(() => {
        if (state.inCall && !state.isReconnecting) {
          state.reconnectAttempts = 0;
        }
      }, 12000);
    } catch (err) {
      state.isReconnecting = false;
      if (!state.inCall) return;
      if (isPermanentLiveError(err?.reason || err?.message)) {
        showToast(err.message || 'API 인증 오류가 발생했습니다.', 5000);
        endCall();
        return;
      }
      scheduleSeamlessReconnect({ code: err?.code || code, reason: err?.reason || '', proactive: false });
    }
  }, delayMs);
}

async function teardownCallResources() {
  state.inCall = false;
  state.isReconnecting = false;
  state.pendingGoAwayRotation = false;
  state.reconnectAttempts = 0;
  state.activeCallConfig = null;
  state.pttPressed = false;
  if (state.reconnectTimerId) clearTimeout(state.reconnectTimerId);
  if (state.stableResetTimerId) clearTimeout(state.stableResetTimerId);
  if (state.videoTimerId) clearInterval(state.videoTimerId);
  if (state.callTimerId) clearInterval(state.callTimerId);
  if (state.waveRafId) cancelAnimationFrame(state.waveRafId);
  state.reconnectTimerId = null;
  state.stableResetTimerId = null;
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
  const speakingStats = analyzeConversationSpeaking(cleanTranscript);

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
    switchView('kidhome');
    showToast('대화 내용이 짧아 리포트를 생략하고 홈으로 돌아왔습니다.');
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
      speakingStats,
    });
  } catch (err) {
    console.error('Study report error:', err);
    showToast(`리포트 자동 분석 오류: ${err.message}`, 4500);
    reportData = {
      headline: `${studentName} 학생의 화상영어 수업 기록`,
      praiseBadge: '오늘도 영어 말하기 완주!',
      summary: 'AI 리포트 생성 중 일시적인 오류가 발생했지만, 전체 대화 스크립트는 안전하게 저장되었습니다.',
      scores: { fluency: 80, naturalness: 78, vocabulary: 76, engagement: 86 },
      speakingWins: [],
      recurringHabits: [],
      corrections: [],
      vocabulary: [],
      nextTopic: '같은 교재의 핵심 표현을 3분 복습장에서 한 번 더 따라 말해 보세요.',
    };
  }

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
    speakingFocus: state.speakingFocus,
    durationSec,
    durationLabel: formatDuration(durationSec),
    studentTalkPct,
    starsEarned,
    speakingStats,
    transcript: cleanTranscript,
    report: reportData,
  };

  const history = loadHistory();
  history.unshift(sessionRecord);
  saveHistory(history);

  if (addedCards > 0) {
    showToast(`오늘 배운 표현 ${addedCards}개가 FSRS 복습장에 자동 저장되었어요!`, 3600);
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

function handleTogglePttMode() {
  state.callPttMode = !state.callPttMode;
  state.pttPressed = false;
  state.captureWorkletNode?.port.postMessage({
    pttMode: state.callPttMode,
    pttPressed: false,
  });
  updatePttUI();
  showToast(
    state.callPttMode
      ? '눌러서 말하기 모드! 스페이스바나 버튼을 누른 채로 영어로 말해 보세요.'
      : '스마트 자동 음성 감지 모드로 전환했어요.'
  );
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
    showToast('3D 아바타는 부모 관리 → 교육 세팅에서 [3D 실시간 립싱크]로 켜두면 적용됩니다.');
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

function handleQuickPaceAdjust() {
  if (!state.inCall) return;
  const nextPace = state.livePace === 'slow' ? 'normal' : 'slow';
  updateCallPaceUI(nextPace);
  if (nextPace === 'slow') {
    state.liveClient?.sendTextTurn(
      '[Speaking Pace Adjustment] Please slow down noticeably from now on—speak very clearly with short pauses between phrases.'
    );
    showToast('선생님께 천천히 또박또박 말해달라고 전달했어요 🐢');
  } else {
    state.liveClient?.sendTextTurn(
      '[Speaking Pace Adjustment] Great! You can speak at a natural comfortable ESL teacher pace now.'
    );
    showToast('선생님 속도를 보통 속도로 전환했어요');
  }
}

// ==================== REPORT & HISTORY ====================
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

  // Objective Speaking Fluency Diagnostics & Next-Lesson Memory Habits
  const st = session.speakingStats || analyzeConversationSpeaking(session.transcript || []);
  const habits = Array.isArray(r.recurringHabits) ? r.recurringHabits.filter(Boolean) : [];
  if (el.reportSpeakingMetricsCard) {
    const hasMetrics = st && st.studentTurns > 0;
    if (hasMetrics || habits.length > 0) {
      el.reportSpeakingMetricsCard.classList.remove('hidden');
      el.reportSpeakingSub.textContent = hasMetrics
        ? `학생 발화 ${st.studentTurns}회 · 총 ${st.totalWords}단어 분석`
        : '다음 수업 자동 기억 항목';

      if (hasMetrics) {
        const focusLabel = SPEAKING_FOCUS_MODES[session.speakingFocus]?.shortLabel || '균형 회화';
        el.reportSpeakingKpis.innerHTML = `
          <div class="speaking-kpi-tile">
            <span>평균 문장 길이</span>
            <strong>${st.avgWordsPerTurn}단어</strong>
            <small>권장 목표: 6단어+ / 턴</small>
          </div>
          <div class="speaking-kpi-tile">
            <span>완전한 문장 비율</span>
            <strong>${st.fullSentenceRate}%</strong>
            <small>5단어 이상 문장 (${st.fullSentenceTurns}/${st.studentTurns})</small>
          </div>
          <div class="speaking-kpi-tile">
            <span>연결어 확장 활용</span>
            <strong>${st.connectorTurns}회</strong>
            <small>because · so · when 등</small>
          </div>
          <div class="speaking-kpi-tile">
            <span>영어로 질문하기</span>
            <strong>${st.questionTurns}회</strong>
            <small>훈련 모드: ${escapeHtml(focusLabel)}</small>
          </div>
        `;
      } else {
        el.reportSpeakingKpis.innerHTML = '';
      }

      if (hasMetrics && st.longestUtterance) {
        el.reportLongestBox.classList.remove('hidden');
        el.reportLongestText.textContent = `"${st.longestUtterance}" (${st.longestWordCount}단어)`;
      } else {
        el.reportLongestBox.classList.add('hidden');
      }

      if (habits.length > 0) {
        el.reportHabitsBox.classList.remove('hidden');
        el.reportHabitsList.innerHTML = habits.map((h) => `<li>${escapeHtml(h)}</li>`).join('');
      } else {
        el.reportHabitsBox.classList.add('hidden');
      }
    } else {
      el.reportSpeakingMetricsCard.classList.add('hidden');
    }
  }

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
        studentTalkPct: 62,
        starsEarned: 4,
        transcript: [
          { role: 'tutor', text: 'In 2050, would you prefer an AI robot teacher or a human teacher?' },
          { role: 'user', text: 'Human teacher.' },
          { role: 'tutor', text: "Nice choice! Let's make a full sentence—tell me ONE reason starting with 'I prefer human teachers because...'" },
          { role: 'user', text: 'I prefer human teachers because when I have hard time, human teacher can cheer me up.' },
        ],
        report: {
          praiseBadge: '논리적인 미래학교 토론왕',
          headline: '단답에서 완전한 이유 문장으로 스스로 확장해 말한 훌륭한 수업이었어요!',
          summary:
            '선생님의 질문에 자신의 입장을 분명히 밝히고, 유도 질문에 맞춰 because를 붙여 완전한 문장으로 확장해 말한 점이 아주 뛰어납니다. 관사(a hard time)와 복수형(human teachers)만 조금 더 신경 쓰면 훨씬 자연스러워질 거예요.',
          scores: { fluency: 85, naturalness: 80, vocabulary: 82, engagement: 92 },
          corrections: [
            {
              category: '자연스러운 표현',
              original: 'when I have hard time, human teacher can cheer me up.',
              improved: "when I'm having a tough time, a human teacher can cheer me up.",
              explanation: "'힘든 시간을 보내다'는 관사 'a'를 넣어 'have a tough time'으로 말하면 원어민 또래처럼 자연스러워요.",
            },
          ],
          vocabulary: [
            { phrase: 'have a tough time', meaning: '힘든 시간을 보내다', example: 'My friend helped me when I was having a tough time.' },
            { phrase: 'cheer someone up', meaning: '~의 기운을 북돋아 주다', example: 'A kind word from a teacher can cheer you up.' },
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
        studentTalkPct: 58,
        starsEarned: 3,
        transcript: [
          { role: 'tutor', text: 'Look at Page 1! What is the cute little penguin wearing?' },
          { role: 'user', text: 'Goggles!' },
          { role: 'tutor', text: "Awesome! Let's say a full sentence: 'He is wearing brown goggles!' Your turn!" },
          { role: 'user', text: 'He is wearing brown goggles! I think he want to fly in the sky.' },
        ],
        report: {
          praiseBadge: '완전한 문장 챌린지 성공',
          headline: '단답에서 완전한 영어 문장으로 씩씩하게 따라 말한 멋진 수업이었어요!',
          summary:
            '그림 속 펭귄의 고글을 바로 찾아내고, 선생님의 안내에 맞춰 완전한 영어 문장으로 자신감 있게 말한 점이 정말 훌륭합니다! 주어 he 뒤에 동사원형 대신 wants를 쓰는 패턴만 한 번 더 연습해 보세요.',
          scores: { fluency: 81, naturalness: 78, vocabulary: 79, engagement: 94 },
          corrections: [
            {
              category: '문법',
              original: 'I think he want to fly in the sky.',
              improved: 'I think he wants to fly in the sky.',
              explanation: "주어가 'he(그)'일 때는 현재형 동사 뒤에 '-s'를 붙여 'he wants'라고 말해요!",
            },
          ],
          vocabulary: [
            { phrase: 'aviator goggles', meaning: '비행 고글 안경', example: 'Pip wears cool brown goggles.' },
            { phrase: 'curious', meaning: '호기심이 많은', example: 'The curious penguin looked at the balloons.' },
          ],
          nextTopic: "다음 수업에서는 [Let's Order at Sunny Cafe!] 교재로 영어로 스무디와 크루아상을 직접 주문해 보세요!",
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
    if (!state.inCall) switchView('kidhome');
  });

  document.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!state.inCall) switchView(btn.dataset.nav);
    });
  });

  // Kid Home actions
  el.kidStartCallBtn.addEventListener('click', startCall);
  el.kidNoticeOpenParentBtn.addEventListener('click', openPinModal);
  el.kidGoReviewBtn.addEventListener('click', () => switchView('review'));
  el.kidPreviewBookBtn.addEventListener('click', () => {
    const book = getSelectedTextbookObj();
    if (book && book.id !== 'custom-book') {
      openBookPreviewModal(book.id, { readOnly: true });
    }
  });

  // Parent Gate & PIN Modal
  el.openParentGateBtn.addEventListener('click', openPinModal);
  el.lockParentBtn.addEventListener('click', lockParentMode);
  el.closePinModalBtn.addEventListener('click', () => el.pinModal.classList.add('hidden'));
  el.pinModal.addEventListener('click', (e) => {
    if (e.target === el.pinModal) el.pinModal.classList.add('hidden');
  });
  el.pinUnlockForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const entered = el.pinUnlockInput.value.trim();
    if (entered === getParentPin()) {
      state.parentUnlocked = true;
      el.pinModal.classList.add('hidden');
      switchView('parent');
      showToast('부모 관리 모드가 열렸습니다.');
      return;
    }
    const cloudMatch = await cloudSync?.tryUnlockWithPin(entered);
    if (cloudMatch?.matched) {
      localStorage.setItem(STORAGE_KEYS.PARENT_PIN, entered);
      if (cloudMatch.pinUpdatedAt) {
        localStorage.setItem(STORAGE_KEYS.PIN_UPDATED_AT, String(cloudMatch.pinUpdatedAt));
      }
      if (cloudMatch.apiKey) {
        localStorage.setItem(STORAGE_KEYS.API_KEY, cloudMatch.apiKey);
        el.apiKeyInput.value = cloudMatch.apiKey;
        if (cloudMatch.apiKeyUpdatedAt) {
          localStorage.setItem(STORAGE_KEYS.API_KEY_UPDATED_AT, String(cloudMatch.apiKeyUpdatedAt));
        }
      }
      state.parentUnlocked = true;
      el.pinModal.classList.add('hidden');
      switchView('parent');
      cloudSync?.emitCurrentStatus();
      showToast('클라우드 부모 PIN 확인 완료! 암호화된 API 키까지 자동 복원했어요.', 3800);
      return;
    }
    el.pinErrorMsg.textContent = '비밀번호가 일치하지 않습니다. 다시 입력해 주세요.';
    el.pinErrorMsg.classList.remove('hidden');
    el.pinUnlockInput.select();
  });

  // Parent Tabs
  document.querySelectorAll('[data-parent-tab]').forEach((tab) => {
    tab.addEventListener('click', () => setParentTab(tab.dataset.parentTab));
  });

  // Parent Education Settings
  el.quickLevelTestBtn.addEventListener('click', () => switchView('leveltest'));

  el.studentNameInput.addEventListener('input', () => {
    getProfile().name = el.studentNameInput.value;
    saveSettings();
    renderStudentPresets();
  });

  el.levelPills.querySelectorAll('.level-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.levelKey = btn.dataset.level;
      saveSettings();
      renderParentEducationTab();
    });
  });

  el.correctionCards.querySelectorAll('.choice-card').forEach((card) => {
    card.addEventListener('click', () => {
      state.correctionKey = card.dataset.correction;
      saveSettings();
      renderParentEducationTab();
    });
  });

  el.speakingFocusCards?.querySelectorAll('.choice-card').forEach((card) => {
    card.addEventListener('click', () => {
      state.speakingFocus = card.dataset.speakingFocus;
      saveSettings();
      renderParentEducationTab();
      const mode = SPEAKING_FOCUS_MODES[state.speakingFocus] || SPEAKING_FOCUS_MODES.balanced;
      showToast(`${getStudentDisplayName()} 대화 훈련 모드: [${mode.label}]`);
    });
  });

  el.subtitleSettingCards.querySelectorAll('.choice-card').forEach((card) => {
    card.addEventListener('click', () => {
      state.subtitleMode = card.dataset.subtitleMode;
      saveSettings();
      renderParentEducationTab();
      showToast(`${getStudentDisplayName()} 자막 설정: [${SUBTITLE_LABELS[state.subtitleMode]}]`);
    });
  });

  el.paceSettingCards.querySelectorAll('.choice-card').forEach((card) => {
    card.addEventListener('click', () => {
      state.speakingPace = card.dataset.pace;
      saveSettings();
      renderParentEducationTab();
      showToast(`${getStudentDisplayName()} 기본 속도: [${SPEAKING_PACES[state.speakingPace].label}]`);
    });
  });

  el.aiBookGenForm.addEventListener('submit', handleGenerateAiBook);

  el.avatarModePills.querySelectorAll('.seg-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.avatarMode = btn.dataset.avatarMode;
      saveSettings();
      renderParentEducationTab();
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
    saveSettings();
    el.selectedBookSummary.textContent = getLessonTitleLabel();
  });

  // Parent System Settings
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
    localStorage.setItem(STORAGE_KEYS.API_KEY_UPDATED_AT, String(Date.now()));
    const ghCfg = loadGitHubSyncConfig();
    if (ghCfg.enabled) {
      cloudSync?.schedulePush(600);
      showToast('Gemini API 키를 저장하고 GitHub 비공개 저장소에 암호화 동기화합니다.');
    } else {
      showToast('Gemini API 키가 이 기기에 저장되었습니다.');
    }
  });
  el.toggleApiKeyVisBtn.addEventListener('click', () => {
    el.apiKeyInput.type = el.apiKeyInput.type === 'password' ? 'text' : 'password';
  });

  el.noiseGateCards.querySelectorAll('.choice-card').forEach((card) => {
    card.addEventListener('click', () => {
      state.noiseSensitivity = card.dataset.noise;
      saveSettings();
      syncParentSystemControls();
      showToast(`잡음 차단 강도를 [${NOISE_LABELS[state.noiseSensitivity]}]로 설정했어요.`);
    });
  });

  el.turnWaitCards?.querySelectorAll('.choice-card').forEach((card) => {
    card.addEventListener('click', () => {
      state.turnWaitMode = card.dataset.turnWait;
      saveSettings();
      syncParentSystemControls();
      const cfg = TURN_WAIT_CONFIG[state.turnWaitMode] || TURN_WAIT_CONFIG.patient;
      showToast(`아이 대답 기다리는 시간을 [${cfg.label}]로 설정했어요.`);
    });
  });

  el.speechModePills.querySelectorAll('.seg-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.speechMode = btn.dataset.speechMode;
      saveSettings();
      syncParentSystemControls();
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

  el.changePinForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const p1 = el.newPinInput.value.trim();
    const p2 = el.confirmPinInput.value.trim();
    if (!/^\d{4}$/.test(p1)) {
      showToast('비밀번호는 4자리 숫자로 입력해 주세요.');
      return;
    }
    if (p1 !== p2) {
      showToast('두 비밀번호가 서로 다릅니다.');
      return;
    }
    localStorage.setItem(STORAGE_KEYS.PARENT_PIN, p1);
    localStorage.setItem(STORAGE_KEYS.PIN_UPDATED_AT, String(Date.now()));
    el.newPinInput.value = '';
    el.confirmPinInput.value = '';
    syncParentSystemControls();
    if (loadGitHubSyncConfig().enabled) {
      cloudSync?.schedulePush(500);
      showToast('부모 관리 비밀번호가 변경되었으며 GitHub 클라우드에 재암호화 동기화합니다!');
    } else {
      showToast('부모 관리 비밀번호가 변경되었습니다!');
    }
  });

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
    const book = getAllTextbooks().find((b) => b.id === state.previewBookId);
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
      showToast(`"${getLessonTitleLabel()}" 교재를 배정했어요!`);
    }
  });

  // In-Call Controls + Push-to-Talk (Mouse / Touch / Spacebar)
  el.callPaceBadge.addEventListener('click', handleQuickPaceAdjust);
  el.micToggleBtn.addEventListener('click', handleToggleMic);
  el.togglePttModeBtn.addEventListener('click', handleTogglePttMode);
  el.camToggleBtn.addEventListener('click', handleToggleCam);
  el.toggleAvatarViewBtn.addEventListener('click', handleToggleAvatarViewInCall);
  el.sendSnapshotBtn.addEventListener('click', handleManualSnapshot);
  el.endCallBtn.addEventListener('click', endCall);

  el.pttHoldBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    setPttPressed(true);
  });
  window.addEventListener('pointerup', () => setPttPressed(false));
  window.addEventListener('keydown', (e) => {
    if (
      e.code === 'Space' &&
      state.inCall &&
      state.callPttMode &&
      !e.repeat &&
      document.activeElement?.tagName !== 'INPUT' &&
      document.activeElement?.tagName !== 'TEXTAREA'
    ) {
      e.preventDefault();
      setPttPressed(true);
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' && state.inCall && state.callPttMode) {
      setPttPressed(false);
    }
  });

  el.closeChalkboardBtn.addEventListener('click', () => el.chalkboardBanner.classList.add('hidden'));
  el.closePopQuizBtn.addEventListener('click', () => el.popQuizCard.classList.add('hidden'));

  el.subtitleOverlay.addEventListener('click', () => {
    if (el.subtitleOverlay.dataset.mode === 'blur') el.subtitleOverlay.classList.toggle('revealed');
  });

  el.toggleSidebarBtn.addEventListener('click', () => el.callSidebar.classList.toggle('collapsed'));
  el.closeSidebarBtn.addEventListener('click', () => el.callSidebar.classList.add('collapsed'));
  el.expandPanelBtn.addEventListener('click', () => {
    el.callSidebar.classList.toggle('expanded');
    setTimeout(() => whiteboard.resizeToParent(), 220);
  });

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
        `Look at what I just drew or circled on our classroom whiteboard for "${heading}"! Ask me a fun question about it!`
      );
      showToast('화이트보드 그림을 선생님께 보냈어요!');
    }
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
  el.backToLobbyBtn.addEventListener('click', () => switchView('kidhome'));

  // History modal
  el.openHistoryBtn.addEventListener('click', openHistoryModal);
  el.closeHistoryBtn.addEventListener('click', () => el.historyModal.classList.add('hidden'));
  el.historyModal.addEventListener('click', (e) => {
    if (e.target === el.historyModal) el.historyModal.classList.add('hidden');
  });

  // GitHub Private Repo Auto Cloud Sync
  el.toggleGhTokenVisBtn.addEventListener('click', () => {
    el.ghSyncTokenInput.type = el.ghSyncTokenInput.type === 'password' ? 'text' : 'password';
  });
  el.ghSyncTokenInput.addEventListener('input', updateGhTokenHint);
  el.ghSyncTokenInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConnectGitHubSync();
    }
  });
  el.ghConnectSyncBtn.addEventListener('click', handleConnectGitHubSync);
  el.ghSyncNowBtn.addEventListener('click', handleManualGitHubSync);
  el.ghDisconnectBtn.addEventListener('click', handleDisconnectGitHubSync);
  el.cloudSyncBadgeBtn.addEventListener('click', handleManualGitHubSync);

  // Cross-device family sync & backup
  el.copySyncLinkBtn.addEventListener('click', handleCopySyncLink);
  el.exportBackupBtn.addEventListener('click', handleExportBackup);
  el.importBackupBtn.addEventListener('click', () => el.importBackupInput.click());
  el.importBackupInput.addEventListener('change', handleImportBackupFile);

  // Auto-sync triggers for FSRS deck, AI textbooks, and returning to tab
  window.addEventListener('fluentcam:data-mutated', () => {
    cloudSync?.schedulePush();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !state.inCall) {
      cloudSync?.pullOnVisibilityIfStale(30000);
    }
  });

  academyPages.bindSubpageEvents();
}

// ==================== GITHUB PRIVATE REPO AUTO CLOUD SYNC ====================
function formatSyncTime(ts) {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function getLocalCloudSnapshot() {
  const safeParse = (k, fallback) => {
    try {
      const raw = localStorage.getItem(k);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };
  return {
    settings: safeParse(STORAGE_KEYS.SETTINGS, null),
    settingsUpdatedAt: Number(localStorage.getItem(STORAGE_KEYS.SETTINGS_UPDATED_AT)) || 0,
    apiKey: localStorage.getItem(STORAGE_KEYS.API_KEY) || el.apiKeyInput.value.trim() || '',
    apiKeyUpdatedAt: Number(localStorage.getItem(STORAGE_KEYS.API_KEY_UPDATED_AT)) || 0,
    pin: localStorage.getItem(STORAGE_KEYS.PARENT_PIN) || '0000',
    pinUpdatedAt: Number(localStorage.getItem(STORAGE_KEYS.PIN_UPDATED_AT)) || 0,
    history: loadHistory(),
    fsrsDeck: loadFsrsDeck(),
    aiBooks: loadCustomAiTextbooks(),
    deletedAiBookIds: loadDeletedAiBookIds(),
  };
}

function applyCloudMergedSnapshot(merged) {
  if (merged.settings && typeof merged.settings === 'object') {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(merged.settings));
  }
  if (merged.settingsUpdatedAt) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS_UPDATED_AT, String(merged.settingsUpdatedAt));
  }
  if (merged.apiKey && typeof merged.apiKey === 'string') {
    localStorage.setItem(STORAGE_KEYS.API_KEY, merged.apiKey.trim());
    el.apiKeyInput.value = merged.apiKey.trim();
  }
  if (merged.apiKeyUpdatedAt) {
    localStorage.setItem(STORAGE_KEYS.API_KEY_UPDATED_AT, String(merged.apiKeyUpdatedAt));
  }
  if (merged.pin && /^\d{4}$/.test(String(merged.pin))) {
    localStorage.setItem(STORAGE_KEYS.PARENT_PIN, String(merged.pin));
  }
  if (merged.pinUpdatedAt) {
    localStorage.setItem(STORAGE_KEYS.PIN_UPDATED_AT, String(merged.pinUpdatedAt));
  }
  if (Array.isArray(merged.aiBooks)) {
    localStorage.setItem(STORAGE_KEYS.AI_BOOKS, JSON.stringify(merged.aiBooks.slice(0, 40)));
  }
  if (Array.isArray(merged.deletedAiBookIds)) {
    localStorage.setItem(STORAGE_KEYS.DELETED_AI_BOOKS, JSON.stringify(merged.deletedAiBookIds.slice(-100)));
  }
  if (Array.isArray(merged.history)) {
    saveHistory(merged.history, { skipSync: true });
  }
  if (Array.isArray(merged.fsrsDeck)) {
    localStorage.setItem(STORAGE_KEYS.FSRS_DECK, JSON.stringify(merged.fsrsDeck.slice(0, 300)));
  }

  restoreSettings();
  if (!state.inCall) {
    if (state.activeView === 'kidhome') renderKidHome();
    if (state.activeView === 'parent') {
      if (state.activeParentTab === 'edu') renderParentEducationTab();
      if (state.activeParentTab === 'dash') academyPages.renderDashboardPage();
      if (state.activeParentTab === 'system') syncParentSystemControls();
    }
    if (state.activeView === 'review') academyPages.renderReviewPage();
    if (state.activeView === 'leveltest') academyPages.renderLevelTest();
  }
  updateBadges();
}

function renderCloudSyncStatusUi(status) {
  const { state: st, message, repo, enabled, lastSyncedAt } = status;
  const timeStr = formatSyncTime(lastSyncedAt);

  // Header subtle cloud badge
  el.cloudSyncBadgeBtn.classList.toggle('hidden', !enabled);
  el.cloudSyncBadgeBtn.classList.remove('syncing', 'error', 'pin_required');
  if (st === 'syncing') {
    el.cloudSyncBadgeBtn.classList.add('syncing');
    el.cloudSyncBadgeLabel.textContent = '동기화 중...';
  } else if (st === 'error') {
    el.cloudSyncBadgeBtn.classList.add('error');
    el.cloudSyncBadgeLabel.textContent = '동기화 확인 필요';
  } else if (st === 'pin_required') {
    el.cloudSyncBadgeBtn.classList.add('pin_required');
    el.cloudSyncBadgeLabel.textContent = 'PIN 확인 필요';
  } else if (enabled) {
    el.cloudSyncBadgeLabel.textContent = timeStr ? `GitHub · ${timeStr}` : 'GitHub 동기화';
  }

  // Parent Admin Tab 3 status badge & buttons
  el.ghSyncStatusBadge.className = `gh-status-badge ${st === 'synced' ? 'synced' : st === 'syncing' ? 'syncing' : st === 'error' || st === 'pin_required' ? st : 'disconnected'}`;
  if (!enabled) {
    el.ghSyncStatusBadge.textContent = '연결 안 됨';
    el.ghSyncStatusMeta.textContent =
      message && st === 'error'
        ? `오류: ${message}`
        : '연결하면 설정 변경·수업 종료 시 자동으로 비공개 GitHub 저장소에 백업됩니다.';
    el.ghConnectSyncBtn.textContent = '☁️ GitHub 연결 및 지금 동기화';
    el.ghSyncNowBtn.classList.add('hidden');
    el.ghDisconnectBtn.classList.add('hidden');
  } else {
    el.ghSyncStatusBadge.textContent =
      st === 'syncing'
        ? '동기화 중...'
        : st === 'error'
          ? '오류 발생'
          : st === 'pin_required'
            ? 'PIN 입력 필요'
            : '자동 동기화 활성';
    el.ghSyncStatusMeta.textContent =
      st === 'error'
        ? `오류: ${message}`
        : st === 'pin_required'
          ? message
          : `${repo} 연결됨${timeStr ? ` · 마지막 동기화 ${timeStr}` : ''} (Gemini API 키는 AES-256 암호화 저장)`;
    el.ghConnectSyncBtn.textContent = '☁️ 토큰/저장소 재연결';
    el.ghSyncNowBtn.classList.remove('hidden');
    el.ghDisconnectBtn.classList.remove('hidden');
  }
}

cloudSync = createGitHubCloudSync({
  getLocalSnapshot: getLocalCloudSnapshot,
  applyMergedSnapshot: applyCloudMergedSnapshot,
  onStatusChange: renderCloudSyncStatusUi,
  requestCloudPinPrompt: async () =>
    window.prompt(
      'GitHub에 암호화 저장된 Gemini API 키를 복호화하려면 다른 기기에서 설정한 부모 관리 4자리 PIN을 입력해 주세요:',
      ''
    ),
});

function updateGhTokenHint() {
  if (!el.ghSyncTokenHint) return;
  const cleaned = cleanGitHubToken(el.ghSyncTokenInput.value);
  if (!cleaned) {
    el.ghSyncTokenHint.textContent = '';
    el.ghSyncTokenHint.style.color = '';
    return;
  }
  if (cleaned.startsWith('AIza')) {
    el.ghSyncTokenHint.textContent = '⚠ Gemini API 키(AIza...)가 입력되었습니다. GitHub 토큰(github_pat_... / ghp_...)을 입력해 주세요.';
    el.ghSyncTokenHint.style.color = '#fca5a5';
    return;
  }
  if (cleaned.length < 10) {
    el.ghSyncTokenHint.textContent = `⚠ 토큰이 너무 짧습니다 (${cleaned.length}자). GitHub에서 복사한 전체 토큰을 붙여넣어 주세요.`;
    el.ghSyncTokenHint.style.color = '#fde68a';
    return;
  }
  el.ghSyncTokenHint.textContent = `✓ GitHub 토큰 입력됨 (${cleaned.length}자) — 아래 [☁️ GitHub 연결 및 지금 동기화] 버튼을 눌러주세요.`;
  el.ghSyncTokenHint.style.color = '#86efac';
}

async function handleConnectGitHubSync() {
  const repo = el.ghSyncRepoInput.value.trim() || DEFAULT_SYNC_REPO;
  const rawToken = el.ghSyncTokenInput.value;
  const cleanedToken = cleanGitHubToken(rawToken);

  // Detect common accidental paste into the left Gemini API key field
  if (!cleanedToken) {
    const geminiVal = cleanGitHubToken(el.apiKeyInput.value);
    if (geminiVal.startsWith('github_pat_') || geminiVal.startsWith('ghp_')) {
      const msg = 'GitHub 토큰이 왼쪽 [Gemini API 키] 칸에 입력되어 있습니다! 오른쪽 [GitHub Personal Access Token] 칸에 붙여넣어 주세요.';
      el.ghSyncStatusBadge.className = 'gh-status-badge error';
      el.ghSyncStatusBadge.textContent = '입력 칸 확인';
      el.ghSyncStatusMeta.textContent = msg;
      showToast(msg, 5200);
      el.ghSyncTokenInput.focus();
      return;
    }
  }

  el.ghConnectSyncBtn.disabled = true;
  el.ghConnectSyncBtn.textContent = '☁️ 연결 및 암호화 동기화 중...';
  let hadError = false;
  try {
    const res = await cloudSync.connectAndSync({ repo, token: cleanedToken });
    el.ghSyncTokenInput.value = cleanedToken;
    syncParentSystemControls();
    if (res.pinNeeded) {
      showToast('설정은 동기화됐어요! 부모 PIN을 맞추면 암호화된 API 키도 자동 복원됩니다.', 4500);
    } else {
      showToast('GitHub 비공개 저장소 자동 동기화가 연결되었습니다! 이제 어느 기기에서나 자동 반영돼요.', 4200);
    }
  } catch (err) {
    hadError = true;
    const msg = err.message || 'GitHub 연결에 실패했습니다.';
    el.ghSyncStatusBadge.className = 'gh-status-badge error';
    el.ghSyncStatusBadge.textContent = '오류 발생';
    el.ghSyncStatusMeta.textContent = `오류: ${msg}`;
    showToast(msg, 5200);
  } finally {
    el.ghConnectSyncBtn.disabled = false;
    if (hadError) {
      el.ghConnectSyncBtn.textContent = loadGitHubSyncConfig().enabled
        ? '☁️ 토큰/저장소 재연결'
        : '☁️ GitHub 연결 및 지금 동기화';
    } else {
      cloudSync.emitCurrentStatus();
    }
  }
}

async function handleManualGitHubSync() {
  try {
    const res = await cloudSync.syncNow({ pushIfChanged: true, allowPinPrompt: true, silent: false });
    if (res.ok) {
      showToast(
        res.changedLocally
          ? 'GitHub 클라우드에서 최신 가족 설정과 학습 기록을 동기화했어요!'
          : 'GitHub 비공개 저장소와 이미 최신 상태입니다.'
      );
    }
  } catch (err) {
    showToast(`동기화 실패: ${err.message}`, 4200);
  }
}

function handleDisconnectGitHubSync() {
  cloudSync.disconnect();
  el.ghSyncTokenInput.value = '';
  updateGhTokenHint();
  showToast('이 기기의 GitHub 자동 동기화 연결을 해제했습니다. (로컬 데이터는 유지됩니다)');
}

// ==================== CROSS-DEVICE FAMILY SYNC & BACKUP ====================
function encodeSyncPayload(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeSyncPayload(encoded) {
  const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
  const bin = atob(b64 + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return JSON.parse(new TextDecoder().decode(bytes));
}

function buildFamilySyncBundle({ includeApiKey = true, includeLearningData = false } = {}) {
  saveSettings({ skipSync: true });
  const safeParse = (k, fallback) => {
    try {
      const raw = localStorage.getItem(k);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };
  const bundle = {
    v: 2,
    exportedAt: Date.now(),
    settings: safeParse(STORAGE_KEYS.SETTINGS, null),
    pin: localStorage.getItem(STORAGE_KEYS.PARENT_PIN) || '0000',
    aiBooks: safeParse(STORAGE_KEYS.AI_BOOKS, []),
  };
  if (includeApiKey) {
    const key = el.apiKeyInput.value.trim() || localStorage.getItem(STORAGE_KEYS.API_KEY) || '';
    if (key) bundle.apiKey = key;
    const ghCfg = loadGitHubSyncConfig();
    if (ghCfg.enabled && ghCfg.token) {
      bundle.ghSync = { repo: ghCfg.repo, token: ghCfg.token };
    }
  }
  if (includeLearningData) {
    bundle.history = safeParse(STORAGE_KEYS.HISTORY, []);
    bundle.fsrsDeck = safeParse(STORAGE_KEYS.FSRS_DECK, []);
  }
  return bundle;
}

function applyFamilySyncBundle(bundle) {
  if (!bundle || typeof bundle !== 'object') return false;
  const now = Date.now();
  if (bundle.apiKey && typeof bundle.apiKey === 'string') {
    localStorage.setItem(STORAGE_KEYS.API_KEY, bundle.apiKey.trim());
    localStorage.setItem(STORAGE_KEYS.API_KEY_UPDATED_AT, String(bundle.exportedAt || now));
  }
  if (bundle.settings && typeof bundle.settings === 'object') {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(bundle.settings));
    localStorage.setItem(STORAGE_KEYS.SETTINGS_UPDATED_AT, String(bundle.exportedAt || now));
  }
  if (bundle.pin && /^\d{4}$/.test(String(bundle.pin))) {
    localStorage.setItem(STORAGE_KEYS.PARENT_PIN, String(bundle.pin));
  }
  if (Array.isArray(bundle.aiBooks)) {
    localStorage.setItem(STORAGE_KEYS.AI_BOOKS, JSON.stringify(bundle.aiBooks.slice(0, 40)));
  }
  if (Array.isArray(bundle.history)) {
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(bundle.history.slice(0, 60)));
  }
  if (Array.isArray(bundle.fsrsDeck)) {
    localStorage.setItem(STORAGE_KEYS.FSRS_DECK, JSON.stringify(bundle.fsrsDeck.slice(0, 300)));
  }
  if (bundle.ghSync?.repo && bundle.ghSync?.token) {
    saveGitHubSyncConfig({
      repo: bundle.ghSync.repo,
      token: bundle.ghSync.token,
      enabled: true,
      lastSyncedAt: 0,
      lastSha: null,
    });
  }
  return true;
}

function tryApplySyncFromUrlHash() {
  const hash = window.location.hash || '';
  if (!hash.startsWith('#sync=')) return false;
  try {
    const encoded = hash.slice(6).trim();
    const bundle = decodeSyncPayload(encoded);
    const ok = applyFamilySyncBundle(bundle);
    // Immediately strip #sync=... from URL bar so API key & token never stay visible
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    return ok;
  } catch (err) {
    console.warn('Sync link decode failed:', err);
    return false;
  }
}

async function handleCopySyncLink() {
  const includeApiKey = Boolean(el.syncIncludeKeyCheckbox.checked);
  const bundle = buildFamilySyncBundle({ includeApiKey, includeLearningData: false });
  const encoded = encodeSyncPayload(bundle);
  const baseUrl = `${window.location.origin}${window.location.pathname}`;
  const syncUrl = `${baseUrl}#sync=${encoded}`;

  try {
    await navigator.clipboard.writeText(syncUrl);
    const ghNote = bundle.ghSync ? ' (GitHub 자동 동기화까지 1회 연결됨)' : '';
    showToast(`1회용 기기 연결 링크가 복사되었습니다!${ghNote}`, 4200);
  } catch {
    window.prompt('아래 기기 연결 링크를 복사해 다른 기기 브라우저에서 열어 주세요:', syncUrl);
  }
}

function handleExportBackup() {
  const includeApiKey = Boolean(el.syncIncludeKeyCheckbox.checked);
  const bundle = buildFamilySyncBundle({ includeApiKey, includeLearningData: true });
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fluentcam-family-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('가족 전체 설정·수업 노트·복습장 백업 파일을 저장했습니다!');
}

async function handleImportBackupFile(e) {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  try {
    const text = await file.text();
    const bundle = JSON.parse(text);
    if (!applyFamilySyncBundle(bundle)) {
      throw new Error('올바른 FluentCam 백업 파일이 아닙니다.');
    }
    restoreSettings();
    renderParentEducationTab();
    syncParentSystemControls();
    updateBadges();
    cloudSync?.schedulePush(500);
    showToast('백업 파일에서 모든 가족 설정과 학습 기록을 복원했어요!', 3800);
  } catch (err) {
    showToast(`백업 불러오기 실패: ${err.message}`, 4000);
  }
}

// ==================== INIT ====================
function init() {
  const syncedFromLink = tryApplySyncFromUrlHash();
  restoreSettings();
  bindEvents();
  switchView('kidhome');
  cloudSync.emitCurrentStatus();

  const ghCfg = loadGitHubSyncConfig();
  if (ghCfg.enabled) {
    cloudSync.syncNow({ pushIfChanged: true, silent: true }).then((res) => {
      if (res?.ok && res.changedLocally && !syncedFromLink) {
        showToast('GitHub 비공개 저장소에서 최신 가족 설정을 불러왔어요!', 3200);
      }
    });
  }

  if (syncedFromLink) {
    showToast(
      ghCfg.enabled
        ? '기기 연결 완료! 이제 GitHub 비공개 저장소와 자동 동기화됩니다.'
        : '다른 기기의 가족 설정(자녀 프로필·교재·API 키)을 모두 불러왔어요!',
      4500
    );
  }
}

init();

/**
 * FluentCam Academy Pro — Free On-Device Classroom Focus Guard
 *
 * 100% Free (Zero Gemini API tokens, zero cloud video upload, zero 1011 impact):
 * 1. Tab / App Switch Detection (`visibilitychange` + desktop `blur`)
 * 2. On-Device Camera Face & Head-Pose Detection (MediaPipe FaceLandmarker WASM @ ~0.75fps)
 * 3. Silence / Spacing-Out Watchdog (pauses while tutor or student is speaking)
 * 4. Gentle Web Audio attention chime + structured focus score & event timeline for Parent Report
 */

const MEDIAPIPE_VISION_ESM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18';
const MEDIAPIPE_WASM_ROOT = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm';
const FACE_LANDMARKER_MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

export const FOCUS_SENSITIVITY_CONFIG = {
  gentle: {
    key: 'gentle',
    label: '부드럽게',
    awayMs: 11000,
    lookAwayMs: 13000,
    silenceMs: 26000,
    tabAwayMinMs: 2500,
    nudgeCooldownMs: 38000,
    yawThresholdDeg: 38,
    pitchDownDeg: 32,
  },
  normal: {
    key: 'normal',
    label: '보통 (권장)',
    awayMs: 7500,
    lookAwayMs: 9500,
    silenceMs: 18000,
    tabAwayMinMs: 2000,
    nudgeCooldownMs: 28000,
    yawThresholdDeg: 34,
    pitchDownDeg: 28,
  },
  strict: {
    key: 'strict',
    label: '엄격하게',
    awayMs: 5000,
    lookAwayMs: 6500,
    silenceMs: 13000,
    tabAwayMinMs: 1500,
    nudgeCooldownMs: 22000,
    yawThresholdDeg: 29,
    pitchDownDeg: 24,
  },
};

export function getFocusSensitivityConfig(key = 'normal') {
  return FOCUS_SENSITIVITY_CONFIG[key] || FOCUS_SENSITIVITY_CONFIG.normal;
}

/**
 * Pure helper: extract approximate head yaw/pitch degrees from a MediaPipe
 * 4x4 column-major facial transformation matrix OR fallback to 2D face landmarks.
 */
export function estimateHeadPose(result) {
  const mat = result?.facialTransformationMatrixes?.[0]?.data;
  if (mat && mat.length >= 16) {
    // Column-major 4x4 rotation matrix R:
    // r00=mat[0], r10=mat[1], r20=mat[2]
    // r01=mat[4], r11=mat[5], r21=mat[6]
    // r02=mat[8], r12=mat[9], r22=mat[10]
    const r02 = mat[8];
    const r12 = mat[9];
    const r22 = mat[10];
    const r20 = mat[2];
    const yawRad = Math.atan2(r02, r22);
    const pitchRad = Math.atan2(-r12, Math.hypot(r02, r22));
    // Guard against degenerate matrix
    if (Number.isFinite(yawRad) && Number.isFinite(pitchRad) && Math.abs(r22) + Math.abs(r20) > 0.05) {
      return {
        yawDeg: (yawRad * 180) / Math.PI,
        pitchDeg: (pitchRad * 180) / Math.PI,
        source: 'matrix',
      };
    }
  }

  // Fallback using key landmarks (nose #1, left outer eye #33, right outer eye #263, forehead #10, chin #152)
  const lm = result?.faceLandmarks?.[0];
  if (lm && lm.length > 263) {
    const nose = lm[1];
    const leftEye = lm[33];
    const rightEye = lm[263];
    const forehead = lm[10];
    const chin = lm[152];
    const eyeSpan = Math.max(0.01, Math.abs(rightEye.x - leftEye.x));
    const eyeMidX = (leftEye.x + rightEye.x) / 2;
    const faceHeight = Math.max(0.01, Math.abs(chin.y - forehead.y));
    const eyeMidY = (leftEye.y + rightEye.y) / 2;
    const noseOffsetX = (nose.x - eyeMidX) / (eyeSpan * 0.5);
    const noseOffsetY = (nose.y - eyeMidY) / faceHeight;
    // Neutral noseOffsetY is roughly 0.28–0.38; looking way down pushes it > 0.52
    return {
      yawDeg: noseOffsetX * 45,
      pitchDeg: (0.33 - noseOffsetY) * 110,
      source: 'landmarks',
    };
  }

  return { yawDeg: 0, pitchDeg: 0, source: 'none' };
}

/**
 * Pure helper: compute focus score (35–100) and Korean grade label from counters.
 */
export function computeFocusScore({
  tabAwayCount = 0,
  tabAwayTotalSec = 0,
  camAwayCount = 0,
  lookAwayCount = 0,
  silenceCount = 0,
}) {
  let penalty = 0;
  penalty += tabAwayCount * 10 + Math.min(20, Math.floor(tabAwayTotalSec / 12));
  penalty += camAwayCount * 7;
  penalty += lookAwayCount * 5;
  penalty += silenceCount * 4;

  const score = Math.max(35, Math.min(100, Math.round(100 - penalty)));
  let gradeLabel = '최상 집중';
  if (score < 60) gradeLabel = '집중 보완 필요';
  else if (score < 75) gradeLabel = '집중 주의 필요';
  else if (score < 90) gradeLabel = '양호한 집중도';
  return { score, gradeLabel };
}

export function formatFocusElapsed(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  const m = String(Math.floor(s / 60)).padStart(2, '0');
  const r = String(s % 60).padStart(2, '0');
  return `${m}:${r}`;
}

/**
 * Play a gentle, kid-friendly two-tone bell via Web Audio (no external MP3 required).
 */
function playGentleFocusChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const playTone = (freq, startOffset, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + startOffset);
      gain.gain.setValueAtTime(0.0001, now + startOffset);
      gain.gain.exponentialRampToValueAtTime(0.065, now + startOffset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + startOffset);
      osc.stop(now + startOffset + duration + 0.02);
    };

    playTone(587.33, 0, 0.14); // D5
    playTone(783.99, 0.11, 0.22); // G5

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 500);
  } catch {
    // ignore if audio blocked
  }
}

// Singleton lazy loader for MediaPipe FaceLandmarker so reconnecting/next calls reuse WASM cleanly
let sharedLandmarkerPromise = null;

async function getSharedFaceLandmarker() {
  if (sharedLandmarkerPromise) return sharedLandmarkerPromise;
  sharedLandmarkerPromise = (async () => {
    const visionMod = await import(MEDIAPIPE_VISION_ESM);
    const { FilesetResolver, FaceLandmarker } = visionMod;
    const filesetResolver = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_ROOT);
    try {
      return await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: { modelAssetPath: FACE_LANDMARKER_MODEL, delegate: 'GPU' },
        runningMode: 'IMAGE',
        numFaces: 1,
        outputFacialTransformationMatrixes: true,
        outputFaceBlendshapes: false,
      });
    } catch {
      // Fallback to CPU delegate if WebGL/GPU delegate unavailable (e.g. older iPads or headless Chrome)
      return await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: { modelAssetPath: FACE_LANDMARKER_MODEL, delegate: 'CPU' },
        runningMode: 'IMAGE',
        numFaces: 1,
        outputFacialTransformationMatrixes: true,
        outputFaceBlendshapes: false,
      });
    }
  })().catch((err) => {
    sharedLandmarkerPromise = null;
    throw err;
  });
  return sharedLandmarkerPromise;
}

export class ClassroomFocusGuard {
  constructor({
    enabled = true,
    sensitivity = 'normal',
    cameraAiEnabled = true,
    studentName = 'Student',
    getVideoEl = () => null,
    isCamEnabled = () => false,
    isCallActive = () => false,
    isReconnecting = () => false,
    isTutorSpeaking = () => false,
    onUiBanner = () => {},
    onStatusChange = () => {},
    onAiNudge = () => {},
  } = {}) {
    this.enabled = Boolean(enabled);
    this.cfg = getFocusSensitivityConfig(sensitivity);
    this.cameraAiEnabled = Boolean(cameraAiEnabled);
    this.studentName = studentName || 'Student';

    this.getVideoEl = getVideoEl;
    this.isCamEnabled = isCamEnabled;
    this.isCallActive = isCallActive;
    this.isReconnecting = isReconnecting;
    this.isTutorSpeaking = isTutorSpeaking;
    this.onUiBanner = onUiBanner;
    this.onStatusChange = onStatusChange;
    this.onAiNudge = onAiNudge;

    this.running = false;
    this.startedAt = 0;

    // Live states
    this.focusState = 'focused'; // 'focused' | 'tab_away' | 'away_from_cam' | 'look_away' | 'silence'
    this.cameraAiStatus = 'off'; // 'off' | 'loading' | 'active' | 'unavailable'
    this.studentSpeaking = false;
    this.waitingForStudentSince = 0;
    this.consecutiveSilenceAlerts = 0;

    // Tab/Window away tracking
    this.tabAwaySince = 0;
    this.blurAwayTimer = null;

    // Camera face/gaze tracking
    this.landmarker = null;
    this.probeCanvas = null;
    this.probeCtx = null;
    this.noFaceSince = 0;
    this.lookAwaySince = 0;
    this.camAlertedForCurrentStreak = false;
    this.lookAlertedForCurrentStreak = false;

    // Cooldowns & timers
    this.lastAiNudgeAt = 0;
    this.tickTimer = null;
    this.cameraTimer = null;

    // Metrics for Post-Call Report & Live Parent Monitor
    this.tabAwayCount = 0;
    this.tabAwayTotalSec = 0;
    this.camAwayCount = 0;
    this.lookAwayCount = 0;
    this.silenceCount = 0;
    this.events = [];

    this._onVisibilityChange = this._handleVisibilityChange.bind(this);
    this._onWindowBlur = this._handleWindowBlur.bind(this);
    this._onWindowFocus = this._handleWindowFocus.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.startedAt = Date.now();
    this.focusState = 'focused';
    this.waitingForStudentSince = 0;
    this.consecutiveSilenceAlerts = 0;
    this.noFaceSince = 0;
    this.lookAwaySince = 0;
    this.tabAwaySince = 0;
    this.lastAiNudgeAt = 0;

    if (!this.enabled) {
      this._emitStatus('off', '집중 가드 꺼짐');
      return;
    }

    document.addEventListener('visibilitychange', this._onVisibilityChange);
    window.addEventListener('blur', this._onWindowBlur);
    window.addEventListener('focus', this._onWindowFocus);

    this.tickTimer = setInterval(() => this._tickWatchdog(), 1000);
    this._emitStatus('focused', '수업 집중 중');

    if (this.cameraAiEnabled) {
      this._initCameraAi();
    }
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    document.removeEventListener('visibilitychange', this._onVisibilityChange);
    window.removeEventListener('blur', this._onWindowBlur);
    window.removeEventListener('focus', this._onWindowFocus);

    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    if (this.cameraTimer) {
      clearInterval(this.cameraTimer);
      this.cameraTimer = null;
    }
    if (this.blurAwayTimer) {
      clearTimeout(this.blurAwayTimer);
      this.blurAwayTimer = null;
    }

    // If call ended while tab was hidden, close out duration cleanly
    if (this.tabAwaySince > 0) {
      const sec = Math.max(1, Math.round((Date.now() - this.tabAwaySince) / 1000));
      if (sec * 1000 >= this.cfg.tabAwayMinMs) {
        this.tabAwayCount += 1;
        this.tabAwayTotalSec += sec;
      }
      this.tabAwaySince = 0;
    }
  }

  // Called when tutor starts/stops speaking
  notifyTutorSpeaking(isSpeaking) {
    if (!this.running || !this.enabled) return;
    if (isSpeaking) {
      this.waitingForStudentSince = 0;
    } else if (this.isCallActive() && !this.isReconnecting()) {
      this.waitingForStudentSince = Date.now();
    }
  }

  // Called when student audio gate opens or transcript arrives
  notifyStudentActivity() {
    if (!this.running || !this.enabled) return;
    this.studentSpeaking = true;
    this.waitingForStudentSince = 0;
    this.consecutiveSilenceAlerts = 0;
    // Speaking means student is engaged; reset look-away streak so thinking glances aren't penalized
    this.lookAwaySince = 0;
    this.lookAlertedForCurrentStreak = false;
    if (this.focusState === 'silence' || this.focusState === 'look_away') {
      this._setFocused();
    }
  }

  notifyStudentVoiceEnd() {
    this.studentSpeaking = false;
  }

  notifyTurnComplete() {
    if (!this.running || !this.enabled) return;
    if (!this.isTutorSpeaking() && this.isCallActive() && !this.isReconnecting()) {
      this.waitingForStudentSince = Date.now();
    }
  }

  async _initCameraAi() {
    if (!this.running || !this.enabled || !this.cameraAiEnabled) return;
    this.cameraAiStatus = 'loading';
    this._emitStatus(this.focusState, this._labelForState(this.focusState));

    try {
      this.landmarker = await getSharedFaceLandmarker();
      if (!this.running) return;
      this.probeCanvas = document.createElement('canvas');
      this.probeCanvas.width = 160;
      this.probeCanvas.height = 120;
      this.probeCtx = this.probeCanvas.getContext('2d', { willReadFrequently: true });
      this.cameraAiStatus = 'active';
      this._emitStatus(this.focusState, this._labelForState(this.focusState));

      this.cameraTimer = setInterval(() => this._sampleCameraFrame(), 1300);
    } catch (err) {
      console.warn('[FocusGuard] On-device camera AI unavailable, continuing with tab & silence guard:', err);
      this.cameraAiStatus = 'unavailable';
      this._emitStatus(this.focusState, this._labelForState(this.focusState));
    }
  }

  _handleVisibilityChange() {
    if (!this.running || !this.enabled || !this.isCallActive()) return;
    if (document.hidden) {
      this._markTabLeft();
    } else {
      this._markTabReturned();
    }
  }

  _handleWindowBlur() {
    if (!this.running || !this.enabled || !this.isCallActive()) return;
    // Debounce blur by 1.8s so clicking inside an iframe/OS permission dialog doesn't false-trigger
    clearTimeout(this.blurAwayTimer);
    this.blurAwayTimer = setTimeout(() => {
      if (!document.hasFocus() && this.running && this.isCallActive() && !this.tabAwaySince) {
        this._markTabLeft();
      }
    }, 1800);
  }

  _handleWindowFocus() {
    clearTimeout(this.blurAwayTimer);
    if (!this.running || !this.enabled) return;
    if (this.tabAwaySince > 0) {
      this._markTabReturned();
    }
  }

  _markTabLeft() {
    if (this.tabAwaySince > 0) return;
    this.tabAwaySince = Date.now();
    this.focusState = 'tab_away';
    this._emitStatus('tab_away', '다른 앱·화면 이탈 중');
  }

  _markTabReturned() {
    if (!this.tabAwaySince) return;
    const awayMs = Date.now() - this.tabAwaySince;
    this.tabAwaySince = 0;

    if (awayMs >= this.cfg.tabAwayMinMs) {
      const sec = Math.max(1, Math.round(awayMs / 1000));
      this.tabAwayCount += 1;
      this.tabAwayTotalSec += sec;
      this._recordEvent('tab_away', '다른 앱·화면 이탈', `${sec}초 동안 수업 화면 이탈`);
      playGentleFocusChime();
      this.onUiBanner({
        type: 'tab_away',
        title: '📱 수업 화면으로 돌아와 주세요!',
        detail: `${sec}초 동안 다른 화면을 보았어요. 선생님과 다시 영어로 이야기해 볼까요?`,
      });
      this._triggerAiNudge(
        'tab_away',
        `[CLASSROOM MONITOR] ${this.studentName} left the classroom screen for ${sec} seconds and just came back. Warmly yet firmly welcome them back by name in 1 short sentence, remind them to stay on the class screen, and bring them right back to your question.`
      );
    }

    this._setFocused();
  }

  _sampleCameraFrame() {
    if (!this.running || !this.enabled || !this.landmarker || !this.isCallActive()) return;
    if (document.hidden || this.isReconnecting()) return;
    if (!this.isCamEnabled()) {
      this.noFaceSince = 0;
      this.lookAwaySince = 0;
      return;
    }

    const video = this.getVideoEl();
    if (!video || video.readyState < 2 || !video.videoWidth || !this.probeCtx) return;

    try {
      this.probeCtx.drawImage(video, 0, 0, this.probeCanvas.width, this.probeCanvas.height);
      const result = this.landmarker.detect(this.probeCanvas);
      const hasFace = Array.isArray(result?.faceLandmarks) && result.faceLandmarks.length > 0;
      const now = Date.now();

      if (!hasFace) {
        this.lookAwaySince = 0;
        this.lookAlertedForCurrentStreak = false;
        if (!this.noFaceSince) this.noFaceSince = now;

        const awayMs = now - this.noFaceSince;
        if (awayMs >= this.cfg.awayMs && !this.camAlertedForCurrentStreak) {
          this.camAlertedForCurrentStreak = true;
          const sec = Math.round(awayMs / 1000);
          this.camAwayCount += 1;
          this.focusState = 'away_from_cam';
          this._recordEvent('away_from_cam', '자리 이탈 (카메라 밖)', `${sec}초 이상 얼굴 미감지`);
          playGentleFocusChime();
          this.onUiBanner({
            type: 'away_from_cam',
            title: '🪑 자리에 앉아 화면을 봐주세요!',
            detail: '카메라에 얼굴이 보이지 않아요. 선생님 앞으로 돌아와 주세요!',
          });
          this._emitStatus('away_from_cam', '자리 이탈 감지');
          this._triggerAiNudge(
            'away_from_cam',
            `[CLASSROOM MONITOR] ${this.studentName} stepped away from the camera for ${sec} seconds. Call their name warmly yet firmly in 1 short sentence ("Hey ${this.studentName}, come back to your seat! Ready?") and re-engage them.`
          );
        }
        return;
      }

      // Face is visible! Clear away-from-cam state
      this.noFaceSince = 0;
      this.camAlertedForCurrentStreak = false;

      const pose = estimateHeadPose(result);
      const turnedTooFar = Math.abs(pose.yawDeg) > this.cfg.yawThresholdDeg;
      const lookingWayDown = pose.pitchDeg < -this.cfg.pitchDownDeg;

      // Never flag look_away while child is actively talking (kids glance away when thinking of English words!)
      if ((turnedTooFar || lookingWayDown) && !this.studentSpeaking) {
        if (!this.lookAwaySince) this.lookAwaySince = now;
        const lookMs = now - this.lookAwaySince;
        if (lookMs >= this.cfg.lookAwayMs && !this.lookAlertedForCurrentStreak) {
          this.lookAlertedForCurrentStreak = true;
          const sec = Math.round(lookMs / 1000);
          this.lookAwayCount += 1;
          this.focusState = 'look_away';
          this._recordEvent(
            'look_away',
            turnedTooFar ? '고개 돌림 · 딴짓 감지' : '고개 숙임 · 딴짓 감지',
            `${sec}초 이상 시선 이탈`
          );
          playGentleFocusChime();
          this.onUiBanner({
            type: 'look_away',
            title: '👀 선생님과 눈을 맞춰 주세요!',
            detail: '다른 곳을 오래 보고 있어요. 수업에 다시 집중해 볼까요?',
          });
          this._emitStatus('look_away', '시선 이탈 감지');
          this._triggerAiNudge(
            'look_away',
            `[CLASSROOM MONITOR] ${this.studentName} has been looking away from class for ${sec} seconds. Catch their attention by name in 1 short playful-but-firm sentence ("Eyes up here, ${this.studentName}!") and ask a quick question.`
          );
        }
      } else {
        this.lookAwaySince = 0;
        this.lookAlertedForCurrentStreak = false;
        if (this.focusState === 'away_from_cam' || this.focusState === 'look_away') {
          this._setFocused();
        }
      }
    } catch {
      // Ignore occasional frame read race on iOS Safari
    }
  }

  _tickWatchdog() {
    if (!this.running || !this.enabled || !this.isCallActive()) return;
    if (document.hidden || this.isReconnecting() || this.isTutorSpeaking() || this.studentSpeaking) return;
    if (!this.waitingForStudentSince) return;

    const now = Date.now();
    const silentMs = now - this.waitingForStudentSince;
    if (silentMs >= this.cfg.silenceMs) {
      const sec = Math.round(silentMs / 1000);
      this.waitingForStudentSince = now; // reset so next alert waits full silenceMs again
      this.consecutiveSilenceAlerts += 1;
      this.silenceCount += 1;
      this.focusState = 'silence';
      this._recordEvent('silence', '무응답 · 집중 저하', `${sec}초 동안 대답 없음`);
      playGentleFocusChime();
      this.onUiBanner({
        type: 'silence',
        title: '💬 선생님이 대답을 기다리고 있어요!',
        detail: '짧은 단어라도 괜찮아요. 영어로 먼저 말해 볼까요?',
      });
      this._emitStatus('silence', '무응답 재집중 유도');

      const prompt =
        this.consecutiveSilenceAlerts >= 2
          ? `[CLASSROOM MONITOR] ${this.studentName} has been quiet/unfocused again for ${sec} seconds. Be warm yet firm: call them by name, remind them to focus on class, and give a super-easy 2-choice question for a quick Gold Star!`
          : `[CLASSROOM MONITOR] ${this.studentName} has been silent for ${sec} seconds after your question. Gently call their name to check focus and offer 2 super-easy choices so they start speaking.`;

      this._triggerAiNudge('silence', prompt);
    }
  }

  _triggerAiNudge(type, promptText) {
    const now = Date.now();
    const minGap = type === 'tab_away' ? 8000 : this.cfg.nudgeCooldownMs;
    if (this.lastAiNudgeAt > 0 && now - this.lastAiNudgeAt < minGap) return;
    if (this.isReconnecting() || !this.isCallActive()) return;
    // Don't interrupt while tutor is mid-sentence (except when child just returned from another app)
    if (type !== 'tab_away' && this.isTutorSpeaking()) return;
    this.lastAiNudgeAt = now;
    this.onAiNudge(promptText, type);
  }

  _setFocused() {
    const changed = this.focusState !== 'focused';
    this.focusState = 'focused';
    if (changed) {
      this._emitStatus('focused', '수업 집중 중');
    }
  }

  _recordEvent(type, label, detail) {
    const elapsedSec = Math.max(0, Math.floor((Date.now() - this.startedAt) / 1000));
    this.events.push({
      type,
      label,
      detail,
      elapsedSec,
      at: Date.now(),
    });
    if (this.events.length > 25) this.events.shift();
  }

  _labelForState(st) {
    switch (st) {
      case 'tab_away':
        return '다른 앱·화면 이탈 중';
      case 'away_from_cam':
        return '자리 이탈 감지';
      case 'look_away':
        return '시선 이탈 감지';
      case 'silence':
        return '무응답 재집중 유도';
      case 'off':
        return '집중 가드 꺼짐';
      default:
        return '수업 집중 중';
    }
  }

  _emitStatus(focusState, statusText) {
    const summary = this.getSummary();
    this.onStatusChange({
      focusState,
      statusText,
      cameraAiStatus: this.cameraAiStatus,
      score: summary.score,
      gradeLabel: summary.gradeLabel,
      totalAlerts: summary.totalAlerts,
      latestEvent: this.events[this.events.length - 1] || null,
    });
  }

  getSummary() {
    const { score, gradeLabel } = computeFocusScore({
      tabAwayCount: this.tabAwayCount,
      tabAwayTotalSec: this.tabAwayTotalSec,
      camAwayCount: this.camAwayCount,
      lookAwayCount: this.lookAwayCount,
      silenceCount: this.silenceCount,
    });
    const totalAlerts = this.tabAwayCount + this.camAwayCount + this.lookAwayCount + this.silenceCount;
    return {
      enabled: this.enabled,
      sensitivity: this.cfg.key,
      sensitivityLabel: this.cfg.label,
      cameraAiUsed: this.cameraAiStatus === 'active',
      score,
      gradeLabel,
      totalAlerts,
      tabAwayCount: this.tabAwayCount,
      tabAwayTotalSec: this.tabAwayTotalSec,
      camAwayCount: this.camAwayCount,
      lookAwayCount: this.lookAwayCount,
      silenceCount: this.silenceCount,
      events: this.events.slice(-20),
    };
  }
}

/**
 * 3D Real-Time Lip-Sync Tutor Engine
 * Powered by open-source MIT projects:
 *  - met4citizen/TalkingHead (Three.js / WebGL 3D Avatar)
 *  - met4citizen/HeadAudio (Audio-driven real-time Oculus viseme AudioWorklet)
 */
export class Avatar3DController {
  constructor(containerEl, onStatus) {
    this.container = containerEl;
    this.onStatus = onStatus;
    this.head = null;
    this.headaudio = null;
    this.ready = false;
    this.loading = false;
    this.currentUrl = null;
  }

  async init({ avatarUrl, body = 'F', mood = 'happy' }) {
    if (this.loading) return false;
    this.loading = true;
    this.ready = false;

    try {
      this.onStatus?.('3D 아바타 엔진 로딩 중...');

      const [{ TalkingHead }, { HeadAudio }] = await Promise.all([
        import('../vendor/talkinghead/talkinghead.mjs'),
        import('../vendor/headaudio/headaudio.min.mjs'),
      ]);

      // Clear previous container if reloading a different avatar
      if (this.head) {
        await this.dispose();
      }

      this.container.innerHTML = '';

      this.head = new TalkingHead(this.container, {
        ttsEndpoint: 'N/A',
        lipsyncModules: [],
        cameraView: 'upper',
        cameraDistance: -0.78,
        cameraY: -0.02,
        cameraRotateEnable: true,
        cameraPanEnable: false,
        cameraZoomEnable: false,
        mixerGainSpeech: 1.9,
        lightAmbientColor: 0xfff5ea,
        lightAmbientIntensity: 1.9,
        lightDirectColor: 0xfff1dc,
        lightDirectIntensity: 2.2,
        lightSpotColor: 0xffe4c4,
        lightSpotIntensity: 1.2,
      });

      this.onStatus?.('3D 튜터 모델 불러오는 중...');
      await this.head.showAvatar(
        {
          url: avatarUrl,
          body,
          avatarMood: mood,
          lipsyncLang: 'en',
        },
        (ev) => {
          if (ev && ev.lengthComputable && ev.total > 0) {
            const pct = Math.min(99, Math.round((ev.loaded / ev.total) * 100));
            this.onStatus?.(`3D 아바타 로딩 ${pct}%`);
          }
        }
      );

      this.currentUrl = avatarUrl;
      this.head.start();

      if (this.head.audioCtx.state === 'suspended') {
        await this.head.audioCtx.resume().catch(() => {});
      }

      this.onStatus?.('실시간 립싱크 엔진 연결 중...');
      await this.head.audioCtx.audioWorklet.addModule('./vendor/headaudio/headworklet.min.mjs');

      this.headaudio = new HeadAudio(this.head.audioCtx, {
        visemeMinMs: 110,
      });
      await this.headaudio.loadModel('./vendor/headaudio/model-en-mixed.bin');

      // Connect TalkingHead's speech gain node to HeadAudio viseme analyzer
      this.head.audioSpeechGainNode.connect(this.headaudio);

      this.headaudio.onvalue = (key, value) => {
        if (this.head?.mtAvatar && this.head.mtAvatar[key]) {
          Object.assign(this.head.mtAvatar[key], {
            newvalue: value,
            needsUpdate: true,
          });
        }
      };

      this.head.opt.update = this.headaudio.update.bind(this.headaudio);

      let lastEnded = 0;
      this.headaudio.onended = () => {
        lastEnded = Date.now();
      };
      this.headaudio.onstarted = () => {
        if (Date.now() - lastEnded > 180) {
          this.head?.lookAtCamera(500);
          try {
            this.head?.speakWithHands();
          } catch {
            // optional gesture
          }
        }
      };

      this.head.lookAtCamera(600);
      this.ready = true;
      this.onStatus?.('3D 립싱크 준비 완료');
      return true;
    } catch (err) {
      console.warn('Avatar3DController init failed, falling back to portrait mode:', err);
      this.onStatus?.('3D 모드 로드 실패 — 실사 화면으로 자동 전환');
      await this.dispose();
      return false;
    } finally {
      this.loading = false;
    }
  }

  getAudioTarget() {
    if (!this.ready || !this.head?.audioCtx || !this.head?.audioSpeechGainNode) {
      return null;
    }
    return {
      audioCtx: this.head.audioCtx,
      destinationNode: this.head.audioSpeechGainNode,
    };
  }

  setMood(mood = 'happy') {
    if (!this.ready || !this.head) return;
    const allowed = new Set(['neutral', 'happy', 'love', 'fear', 'sad', 'angry', 'disgust']);
    const mapped = mood === 'surprised' ? 'happy' : mood === 'encouraging' ? 'happy' : mood;
    if (allowed.has(mapped)) {
      try {
        this.head.setMood(mapped);
      } catch {
        // ignore
      }
    }
  }

  playGesture(gesture = 'thumbup', durationSec = 2.6) {
    if (!this.ready || !this.head) return;
    try {
      this.head.playGesture(gesture, durationSec);
      this.head.lookAtCamera(800);
    } catch {
      // ignore unsupported gesture
    }
  }

  async dispose() {
    this.ready = false;
    try {
      if (this.headaudio) {
        this.headaudio.disconnect();
        this.headaudio = null;
      }
    } catch {
      // ignore
    }
    try {
      if (this.head) {
        this.head.stop();
        this.head = null;
      }
    } catch {
      // ignore
    }
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}

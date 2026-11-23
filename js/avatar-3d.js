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
    this._onVisibilityChange = null;
  }

  _sanitizeRigAndMorphs() {
    if (!this.head?.scene) return;
    this.head.scene.traverse((obj) => {
      if (obj.isMesh && Array.isArray(obj.morphTargetInfluences)) {
        for (let i = 0; i < obj.morphTargetInfluences.length; i++) {
          const v = obj.morphTargetInfluences[i];
          if (!Number.isFinite(v)) {
            obj.morphTargetInfluences[i] = 0;
          }
        }
      }
      if (obj.isBone) {
        if (
          !Number.isFinite(obj.scale.x) ||
          !Number.isFinite(obj.scale.y) ||
          !Number.isFinite(obj.scale.z) ||
          obj.scale.x < 0.7 ||
          obj.scale.y < 0.7 ||
          obj.scale.z < 0.7
        ) {
          obj.scale.set(1, 1, 1);
        }
        if (
          !Number.isFinite(obj.quaternion.x) ||
          !Number.isFinite(obj.quaternion.y) ||
          !Number.isFinite(obj.quaternion.z) ||
          !Number.isFinite(obj.quaternion.w)
        ) {
          obj.quaternion.identity();
        }
      }
    });
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
        cameraDistance: -0.45,
        cameraY: 0.0,
        cameraRotateEnable: false,
        cameraPanEnable: false,
        cameraZoomEnable: false,
        mixerGainSpeech: 1.9,
        lightAmbientColor: 0xfff8f0,
        lightAmbientIntensity: 2.0,
        lightDirectColor: 0xfff4e6,
        lightDirectIntensity: 5.5,
        lightSpotColor: 0xffe4c4,
        lightSpotIntensity: 0,
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

      this._sanitizeRigAndMorphs();
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
        if (!Number.isFinite(value)) return;
        if (this.head?.mtAvatar && this.head.mtAvatar[key]) {
          const safe = Math.max(0, Math.min(1, value));
          Object.assign(this.head.mtAvatar[key], {
            newvalue: safe,
            needsUpdate: true,
          });
        }
      };

      this.head.opt.update = (dt) => {
        const safeDt = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 100)) : 16;
        try {
          this.headaudio?.update(safeDt);
        } catch {
          // ignore
        }
        this._sanitizeRigAndMorphs();
      };

      let lastEnded = 0;
      this.headaudio.onended = () => {
        lastEnded = Date.now();
      };
      this.headaudio.onstarted = () => {
        if (Date.now() - lastEnded > 200) {
          this.head?.lookAtCamera(500);
        }
      };

      // Pause/resume animation on tab switch so frame delta never overflows
      this._onVisibilityChange = () => {
        if (!this.head) return;
        if (document.visibilityState === 'visible') {
          this.head.start();
        } else {
          this.head.stop();
        }
      };
      document.addEventListener('visibilitychange', this._onVisibilityChange);

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
    if (this._onVisibilityChange) {
      document.removeEventListener('visibilitychange', this._onVisibilityChange);
      this._onVisibilityChange = null;
    }
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

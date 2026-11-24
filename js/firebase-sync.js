/**
 * KidQuest-Compatible Firebase Realtime Auto-Sync for FluentCam Academy Pro
 *
 * - Uses the family's existing free Firebase Realtime Database (`kidquest-family-default-rtdb`)
 *   under a completely isolated sibling node: `/families/{familyCode}_fluentcam.json`
 *   so KidQuest data is never touched and no GitHub token is ever needed.
 * - Automatically detects KidQuest's `kq2_family` code on the shared `alpinu83.github.io` origin!
 * - Encrypts the Gemini API key with AES-256-GCM (PBKDF2-SHA256 120k) using Parent PIN + family code.
 * - Subscribes to lightweight SSE updates on `/updatedAt.json` for real-time cross-device sync.
 */

import {
  encryptApiKey,
  decryptApiKey,
  createPinVerifier,
  verifyPinAgainstCloud,
  mergeSettings,
  mergeHistory,
  mergeFsrsDeck,
  mergeAiBooks,
} from './cloud-sync.js?v=20261124f';

export const FIREBASE_DB_URL = 'https://kidquest-family-default-rtdb.asia-southeast1.firebasedatabase.app';
const FC_FAMILY_KEY = 'fluentcam_family_code_v1';
const KQ_FAMILY_KEY = 'kq2_family';
const FB_META_KEY = 'fluentcam_firebase_sync_meta_v1';

export function cleanFamilyCode(raw) {
  return String(raw || '')
    .trim()
    .replace(/^#?family=/i, '')
    .replace(/[^A-Za-z0-9_-]/g, '');
}

export function generateFamilyCode(len = 28) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = new Uint8Array(len);
  window.crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < len; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

export function detectFamilyCodeFromUrlOrStorage() {
  // 1. Check URL hash `#family=...` (same format as KidQuest!)
  try {
    const hash = window.location.hash || '';
    if (hash.includes('family=')) {
      const params = new URLSearchParams(hash.replace(/^#/, ''));
      const fromHash = cleanFamilyCode(params.get('family') || '');
      if (fromHash.length >= 24) {
        localStorage.setItem(FC_FAMILY_KEY, fromHash);
        // Also populate kq2_family if empty so both apps stay seamlessly paired
        if (!localStorage.getItem(KQ_FAMILY_KEY)) {
          localStorage.setItem(KQ_FAMILY_KEY, fromHash);
        }
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        return { code: fromHash, source: 'link' };
      }
    }
  } catch {
    // ignore
  }

  // 2. Check FluentCam saved family code
  const savedFc = cleanFamilyCode(localStorage.getItem(FC_FAMILY_KEY) || '');
  if (savedFc.length >= 24) {
    return { code: savedFc, source: 'saved' };
  }

  // 3. Auto-detect KidQuest's existing family code on shared origin (`alpinu83.github.io`)!
  const savedKq = cleanFamilyCode(localStorage.getItem(KQ_FAMILY_KEY) || '');
  if (savedKq.length >= 24) {
    localStorage.setItem(FC_FAMILY_KEY, savedKq);
    return { code: savedKq, source: 'kidquest' };
  }

  return { code: '', source: 'none' };
}

export function loadFirebaseSyncConfig() {
  const detected = detectFamilyCodeFromUrlOrStorage();
  let lastSyncedAt = 0;
  let disabled = false;
  try {
    const meta = JSON.parse(localStorage.getItem(FB_META_KEY) || '{}');
    lastSyncedAt = Number(meta.lastSyncedAt) || 0;
    disabled = Boolean(meta.disabled);
  } catch {
    // ignore
  }
  return {
    familyCode: detected.code,
    source: detected.source,
    enabled: Boolean(detected.code && !disabled),
    lastSyncedAt,
  };
}

export function saveFirebaseSyncMeta(patch) {
  let prev = {};
  try {
    prev = JSON.parse(localStorage.getItem(FB_META_KEY) || '{}');
  } catch {
    prev = {};
  }
  localStorage.setItem(FB_META_KEY, JSON.stringify({ ...prev, ...patch }));
}

export function saveFamilyCode(code) {
  const cleaned = cleanFamilyCode(code);
  if (cleaned.length < 24) {
    throw new Error('가족 코드는 24자 이상의 영문·숫자여야 합니다 (KidQuest 가족 코드 그대로 입력 가능).');
  }
  localStorage.setItem(FC_FAMILY_KEY, cleaned);
  saveFirebaseSyncMeta({ disabled: false });
  return cleaned;
}

export function clearFirebaseSync() {
  localStorage.removeItem(FC_FAMILY_KEY);
  saveFirebaseSyncMeta({ disabled: true, lastSyncedAt: 0 });
}

export function buildFamilyShareUrl(familyCode) {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#family=${encodeURIComponent(familyCode)}`;
}

function getNodeBaseUrl(familyCode) {
  // Completely separate sibling node from KidQuest's `/families/{code}`!
  return `${FIREBASE_DB_URL}/families/${encodeURIComponent(`${familyCode}_fluentcam`)}`;
}

function getCryptoScope(familyCode) {
  return `firebase:${familyCode}`;
}

export function createFirebaseCloudSync({
  getLocalSnapshot,
  applyMergedSnapshot,
  onStatusChange,
  requestCloudPinPrompt,
}) {
  let debounceTimer = null;
  let inFlight = false;
  let pendingPush = false;
  let lastPullAt = 0;
  let lastPushedUpdatedAt = 0;
  let lastSyncedSignature = '';
  let cachedCloudPinVerifier = null;
  let cachedCloudEncryptedApiKey = null;
  let cachedCloudMeta = null;
  let sseSource = null;
  let sseReconnectTimer = null;

  function emitStatus(state, message = '') {
    const cfg = loadFirebaseSyncConfig();
    onStatusChange?.({
      provider: 'firebase',
      state, // 'disconnected' | 'syncing' | 'synced' | 'error' | 'pin_required'
      message,
      familyCode: cfg.familyCode,
      source: cfg.source,
      enabled: cfg.enabled,
      lastSyncedAt: cfg.lastSyncedAt,
    });
  }

  function computeContentSignature(snapshot) {
    return JSON.stringify({
      settings: snapshot.settings,
      apiKeyLen: (snapshot.apiKey || '').length,
      apiKeyTail: (snapshot.apiKey || '').slice(-6),
      pinUpdatedAt: snapshot.pinUpdatedAt || 0,
      historyIds: (snapshot.history || []).map((h) => h.id),
      aiBookIds: (snapshot.aiBooks || []).map((b) => b.id),
      deletedAiBookIds: snapshot.deletedAiBookIds || [],
      fsrsSig: (snapshot.fsrsDeck || []).map((c) => `${c.id}:${c.reps || 0}:${c.lastReview || 0}`),
    });
  }

  async function fetchRemoteData(familyCode) {
    const res = await fetch(`${getNodeBaseUrl(familyCode)}.json`, {
      method: 'GET',
      cache: 'no-store',
    });
    if (res.status === 401 || res.status === 403) {
      throw new Error('Firebase 접근 권한 오류(401/403). 가족 코드가 24자 이상인지 확인해 주세요.');
    }
    if (!res.ok) {
      throw new Error(`Firebase 데이터 불러오기 실패 (HTTP ${res.status})`);
    }
    const data = await res.json();
    return data && typeof data === 'object' ? data : null;
  }

  async function putRemoteData(familyCode, payload) {
    const res = await fetch(`${getNodeBaseUrl(familyCode)}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.status === 401 || res.status === 403) {
      throw new Error('Firebase 쓰기 권한 오류(401/403). 가족 코드가 24자 이상인지 확인해 주세요.');
    }
    if (!res.ok) {
      throw new Error(`Firebase 저장 실패 (HTTP ${res.status})`);
    }
    return true;
  }

  async function resolveCloudApiKey(cloudData, local, familyCode, allowPrompt) {
    if (!cloudData?.encryptedApiKey) {
      cachedCloudEncryptedApiKey = null;
      cachedCloudPinVerifier = null;
      cachedCloudMeta = null;
      return { apiKey: '', resolvedPin: null, needsPin: false };
    }

    const scope = getCryptoScope(familyCode);
    const localPin = local.pin || '0000';
    const localPinTs = local.pinUpdatedAt || 0;
    const cloudPinTs = cloudData.pinUpdatedAt || 0;
    const localKeyTs = local.apiKeyUpdatedAt || 0;
    const cloudKeyTs = cloudData.apiKeyUpdatedAt || cloudData.updatedAt || 0;

    if (localPinTs > cloudPinTs && (local.apiKey || localKeyTs > cloudKeyTs)) {
      cachedCloudEncryptedApiKey = null;
      cachedCloudPinVerifier = null;
      cachedCloudMeta = null;
      return { apiKey: '', resolvedPin: null, needsPin: false };
    }

    try {
      const decrypted = await decryptApiKey(cloudData.encryptedApiKey, localPin, scope);
      if (decrypted) {
        cachedCloudEncryptedApiKey = null;
        cachedCloudPinVerifier = null;
        cachedCloudMeta = null;
        return { apiKey: decrypted, resolvedPin: localPin, needsPin: false };
      }
    } catch {
      // PIN mismatch
    }

    if (allowPrompt && typeof requestCloudPinPrompt === 'function') {
      const enteredPin = await requestCloudPinPrompt();
      if (enteredPin && /^\d{4}$/.test(enteredPin)) {
        try {
          const decrypted = await decryptApiKey(cloudData.encryptedApiKey, enteredPin, scope);
          if (decrypted) {
            cachedCloudEncryptedApiKey = null;
            cachedCloudPinVerifier = null;
            cachedCloudMeta = null;
            return { apiKey: decrypted, resolvedPin: enteredPin, needsPin: false };
          }
        } catch {
          // Wrong PIN
        }
      }
    }

    cachedCloudEncryptedApiKey = cloudData.encryptedApiKey;
    cachedCloudPinVerifier = cloudData.pinVerifier || null;
    cachedCloudMeta = {
      pinUpdatedAt: cloudData.pinUpdatedAt || 0,
      apiKeyUpdatedAt: cloudData.apiKeyUpdatedAt || cloudData.updatedAt || 0,
    };
    return { apiKey: '', resolvedPin: null, needsPin: true };
  }

  async function tryUnlockWithPin(enteredPin) {
    const cfg = loadFirebaseSyncConfig();
    if (!cfg.enabled || !cachedCloudPinVerifier) return { matched: false };
    const scope = getCryptoScope(cfg.familyCode);
    const ok = await verifyPinAgainstCloud(enteredPin, scope, cachedCloudPinVerifier);
    if (!ok) return { matched: false };

    let decryptedKey = '';
    if (cachedCloudEncryptedApiKey) {
      try {
        decryptedKey = await decryptApiKey(cachedCloudEncryptedApiKey, enteredPin, scope);
      } catch {
        // ignore
      }
    }
    const meta = cachedCloudMeta || {};
    cachedCloudEncryptedApiKey = null;
    cachedCloudPinVerifier = null;
    cachedCloudMeta = null;
    return {
      matched: true,
      apiKey: decryptedKey,
      pinUpdatedAt: meta.pinUpdatedAt || 0,
      apiKeyUpdatedAt: meta.apiKeyUpdatedAt || 0,
    };
  }

  function mergeWithCloud(local, cloudData, decryptedCloudApiKey, resolvedCloudPin) {
    if (!cloudData) {
      return {
        ...local,
        settingsUpdatedAt: local.settingsUpdatedAt || Date.now(),
        apiKeyUpdatedAt: local.apiKey ? local.apiKeyUpdatedAt || Date.now() : 0,
      };
    }

    const { settings, settingsUpdatedAt } = mergeSettings(
      local.settings,
      local.settingsUpdatedAt || 0,
      cloudData.settings,
      cloudData.settingsUpdatedAt || 0
    );

    const history = mergeHistory(local.history || [], Array.isArray(cloudData.history) ? cloudData.history : []);
    const fsrsDeck = mergeFsrsDeck(local.fsrsDeck || [], Array.isArray(cloudData.fsrsDeck) ? cloudData.fsrsDeck : []);
    const { aiBooks, deletedAiBookIds } = mergeAiBooks(
      local.aiBooks || [],
      Array.isArray(cloudData.aiBooks) ? cloudData.aiBooks : [],
      local.deletedAiBookIds || [],
      Array.isArray(cloudData.deletedAiBookIds) ? cloudData.deletedAiBookIds : []
    );

    let apiKey = local.apiKey || '';
    let apiKeyUpdatedAt = local.apiKeyUpdatedAt || 0;
    const cloudKeyTs = cloudData.apiKeyUpdatedAt || cloudData.updatedAt || 0;
    if (decryptedCloudApiKey && (!apiKey || cloudKeyTs > apiKeyUpdatedAt)) {
      apiKey = decryptedCloudApiKey;
      apiKeyUpdatedAt = cloudKeyTs;
    }

    let pin = local.pin || '0000';
    let pinUpdatedAt = local.pinUpdatedAt || 0;
    if (resolvedCloudPin && (cloudData.pinUpdatedAt || 0) >= pinUpdatedAt) {
      pin = resolvedCloudPin;
      pinUpdatedAt = cloudData.pinUpdatedAt || pinUpdatedAt;
    }

    return {
      settings,
      settingsUpdatedAt,
      apiKey,
      apiKeyUpdatedAt,
      pin,
      pinUpdatedAt,
      history,
      fsrsDeck,
      aiBooks,
      deletedAiBookIds,
    };
  }

  async function buildCloudPayload(merged, familyCode) {
    const scope = getCryptoScope(familyCode);
    const pin = merged.pin || '0000';
    const encryptedApiKey = merged.apiKey ? await encryptApiKey(merged.apiKey, pin, scope) : null;
    const pinVerifier = await createPinVerifier(pin, scope);
    const now = Date.now();
    return {
      schemaVersion: 2,
      app: 'FluentCam Academy Pro',
      updatedAt: now,
      settingsUpdatedAt: merged.settingsUpdatedAt || now,
      apiKeyUpdatedAt: merged.apiKeyUpdatedAt || (merged.apiKey ? now : 0),
      pinUpdatedAt: merged.pinUpdatedAt || 0,
      settings: merged.settings,
      encryptedApiKey,
      pinVerifier,
      aiBooks: merged.aiBooks || [],
      deletedAiBookIds: merged.deletedAiBookIds || [],
      history: merged.history || [],
      fsrsDeck: merged.fsrsDeck || [],
    };
  }

  async function syncNow({ pushIfChanged = true, forcePush = false, allowPinPrompt = false, silent = false } = {}) {
    const cfg = loadFirebaseSyncConfig();
    if (!cfg.enabled || !cfg.familyCode) {
      emitStatus('disconnected', '가족 코드 미연결');
      return { ok: false, skipped: true };
    }
    if (inFlight) {
      if (pushIfChanged || forcePush) pendingPush = true;
      return { ok: true, queued: true };
    }

    inFlight = true;
    emitStatus('syncing', '가족 클라우드 동기화 중...');

    try {
      const local = getLocalSnapshot();
      const cloudData = await fetchRemoteData(cfg.familyCode);
      lastPullAt = Date.now();

      const keyRes = await resolveCloudApiKey(cloudData, local, cfg.familyCode, allowPinPrompt);
      const pinNeeded = keyRes.needsPin;
      const merged = mergeWithCloud(local, cloudData, keyRes.apiKey, keyRes.resolvedPin);

      const localSig = computeContentSignature(local);
      const mergedSig = computeContentSignature(merged);
      const changedLocally = localSig !== mergedSig;

      if (changedLocally) {
        applyMergedSnapshot(merged);
      }

      const cloudSig = cloudData
        ? computeContentSignature({
            settings: cloudData.settings,
            apiKey: keyRes.apiKey || '',
            pinUpdatedAt: cloudData.pinUpdatedAt || 0,
            history: Array.isArray(cloudData.history) ? cloudData.history : [],
            aiBooks: Array.isArray(cloudData.aiBooks) ? cloudData.aiBooks : [],
            deletedAiBookIds: Array.isArray(cloudData.deletedAiBookIds) ? cloudData.deletedAiBookIds : [],
            fsrsDeck: Array.isArray(cloudData.fsrsDeck) ? cloudData.fsrsDeck : [],
          })
        : '';

      const shouldPush =
        forcePush ||
        (pushIfChanged && (!cloudData || (mergedSig !== cloudSig && !pinNeeded)));

      if (shouldPush) {
        const payload = await buildCloudPayload(merged, cfg.familyCode);
        lastPushedUpdatedAt = payload.updatedAt;
        await putRemoteData(cfg.familyCode, payload);
      } else if (cloudData?.updatedAt) {
        lastPushedUpdatedAt = Number(cloudData.updatedAt) || lastPushedUpdatedAt;
      }

      lastSyncedSignature = mergedSig;
      saveFirebaseSyncMeta({ lastSyncedAt: Date.now(), disabled: false });

      if (pinNeeded) {
        emitStatus('pin_required', '설정 동기화됨 · 부모 PIN 입력 시 암호화 API 키 복원');
      } else {
        emitStatus('synced', '가족 실시간 클라우드와 동기화됨');
      }

      startRealtimeWatch();
      return { ok: true, changedLocally, pinNeeded };
    } catch (err) {
      console.warn('[FirebaseCloudSync] error:', err);
      emitStatus('error', err.message || '동기화 오류');
      if (!silent) throw err;
      return { ok: false, error: err.message };
    } finally {
      inFlight = false;
      if (pendingPush) {
        pendingPush = false;
        schedulePush(600);
      }
    }
  }

  function startRealtimeWatch() {
    const cfg = loadFirebaseSyncConfig();
    if (!cfg.enabled || !cfg.familyCode || typeof window.EventSource !== 'function') return;
    if (sseSource) return;

    try {
      const watchUrl = `${getNodeBaseUrl(cfg.familyCode)}/updatedAt.json`;
      const es = new EventSource(watchUrl);
      sseSource = es;

      const handleUpdate = (ev) => {
        try {
          const parsed = JSON.parse(ev.data);
          const remoteTs = Number(parsed?.data ?? parsed) || 0;
          if (remoteTs > 0 && remoteTs !== lastPushedUpdatedAt) {
            lastPushedUpdatedAt = remoteTs;
            syncNow({ pushIfChanged: false, silent: true });
          }
        } catch {
          // ignore keep-alive or malformed event
        }
      };

      es.addEventListener('put', handleUpdate);
      es.addEventListener('patch', handleUpdate);
      es.onerror = () => {
        stopRealtimeWatch();
        clearTimeout(sseReconnectTimer);
        sseReconnectTimer = setTimeout(() => {
          if (loadFirebaseSyncConfig().enabled) startRealtimeWatch();
        }, 8000);
      };
    } catch {
      // ignore if EventSource blocked
    }
  }

  function stopRealtimeWatch() {
    clearTimeout(sseReconnectTimer);
    if (sseSource) {
      try {
        sseSource.close();
      } catch {
        // ignore
      }
      sseSource = null;
    }
  }

  function schedulePush(delayMs = 1200) {
    const cfg = loadFirebaseSyncConfig();
    if (!cfg.enabled) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const local = getLocalSnapshot();
      const sig = computeContentSignature(local);
      if (sig === lastSyncedSignature && cfg.lastSyncedAt > 0) return;
      syncNow({ pushIfChanged: true, silent: true });
    }, delayMs);
  }

  async function connectWithFamilyCode(code) {
    stopRealtimeWatch();
    const cleaned = saveFamilyCode(code);
    lastSyncedSignature = '';
    lastPushedUpdatedAt = 0;
    return syncNow({ pushIfChanged: true, allowPinPrompt: true, silent: false });
  }

  function disconnect() {
    clearTimeout(debounceTimer);
    stopRealtimeWatch();
    clearFirebaseSync();
    cachedCloudEncryptedApiKey = null;
    cachedCloudPinVerifier = null;
    cachedCloudMeta = null;
    lastSyncedSignature = '';
    emitStatus('disconnected', '가족 클라우드 연결 해제됨');
  }

  function pullOnVisibilityIfStale(minIntervalMs = 20000) {
    const cfg = loadFirebaseSyncConfig();
    if (!cfg.enabled) return;
    if (Date.now() - lastPullAt >= minIntervalMs) {
      syncNow({ pushIfChanged: false, silent: true });
    }
  }

  return {
    syncNow,
    schedulePush,
    connectWithFamilyCode,
    disconnect,
    tryUnlockWithPin,
    pullOnVisibilityIfStale,
    startRealtimeWatch,
    stopRealtimeWatch,
    emitCurrentStatus: () => {
      const cfg = loadFirebaseSyncConfig();
      if (!cfg.enabled) emitStatus('disconnected', '가족 코드 미연결');
      else emitStatus('synced', '가족 실시간 클라우드 연결됨');
    },
  };
}

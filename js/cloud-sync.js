/**
 * Private GitHub Repository Auto Cloud Sync for FluentCam Academy Pro
 *
 * - Stores family settings, AI textbooks, lesson history, FSRS flashcards,
 *   and AES-256-GCM encrypted Gemini API key in a PRIVATE GitHub repo (`family-sync.json`).
 * - Refuses to sync to any public repository for safety.
 * - Performs conflict-free smart merging (union merge for history, FSRS cards, AI books, max stars)
 *   and automatic SHA conflict retry on concurrent multi-device updates.
 */

export const DEFAULT_SYNC_REPO = 'alpinu83/fluentcam-family-data';
const SYNC_FILE_PATH = 'family-sync.json';
const SYNC_BRANCH = 'main';
const CONFIG_STORAGE_KEY = 'fluentcam_github_sync_v1';

// ==================== UTF-8 & BASE64 HELPERS ====================
function bytesToBase64(bytes) {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function base64ToBytes(b64) {
  const clean = String(b64 || '').replace(/\s+/g, '');
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function utf8ToBase64(str) {
  return bytesToBase64(new TextEncoder().encode(str));
}

function base64ToUtf8(b64) {
  return new TextDecoder().decode(base64ToBytes(b64));
}

export function normalizeRepoSlug(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  const stripped = raw
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/^\/+|\/+$/g, '');
  const parts = stripped.split('/').filter(Boolean);
  if (parts.length < 2) return '';
  return `${parts[0]}/${parts[1]}`;
}

// ==================== WEB CRYPTO AES-256-GCM & PIN VERIFIER ====================
function ensureWebCrypto() {
  if (!window.crypto?.subtle) {
    throw new Error('이 브라우저 환경에서는 Web Crypto 암호화를 사용할 수 없습니다 (HTTPS 접속 필요).');
  }
  return window.crypto.subtle;
}

async function deriveAesKey(passphrase, saltBytes, iterations = 120000) {
  const subtle = ensureWebCrypto();
  const baseKey = await subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBytes, iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptApiKey(apiKey, pin, repo) {
  if (!apiKey) return null;
  const subtle = ensureWebCrypto();
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const pass = `${String(pin || '0000')}::${repo.toLowerCase()}::fluentcam-v2`;
  const key = await deriveAesKey(pass, salt);
  const cipherBuf = await subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(apiKey)
  );
  return {
    alg: 'AES-256-GCM',
    kdf: 'PBKDF2-SHA256-120k',
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ct: bytesToBase64(new Uint8Array(cipherBuf)),
  };
}

export async function decryptApiKey(envelope, pin, repo) {
  if (!envelope?.ct || !envelope?.salt || !envelope?.iv) return null;
  const subtle = ensureWebCrypto();
  const salt = base64ToBytes(envelope.salt);
  const iv = base64ToBytes(envelope.iv);
  const ct = base64ToBytes(envelope.ct);
  const pass = `${String(pin || '0000')}::${repo.toLowerCase()}::fluentcam-v2`;
  const key = await deriveAesKey(pass, salt);
  const plainBuf = await subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return new TextDecoder().decode(plainBuf);
}

export async function createPinVerifier(pin, repo) {
  const subtle = ensureWebCrypto();
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const baseKey = await subtle.importKey(
    'raw',
    new TextEncoder().encode(`${String(pin || '0000')}::pin-verify::${repo.toLowerCase()}`),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 60000, hash: 'SHA-256' },
    baseKey,
    256
  );
  return {
    salt: bytesToBase64(salt),
    hash: bytesToBase64(new Uint8Array(bits)),
  };
}

export async function verifyPinAgainstCloud(pin, repo, verifier) {
  if (!verifier?.salt || !verifier?.hash) return false;
  try {
    const subtle = ensureWebCrypto();
    const salt = base64ToBytes(verifier.salt);
    const baseKey = await subtle.importKey(
      'raw',
      new TextEncoder().encode(`${String(pin || '')}::pin-verify::${repo.toLowerCase()}`),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    const bits = await subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: 60000, hash: 'SHA-256' },
      baseKey,
      256
    );
    const got = new Uint8Array(bits);
    const exp = base64ToBytes(verifier.hash);
    if (got.length !== exp.length) return false;
    let diff = 0;
    for (let i = 0; i < got.length; i++) diff |= got[i] ^ exp[i];
    return diff === 0;
  } catch {
    return false;
  }
}

// ==================== CONFIG PERSISTENCE ====================
export function loadGitHubSyncConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) {
      return {
        repo: DEFAULT_SYNC_REPO,
        token: '',
        enabled: false,
        lastSyncedAt: 0,
        lastSha: null,
      };
    }
    const parsed = JSON.parse(raw);
    return {
      repo: normalizeRepoSlug(parsed.repo) || DEFAULT_SYNC_REPO,
      token: String(parsed.token || '').trim(),
      enabled: Boolean(parsed.enabled && parsed.token && normalizeRepoSlug(parsed.repo)),
      lastSyncedAt: Number(parsed.lastSyncedAt) || 0,
      lastSha: parsed.lastSha || null,
    };
  } catch {
    return {
      repo: DEFAULT_SYNC_REPO,
      token: '',
      enabled: false,
      lastSyncedAt: 0,
      lastSha: null,
    };
  }
}

export function saveGitHubSyncConfig(cfg) {
  const normalized = {
    repo: normalizeRepoSlug(cfg.repo) || DEFAULT_SYNC_REPO,
    token: String(cfg.token || '').trim(),
    enabled: Boolean(cfg.enabled && cfg.token && normalizeRepoSlug(cfg.repo)),
    lastSyncedAt: Number(cfg.lastSyncedAt) || 0,
    lastSha: cfg.lastSha || null,
  };
  localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function clearGitHubSyncConfig() {
  const prev = loadGitHubSyncConfig();
  saveGitHubSyncConfig({
    repo: prev.repo || DEFAULT_SYNC_REPO,
    token: '',
    enabled: false,
    lastSyncedAt: 0,
    lastSha: null,
  });
}

// ==================== GITHUB REST API ====================
function ghHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

export async function verifyPrivateRepoAccess({ repo, token }) {
  const slug = normalizeRepoSlug(repo);
  if (!slug) throw new Error('저장소 형식이 올바르지 않습니다. (예: alpinu83/fluentcam-family-data)');
  if (!token || token.length < 10) throw new Error('GitHub Personal Access Token을 입력해 주세요.');

  const res = await fetch(`https://api.github.com/repos/${slug}`, {
    method: 'GET',
    headers: ghHeaders(token),
    cache: 'no-store',
  });

  if (res.status === 401) {
    throw new Error('GitHub 토큰 인증에 실패했습니다. 토큰이 만료되었거나 오타가 있는지 확인해 주세요.');
  }
  if (res.status === 403) {
    throw new Error('GitHub 접근 권한이 거부되었습니다. 토큰의 저장소 권한을 확인해 주세요.');
  }
  if (res.status === 404) {
    throw new Error(`저장소(${slug})를 찾을 수 없거나 토큰에 이 저장소 접근 권한이 부여되지 않았습니다.`);
  }
  if (!res.ok) {
    throw new Error(`GitHub 연결 오류 (HTTP ${res.status})`);
  }

  const meta = await res.json();
  if (!meta.private) {
    throw new Error('보안을 위해 공개(Public) 저장소에는 동기화할 수 없습니다. 비공개(Private) 저장소를 지정해 주세요.');
  }
  if (meta.permissions && meta.permissions.push === false) {
    throw new Error('토큰에 쓰기 권한이 없습니다. Fine-grained 토큰에서 [Contents: Read and write] 권한을 켜 주세요.');
  }

  return {
    fullName: meta.full_name || slug,
    defaultBranch: meta.default_branch || SYNC_BRANCH,
    isPrivate: Boolean(meta.private),
  };
}

async function fetchCloudFile({ repo, token, branch = SYNC_BRANCH }) {
  const url = `https://api.github.com/repos/${repo}/contents/${SYNC_FILE_PATH}?ref=${encodeURIComponent(branch)}&_t=${Date.now()}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: ghHeaders(token),
    cache: 'no-store',
  });

  if (res.status === 404) {
    return { exists: false, sha: null, data: null };
  }
  if (res.status === 401) {
    throw new Error('GitHub 토큰이 유효하지 않습니다 (401).');
  }
  if (res.status === 403) {
    throw new Error('GitHub 저장소 읽기 권한이 없습니다 (403).');
  }
  if (!res.ok) {
    throw new Error(`클라우드 불러오기 실패 (HTTP ${res.status})`);
  }

  const body = await res.json();
  if (!body.content) {
    return { exists: true, sha: body.sha || null, data: null };
  }
  const text = base64ToUtf8(body.content);
  const data = JSON.parse(text);
  return { exists: true, sha: body.sha || null, data };
}

async function putCloudFile({ repo, token, branch = SYNC_BRANCH, sha, data }) {
  const url = `https://api.github.com/repos/${repo}/contents/${SYNC_FILE_PATH}`;
  const content = utf8ToBase64(JSON.stringify(data, null, 2));
  const payload = {
    message: `sync: FluentCam family data (${new Date().toISOString().slice(0, 16)}Z)`,
    content,
    branch,
  };
  if (sha) payload.sha = sha;

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      ...ghHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (res.status === 409 || res.status === 422) {
    return { conflict: true, status: res.status };
  }
  if (res.status === 401) {
    throw new Error('GitHub 토큰 인증 만료 (401).');
  }
  if (res.status === 403) {
    throw new Error('GitHub 쓰기 권한이 없습니다. 토큰에 [Contents: Read and write] 권한을 확인해 주세요.');
  }
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`클라우드 저장 실패 (HTTP ${res.status}) ${errText.slice(0, 120)}`);
  }

  const result = await res.json();
  return { conflict: false, sha: result.content?.sha || null };
}

// ==================== CONFLICT-FREE SMART MERGE ====================
function mergeSettings(localSettings, localTs, cloudSettings, cloudTs) {
  if (!cloudSettings) return { settings: localSettings, settingsUpdatedAt: localTs };
  if (!localSettings) return { settings: cloudSettings, settingsUpdatedAt: cloudTs || Date.now() };

  const useCloud = (cloudTs || 0) > (localTs || 0);
  const base = structuredClone(useCloud ? cloudSettings : localSettings);
  const other = useCloud ? localSettings : cloudSettings;

  // Never lose earned stars from either device
  if (base.profiles && other.profiles) {
    for (const sid of ['grade3', 'grade6']) {
      if (base.profiles[sid] && other.profiles[sid]) {
        base.profiles[sid].stars = Math.max(
          Number(base.profiles[sid].stars) || 0,
          Number(other.profiles[sid].stars) || 0
        );
      }
    }
  }

  return {
    settings: base,
    settingsUpdatedAt: Math.max(localTs || 0, cloudTs || 0),
  };
}

function mergeHistory(localArr = [], cloudArr = []) {
  const map = new Map();
  for (const item of [...cloudArr, ...localArr]) {
    if (!item?.id) continue;
    const prev = map.get(item.id);
    if (!prev) {
      map.set(item.id, item);
    } else {
      const prevLen = Array.isArray(prev.transcript) ? prev.transcript.length : 0;
      const curLen = Array.isArray(item.transcript) ? item.transcript.length : 0;
      if (curLen >= prevLen) map.set(item.id, item);
    }
  }
  return [...map.values()]
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 60);
}

function mergeFsrsDeck(localArr = [], cloudArr = []) {
  const map = new Map();
  for (const card of [...cloudArr, ...localArr]) {
    if (!card?.id) continue;
    const prev = map.get(card.id);
    if (!prev) {
      map.set(card.id, card);
    } else {
      const prevScore = (prev.lastReview || 0) * 10 + (prev.reps || 0);
      const curScore = (card.lastReview || 0) * 10 + (card.reps || 0);
      if (curScore >= prevScore) map.set(card.id, card);
    }
  }
  return [...map.values()].slice(0, 300);
}

function mergeAiBooks(localBooks = [], cloudBooks = [], localDeleted = [], cloudDeleted = []) {
  const deletedSet = new Set([...(localDeleted || []), ...(cloudDeleted || [])]);
  const map = new Map();
  for (const b of [...cloudBooks, ...localBooks]) {
    if (!b?.id || deletedSet.has(b.id)) continue;
    if (!map.has(b.id)) map.set(b.id, b);
  }
  return {
    aiBooks: [...map.values()]
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, 40),
    deletedAiBookIds: [...deletedSet].slice(-100),
  };
}

// ==================== CLOUD SYNC CONTROLLER ====================
export function createGitHubCloudSync({
  getLocalSnapshot,
  applyMergedSnapshot,
  onStatusChange,
  requestCloudPinPrompt,
}) {
  let debounceTimer = null;
  let inFlight = false;
  let pendingPush = false;
  let lastPullAt = 0;
  let lastSyncedSignature = '';
  let cachedCloudPinVerifier = null;
  let cachedCloudEncryptedApiKey = null;

  function emitStatus(state, message = '') {
    const cfg = loadGitHubSyncConfig();
    onStatusChange?.({
      state, // 'disconnected' | 'idle' | 'syncing' | 'synced' | 'error' | 'pin_required'
      message,
      repo: cfg.repo,
      enabled: cfg.enabled,
      lastSyncedAt: cfg.lastSyncedAt,
    });
  }

  function computeContentSignature(snapshot) {
    // Stable lightweight digest of synced fields to avoid redundant commits
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

  let cachedCloudMeta = null;

  async function resolveCloudApiKey(cloudData, local, repo, allowPrompt) {
    if (!cloudData?.encryptedApiKey) {
      return { apiKey: '', resolvedPin: null, needsPin: false };
    }
    const localPin = local.pin || '0000';
    const localChangedPin = (local.pinUpdatedAt || 0) > (cloudData.pinUpdatedAt || 0);
    const localHasNewerKey = Boolean(local.apiKey) && (local.apiKeyUpdatedAt || 0) > (cloudData.apiKeyUpdatedAt || 0);

    // If this device intentionally changed the PIN (and has its own key or wants to re-encrypt),
    // try decrypting old cloud key only if local has no key; otherwise this device is authoritative.
    if (localChangedPin && (local.apiKey || localHasNewerKey)) {
      cachedCloudEncryptedApiKey = null;
      cachedCloudPinVerifier = null;
      cachedCloudMeta = null;
      return { apiKey: '', resolvedPin: null, needsPin: false };
    }

    // 1. Try current local PIN silently first (works automatically when PIN is 0000 or already matched)
    try {
      const decrypted = await decryptApiKey(cloudData.encryptedApiKey, localPin, repo);
      if (decrypted) {
        cachedCloudEncryptedApiKey = null;
        cachedCloudPinVerifier = null;
        cachedCloudMeta = null;
        return { apiKey: decrypted, resolvedPin: localPin, needsPin: false };
      }
    } catch {
      // PIN mismatch — fall through
    }

    // 2. If interactive prompt allowed (e.g., parent just clicked Connect on a new device), ask for cloud PIN
    if (allowPrompt && typeof requestCloudPinPrompt === 'function') {
      const enteredPin = await requestCloudPinPrompt();
      if (enteredPin && /^\d{4}$/.test(enteredPin)) {
        try {
          const decrypted = await decryptApiKey(cloudData.encryptedApiKey, enteredPin, repo);
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

    // Cache so when the parent unlocks Parent Admin with the cloud PIN, it auto-decrypts!
    cachedCloudEncryptedApiKey = cloudData.encryptedApiKey;
    cachedCloudPinVerifier = cloudData.pinVerifier || null;
    cachedCloudMeta = {
      pinUpdatedAt: cloudData.pinUpdatedAt || 0,
      apiKeyUpdatedAt: cloudData.apiKeyUpdatedAt || cloudData.updatedAt || 0,
    };
    return { apiKey: '', resolvedPin: null, needsPin: true };
  }

  async function tryUnlockWithPin(enteredPin) {
    const cfg = loadGitHubSyncConfig();
    if (!cfg.enabled || !cachedCloudPinVerifier) return { matched: false };
    const ok = await verifyPinAgainstCloud(enteredPin, cfg.repo, cachedCloudPinVerifier);
    if (!ok) return { matched: false };

    let decryptedKey = '';
    if (cachedCloudEncryptedApiKey) {
      try {
        decryptedKey = await decryptApiKey(cachedCloudEncryptedApiKey, enteredPin, cfg.repo);
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

  async function buildCloudPayload(merged, repo) {
    const pin = merged.pin || '0000';
    const encryptedApiKey = merged.apiKey ? await encryptApiKey(merged.apiKey, pin, repo) : null;
    const pinVerifier = await createPinVerifier(pin, repo);
    return {
      schemaVersion: 2,
      app: 'FluentCam Academy Pro',
      updatedAt: Date.now(),
      settingsUpdatedAt: merged.settingsUpdatedAt || Date.now(),
      apiKeyUpdatedAt: merged.apiKeyUpdatedAt || (merged.apiKey ? Date.now() : 0),
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

    const history = mergeHistory(local.history || [], cloudData.history || []);
    const fsrsDeck = mergeFsrsDeck(local.fsrsDeck || [], cloudData.fsrsDeck || []);
    const { aiBooks, deletedAiBookIds } = mergeAiBooks(
      local.aiBooks || [],
      cloudData.aiBooks || [],
      local.deletedAiBookIds || [],
      cloudData.deletedAiBookIds || []
    );

    // Choose newest API key (prefer decrypted cloud key if local is empty or cloud is newer)
    let apiKey = local.apiKey || '';
    let apiKeyUpdatedAt = local.apiKeyUpdatedAt || 0;
    const cloudKeyTs = cloudData.apiKeyUpdatedAt || cloudData.updatedAt || 0;
    if (decryptedCloudApiKey && (!apiKey || cloudKeyTs > apiKeyUpdatedAt)) {
      apiKey = decryptedCloudApiKey;
      apiKeyUpdatedAt = cloudKeyTs;
    }

    // Choose PIN
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

  /**
   * Pull from GitHub private repo, smart-merge with local, apply locally,
   * and optionally push back if local had newer or additional records.
   */
  async function syncNow({ pushIfChanged = true, forcePush = false, allowPinPrompt = false, silent = false } = {}) {
    const cfg = loadGitHubSyncConfig();
    if (!cfg.enabled || !cfg.token || !cfg.repo) {
      emitStatus('disconnected', 'GitHub 미연결');
      return { ok: false, skipped: true };
    }
    if (inFlight) {
      if (pushIfChanged || forcePush) pendingPush = true;
      return { ok: true, queued: true };
    }

    inFlight = true;
    emitStatus('syncing', 'GitHub 클라우드 동기화 중...');

    try {
      let attempt = 0;
      let finalSha = cfg.lastSha;
      let pinNeeded = false;
      let changedLocally = false;

      while (attempt < 2) {
        attempt += 1;
        const local = getLocalSnapshot();
        const remote = await fetchCloudFile({ repo: cfg.repo, token: cfg.token });
        lastPullAt = Date.now();

        let decryptedKey = '';
        let resolvedPin = null;
        if (remote.exists && remote.data) {
          const res = await resolveCloudApiKey(remote.data, local, cfg.repo, allowPinPrompt);
          decryptedKey = res.apiKey;
          resolvedPin = res.resolvedPin;
          pinNeeded = res.needsPin;
        }

        const merged = mergeWithCloud(local, remote.data, decryptedKey, resolvedPin);
        const localSigBefore = computeContentSignature(local);
        const mergedSig = computeContentSignature(merged);

        if (mergedSig !== localSigBefore) {
          applyMergedSnapshot(merged);
          changedLocally = true;
        }

        const cloudSig = remote.data
          ? computeContentSignature({
              settings: remote.data.settings,
              apiKey: decryptedKey || (remote.data.encryptedApiKey ? '______' : ''),
              pinUpdatedAt: remote.data.pinUpdatedAt || 0,
              history: remote.data.history || [],
              aiBooks: remote.data.aiBooks || [],
              deletedAiBookIds: remote.data.deletedAiBookIds || [],
              fsrsDeck: remote.data.fsrsDeck || [],
            })
          : '';

        const needsUpload =
          forcePush ||
          !remote.exists ||
          (pushIfChanged && mergedSig !== cloudSig && !pinNeeded);

        if (needsUpload) {
          const payload = await buildCloudPayload(merged, cfg.repo);
          const putRes = await putCloudFile({
            repo: cfg.repo,
            token: cfg.token,
            sha: remote.sha,
            data: payload,
          });
          if (putRes.conflict && attempt < 2) {
            continue; // Re-fetch & re-merge on 409 SHA conflict
          }
          if (putRes.conflict) {
            throw new Error('다른 기기와 동시 저장이 충돌했습니다. 잠시 후 다시 시도해 주세요.');
          }
          finalSha = putRes.sha;
        } else {
          finalSha = remote.sha;
        }

        lastSyncedSignature = mergedSig;
        break;
      }

      const now = Date.now();
      saveGitHubSyncConfig({ ...cfg, lastSyncedAt: now, lastSha: finalSha });

      if (pinNeeded) {
        emitStatus('pin_required', '설정 동기화됨 · 부모 PIN 입력 시 암호화 API 키 복원');
      } else {
        emitStatus('synced', 'GitHub 비공개 저장소와 동기화됨');
      }

      return { ok: true, changedLocally, pinNeeded };
    } catch (err) {
      console.warn('[GitHubCloudSync] error:', err);
      emitStatus('error', err.message || '동기화 오류');
      if (!silent) throw err;
      return { ok: false, error: err.message };
    } finally {
      inFlight = false;
      if (pendingPush) {
        pendingPush = false;
        schedulePush(800);
      }
    }
  }

  function schedulePush(delayMs = 1800) {
    const cfg = loadGitHubSyncConfig();
    if (!cfg.enabled) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const local = getLocalSnapshot();
      const sig = computeContentSignature(local);
      if (sig === lastSyncedSignature && cfg.lastSyncedAt > 0) return;
      syncNow({ pushIfChanged: true, silent: true });
    }, delayMs);
  }

  async function connectAndSync({ repo, token }) {
    const verified = await verifyPrivateRepoAccess({ repo, token });
    saveGitHubSyncConfig({
      repo: verified.fullName,
      token: token.trim(),
      enabled: true,
      lastSyncedAt: 0,
      lastSha: null,
    });
    return syncNow({ pushIfChanged: true, allowPinPrompt: true, silent: false });
  }

  function disconnect() {
    clearTimeout(debounceTimer);
    clearGitHubSyncConfig();
    cachedCloudEncryptedApiKey = null;
    cachedCloudPinVerifier = null;
    lastSyncedSignature = '';
    emitStatus('disconnected', 'GitHub 동기화 해제됨');
  }

  function pullOnVisibilityIfStale(minIntervalMs = 30000) {
    const cfg = loadGitHubSyncConfig();
    if (!cfg.enabled) return;
    if (Date.now() - lastPullAt >= minIntervalMs) {
      syncNow({ pushIfChanged: false, silent: true });
    }
  }

  return {
    syncNow,
    schedulePush,
    connectAndSync,
    disconnect,
    tryUnlockWithPin,
    pullOnVisibilityIfStale,
    emitCurrentStatus: () => {
      const cfg = loadGitHubSyncConfig();
      if (!cfg.enabled) emitStatus('disconnected', 'GitHub 미연결');
      else emitStatus('synced', 'GitHub 자동 동기화 켜짐');
    },
  };
}

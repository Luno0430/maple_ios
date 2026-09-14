/* 주간 메이플 · 웹
 *
 * 안드로이드 앱과 같은 계산을 브라우저에서 합니다.
 * 저장은 이 폰(localStorage)에만 하고, 넥슨 서버 외에는 아무 데도 보내지 않습니다.
 */

'use strict';

/* ══════════════════════════════════════════════════════════
 * 보스 · 결정석 가격 (만 메소, 2026-07-01 기준)
 * ══════════════════════════════════════════════════════════ */

const WEEKLY = [
  ['zk', '자쿰',         [['카오스', 808]]],
  ['mg', '매그너스',       [['하드', 856]]],
  ['pp', '파풀라투스',      [['카오스', 1310]]],
  ['pr', '피에르',        [['카오스', 817]]],
  ['bb', '반반',         [['카오스', 815]]],
  ['bq', '블러디퀸',       [['카오스', 814]]],
  ['vl', '벨룸',         [['카오스', 928]]],
  ['su', '스우',         [['노멀', 1670], ['하드', 5150], ['익스트림', 57400]]],
  ['dm', '데미안',        [['노멀', 1750], ['하드', 4890]]],
  ['slm', '가디언 엔젤 슬라임', [['노멀', 2550], ['카오스', 7510]]],
  ['lu', '루시드',        [['이지', 2980], ['노멀', 3560], ['하드', 6290]]],
  ['wl', '윌',          [['이지', 3230], ['노멀', 4110], ['하드', 7710]]],
  ['dk', '더스크',        [['노멀', 4400], ['카오스', 6980]]],
  ['jh', '진 힐라',       [['노멀', 7120], ['하드', 10600]]],
  ['du', '듄켈',         [['노멀', 4750], ['하드', 9444]]],
  ['sr', '선택받은 세렌',    [['노멀', 23900], ['하드', 35600], ['익스트림', 283500]]],
  ['kl', '감시자 칼로스',    [['이지', 28000], ['노멀', 50500], ['카오스', 127300], ['익스트림', 410400]]],
  ['ad', '최초의 대적자',    [['이지', 30800], ['노멀', 56000], ['하드', 143500], ['익스트림', 471200]]],
  ['kr', '카링',         [['이지', 37700], ['노멀', 67800], ['하드', 173900], ['익스트림', 538700]]],
  ['hs', '찬란한 흉성',     [['노멀', 62500], ['하드', 267800]]],
  ['bl', '벨로나',        [['이지', 44000], ['노멀', 85000], ['하드', 295000]]],
  ['lb', '림보',         [['노멀', 102600], ['하드', 238500]]],
  ['bd', '발드릭스',       [['노멀', 136800], ['하드', 307800]]],
  ['jp', '유피테르',       [['노멀', 161500], ['하드', 484500]]],
  ['ml', '시즌 보스 메이린',  [['노멀', 0], ['하드', 0]]]
];
const MONTHLY = [
  ['bm', '검은 마법사', [['하드', 66500], ['익스트림', 874000]], true]
];

const BOSSES = [...WEEKLY, ...MONTHLY].map(([id, name, tiers, monthly]) => ({
  id, name, tiers: tiers.map(([n, p]) => ({ name: n, price: p })), monthly: !!monthly, maxParty: 6
}));
const BY_ID = Object.fromEntries(BOSSES.map(b => [b.id, b]));
const CAP_CHARACTER = 12;   // 캐릭터당 주간 결정석 12개
const CAP_ACCOUNT = 90;     // 계정당 주간 결정석 90개

const priceKey = (bossId, tier) => bossId + ':' + tier;

function priceOf(bossId, tier) {
  const over = S.prices[priceKey(bossId, tier)];
  if (over != null) return over;
  const b = BY_ID[bossId];
  const t = b && b.tiers.find(x => x.name === tier);
  return t ? t.price : 0;
}
const sharePrice = (base, party) => (party <= 1 ? base : Math.floor(base / party));
const priceText = (man) => (man <= 0 ? '가격 ?' : meso(man));

/** 조 / 억 / 만 — 윗자리 두 덩이만 */
function meso(man) {
  if (man <= 0) return '0';
  let v = man;
  const parts = [];
  const jo = Math.floor(v / 100000000); v %= 100000000;
  const eok = Math.floor(v / 10000);    v %= 10000;
  if (jo > 0) parts.push(group(jo) + '조');
  if (eok > 0) parts.push(group(eok) + '억');
  if (v > 0 || parts.length === 0) parts.push(group(v) + '만');
  return parts.slice(0, 2).join(' ');
}
const group = (n) => n.toLocaleString('ko-KR');

function powerText(v) {
  if (!v || v <= 0) return '';
  const eok = Math.floor(v / 100000000);
  const man = Math.floor((v % 100000000) / 10000);
  if (eok > 0 && man > 0) return eok + '억 ' + group(man) + '만';
  if (eok > 0) return eok + '억';
  if (man > 0) return group(man) + '만';
  return group(v);
}

/* ══════════════════════════════════════════════════════════
 * 날짜 — 전부 한국 시간
 *   주간보스 · 플래그 · 수로 : 매주 목요일 0시
 *   검은 마법사             : 매월 1일 0시
 * ══════════════════════════════════════════════════════════ */

/** 지금을 한국 시간으로 읽은 Date (getFullYear 등이 KST 값을 돌려줍니다) */
function kstNow() {
  const d = new Date();
  return new Date(d.getTime() + (d.getTimezoneOffset() + 540) * 60000);
}
/** KST 자정의 진짜 epoch(ms) */
const kstMidnight = (y, m, d) => Date.UTC(y, m, d) - 9 * 3600 * 1000;

const pad2 = (n) => (n < 10 ? '0' : '') + n;
const dateKey = (d) => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
const todayKey = () => dateKey(kstNow());
const parseKey = (k) => {
  const p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(k || '');
  return p ? new Date(+p[1], +p[2] - 1, +p[3]) : null;
};
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** 보스 주는 목요일에 시작합니다 */
function weekStart(d) {
  const back = (d.getDay() - 4 + 7) % 7;   // 일0 … 목4
  return addDays(d, -back);
}
/** 가장 최근 목요일 0시 (epoch ms) */
function lastWeekly() {
  const w = weekStart(kstNow());
  return kstMidnight(w.getFullYear(), w.getMonth(), w.getDate());
}
const nextWeekly = () => lastWeekly() + 7 * 86400000;
function lastMonthly() {
  const n = kstNow();
  return kstMidnight(n.getFullYear(), n.getMonth(), 1);
}
function nextMonthly() {
  const n = kstNow();
  return kstMidnight(n.getFullYear(), n.getMonth() + 1, 1);
}

/** "3일 12:04" 또는 "07:21:35" */
function countdown(until) {
  let s = Math.max(0, Math.floor((until - Date.now()) / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60), sec = s % 60;
  return d > 0 ? d + '일 ' + pad2(h) + ':' + pad2(m) : pad2(h) + ':' + pad2(m) + ':' + pad2(sec);
}

/* ══════════════════════════════════════════════════════════
 * 상태
 * ══════════════════════════════════════════════════════════ */

const STORE_KEY = 'jubo_web_v1';

let S = blank();
function blank() {
  return {
    key: '', proxy: '', toons: [], guildFlag: false, guildWater: false,
    autoSync: true, prices: {}, log: [], lastApiDate: '',
    rBoss: 0, rGuild: 0, rMonth: 0
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) S = Object.assign(blank(), JSON.parse(raw));
  } catch (e) { /* 사생활 보호 모드 등 */ }
  S.toons = (S.toons || []).map(t => Object.assign({
    ocid: '', world: '', job: '', level: 0, power: 0, powerAt: 0,
    bosses: {}, done: [], party: {}, syncedAt: 0
  }, t));
  applyResets();
}

function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) {}
}

/** 초기화 시각이 지났으면 체크를 비웁니다. 자주 불러도 안전합니다. 바뀌면 true. */
function applyResets() {
  const rBoss = lastWeekly(), rGuild = lastWeekly(), rMonth = lastMonthly();
  if (rBoss === S.rBoss && rGuild === S.rGuild && rMonth === S.rMonth) return false;

  if (rBoss > (S.rBoss || 0)) {
    const ids = new Set(WEEKLY.map(w => w[0]));
    S.toons.forEach(t => { t.done = t.done.filter(id => !ids.has(id)); });
  }
  if (rGuild > (S.rGuild || 0)) { S.guildFlag = false; S.guildWater = false; }
  if (rMonth > (S.rMonth || 0)) {
    const ids = new Set(MONTHLY.map(w => w[0]));
    S.toons.forEach(t => { t.done = t.done.filter(id => !ids.has(id)); });
  }
  S.rBoss = rBoss; S.rGuild = rGuild; S.rMonth = rMonth;
  save();
  return true;
}

const partyOf = (t, bossId) => Math.max(1, t.party[bossId] || 1);
const myShare = (t, bossId, tier) => sharePrice(priceOf(bossId, tier), partyOf(t, bossId));

/** 캐릭터 하나의 주간/월간 합계 */
function stat(t) {
  const s = {
    earned: 0, target: 0, done: 0, total: 0,
    wEarned: 0, wTarget: 0, wDone: 0, wTotal: 0,
    mEarned: 0, mTarget: 0, mDone: 0, mTotal: 0
  };
  for (const [bossId, tier] of Object.entries(t.bosses)) {
    const b = BY_ID[bossId];
    if (!b) continue;
    const v = myShare(t, bossId, tier);
    const on = t.done.includes(bossId);
    if (b.monthly) {
      s.mTarget += v; s.mTotal++;
      if (on) { s.mEarned += v; s.mDone++; }
    } else {
      s.wTarget += v; s.wTotal++;
      if (on) { s.wEarned += v; s.wDone++; }
    }
  }
  s.earned = s.wEarned + s.mEarned; s.target = s.wTarget + s.mTarget;
  s.done = s.wDone + s.mDone; s.total = s.wTotal + s.mTotal;
  return s;
}

function totals(list) {
  const out = stat({ bosses: {}, done: [], party: {} });
  list.forEach(t => {
    const s = stat(t);
    for (const k of Object.keys(out)) out[k] += s[k];
  });
  return out;
}

/** 길드 숙제를 붙일 캐릭터 — 전투력 1위, 없으면 레벨 1위 */
function guildRep() {
  if (!S.toons.length) return null;
  const withPower = S.toons.some(t => t.power > 0);
  return S.toons.reduce((a, b) =>
    (withPower ? (b.power > a.power ? b : a) : (b.level > a.level ? b : a)), S.toons[0]);
}

/* 기록 ─────────────────────────────────────────────────── */

function logAdd(t, bossId) {
  const tier = t.bosses[bossId];
  if (!tier) return;
  S.log.push({
    date: todayKey(), toonId: t.id, toonName: t.name,
    bossId, tier, party: partyOf(t, bossId), meso: myShare(t, bossId, tier)
  });
  trimLog();
}
function logRemove(t, bossId) {
  for (let i = S.log.length - 1; i >= 0; i--) {
    if (S.log[i].toonId === t.id && S.log[i].bossId === bossId) { S.log.splice(i, 1); return; }
  }
}
function trimLog() {
  if (S.log.length < 400) return;
  const cut = dateKey(addDays(kstNow(), -400));
  S.log = S.log.filter(e => e.date >= cut);
}
function sumBetween(fromKey, toKeyExclusive) {
  return S.log.reduce((a, e) =>
    (e.date >= fromKey && e.date < toKeyExclusive ? a + e.meso : a), 0);
}
function byDate() {
  const m = {};
  S.log.forEach(e => { m[e.date] = (m[e.date] || 0) + e.meso; });
  return m;
}

function toggleBoss(t, bossId) {
  const i = t.done.indexOf(bossId);
  if (i >= 0) { t.done.splice(i, 1); logRemove(t, bossId); }
  else { t.done.push(bossId); logAdd(t, bossId); }
  save();
}

/* ══════════════════════════════════════════════════════════
 * 넥슨 API
 *
 * 기본은 브라우저에서 넥슨으로 바로 호출합니다.
 * 넥슨이 CORS 를 막아두었다면 '중계 서버 주소' 를 넣어 우회합니다.
 * (저장소의 worker.js 를 Cloudflare Workers 에 올리면 그 주소가 나옵니다)
 * ══════════════════════════════════════════════════════════ */

const NEXON = 'https://open.api.nexon.com';

class ApiError extends Error {
  constructor(message, raw, cors) { super(message); this.raw = raw || ''; this.cors = !!cors; }
}

async function api(path) {
  const key = (S.key || '').trim();
  if (!key) throw new ApiError('API 키를 먼저 넣어 주세요.');
  const base = (S.proxy || '').trim().replace(/\/+$/, '');
  const url = (base || NEXON) + path;
  let res;
  try {
    res = await fetch(url, { headers: { 'x-nxopen-api-key': key } });
  } catch (e) {
    throw new ApiError(
      base
        ? '중계 서버에 닿지 못했습니다. 주소가 맞는지 확인해 주세요.'
        : '브라우저가 넥슨 직접 호출을 막았습니다. 더보기에서 중계 서버 주소를 넣어 주세요.',
      e.name + ': ' + e.message, !base);
  }
  const text = await res.text();
  if (!res.ok) throw new ApiError(friendly(res.status, text), text);
  try { return JSON.parse(text); } catch (e) { throw new ApiError('응답을 읽지 못했습니다.', text); }
}

function friendly(code, body) {
  let detail = '';
  try { detail = (JSON.parse(body).error || {}).message || ''; } catch (e) {}
  const head =
    code === 400 ? '요청이 올바르지 않습니다.' :
    code === 401 || code === 403 ? 'API 키가 유효하지 않습니다. 넥슨에서 키를 다시 확인해 주세요.' :
    code === 429 ? 'API 호출량을 초과했습니다. 잠시 뒤 다시 시도해 주세요.' :
    code >= 500 ? '넥슨 서버가 응답하지 않습니다. 점검 중일 수 있어요.' :
    '요청에 실패했습니다. (HTTP ' + code + ')';
  return detail ? head + '\n' + detail : head;
}

/** 응답 어디에 있든 character_name 을 가진 객체를 캐릭터로 봅니다 */
function collectCharacters(node, out) {
  if (Array.isArray(node)) { node.forEach(x => collectCharacters(x, out)); return; }
  if (node && typeof node === 'object') {
    const name = (node.character_name || '').trim();
    if (name) {
      out.push({
        name,
        ocid: (node.ocid || '').trim(),
        world: (node.world_name || '').trim(),
        job: (node.character_class || '').trim(),
        level: node.character_level || 0
      });
    }
    Object.values(node).forEach(v => collectCharacters(v, out));
  }
}

async function fetchCharacters() {
  const j = await api('/maplestory/v1/character/list');
  const out = [];
  collectCharacters(j, out);
  const seen = new Set();
  const list = out.filter(r => {
    const k = r.name + '@' + r.world;
    if (seen.has(k)) return false;
    seen.add(k); return true;
  }).sort((a, b) => b.level - a.level || a.name.localeCompare(b.name, 'ko'));
  if (!list.length) throw new ApiError('응답은 받았지만 캐릭터를 찾지 못했습니다.', JSON.stringify(j).slice(0, 800));
  return list;
}

async function fetchOcid(name) {
  const j = await api('/maplestory/v1/id?character_name=' + encodeURIComponent(name));
  return (j.ocid || '').trim();
}

const DIFF_KO = { easy: '이지', normal: '노멀', hard: '하드', chaos: '카오스', extreme: '익스트림' };
const flagOf = (v) => v === true || v === 'true' || v === '1' || v === 'Y' || v === 'y';

async function fetchScheduler(ocid) {
  const j = await api('/maplestory/v1/scheduler/character-state?ocid=' + encodeURIComponent(ocid));
  const rows = (j.boss_contents || []).map(b => ({
    name: (b.content_name || '').trim(),
    difficulty: DIFF_KO[(b.difficulty || '').toLowerCase()] || b.difficulty || '',
    cycle: b.cycle || '',
    registered: flagOf(b.registration_flag),
    completed: flagOf(b.complete_flag)
  }));
  return {
    world: j.world_name || '', job: j.character_class || '', level: j.character_level || 0,
    date: j.date || '', rows
  };
}

async function fetchPower(ocid) {
  try {
    const j = await api('/maplestory/v1/character/stat?ocid=' + encodeURIComponent(ocid));
    const row = (j.final_stat || []).find(x => (x.stat_name || '').includes('전투력'));
    if (!row) return 0;
    return parseInt(String(row.stat_value).replace(/,/g, ''), 10) || 0;
  } catch (e) { return 0; }
}

/**
 * 스케줄러 상태를 캐릭터에 반영합니다.
 *   난이도  : 잡은 게 있으면 그것, 없으면 등록한 것 (같은 게 여럿이면 높은 쪽)
 *   이름    : 공백 무시하고 비교
 *   주기    : 일일 보스만 빼고 다 받음
 *   체크    : 더하기만 — 손으로 켠 체크를 동기화가 끄지 않습니다
 */
function applyScheduler(t, st) {
  const k = (s) => (s || '').replace(/\s/g, '');
  const byName = {};
  st.rows.filter(r => !r.cycle.toLowerCase().includes('daily'))
    .forEach(r => { (byName[k(r.name)] = byName[k(r.name)] || []).push(r); });

  const bosses = {}, done = new Set();
  for (const boss of BOSSES) {
    const rows = byName[k(boss.name)];
    if (!rows) continue;
    const rank = (r) => boss.tiers.findIndex(x => k(x.name) === k(r.difficulty));
    const best = (arr) => arr.reduce((a, b) => (rank(b) > rank(a) ? b : a), arr[0]);
    const cl = rows.filter(r => r.completed);
    const rg = rows.filter(r => r.registered);
    const chosen = cl.length ? best(cl) : (rg.length ? best(rg) : null);
    if (!chosen) continue;
    const tier = (boss.tiers.find(x => k(x.name) === k(chosen.difficulty)) || {}).name
      || t.bosses[boss.id] || boss.tiers[0].name;
    bosses[boss.id] = tier;
    if (cl.length) done.add(boss.id);
  }

  // 손으로 넣은 보스와 체크는 동기화가 빼지 않습니다
  const merged = Object.assign({}, bosses);
  for (const [id, tier] of Object.entries(t.bosses)) if (!(id in merged)) merged[id] = tier;
  t.done.filter(id => id in merged).forEach(id => done.add(id));

  t.bosses = merged;
  t.done = [...done];
  t.world = st.world || t.world;
  t.job = st.job || t.job;
  if (st.level > 0) t.level = st.level;
  t.syncedAt = Date.now();
}

/** 전체 동기화. 화면에 진행 상황을 알려주는 onStep 을 받습니다. */
async function syncAll(onStep) {
  const out = { ok: 0, failed: [], thin: [], cleared: 0, apiDate: '' };
  for (let i = 0; i < S.toons.length; i++) {
    const t = S.toons[i];
    onStep && onStep('동기화 중… (' + (i + 1) + '/' + S.toons.length + ') ' + t.name);
    try {
      let ocid = t.ocid || await fetchOcid(t.name);
      let st = await fetchScheduler(ocid);

      // 보스 줄이 거의 안 오면 저장해 둔 ocid 가 낡았을 수 있습니다 (다른 키로 받은 값)
      if (st.rows.length < 5 && t.ocid) {
        const fresh = await fetchOcid(t.name);
        if (fresh && fresh !== ocid) { ocid = fresh; st = await fetchScheduler(ocid); }
      }
      t.ocid = ocid;
      if (!out.apiDate) out.apiDate = st.date;

      const now = Date.now();
      if (!t.power || now - (t.powerAt || 0) > 86400000) {
        const p = await fetchPower(ocid);
        if (p > 0) { t.power = p; t.powerAt = now; }
      }

      // 넥슨이 스케줄러를 안 내려준 경우 — 기존 목록과 체크를 건드리지 않습니다
      if (st.rows.length < 5) { out.thin.push(t.name); continue; }

      const beforeDone = new Set(t.done);
      applyScheduler(t, st);
      t.done.forEach(id => {
        if (!beforeDone.has(id)) {
          out.cleared++;
          const dup = S.log.some(e => e.date === todayKey() && e.toonId === t.id && e.bossId === id);
          if (!dup) logAdd(t, id);
        }
      });
      out.ok++;
    } catch (e) {
      out.failed.push(t.name);
      if (e instanceof ApiError && e.cors) { out.cors = true; break; }
    }
  }
  if (out.apiDate) S.lastApiDate = out.apiDate;
  save();
  return out;
}

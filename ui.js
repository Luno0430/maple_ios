/* 화면 그리기 — 순수 DOM. 프레임워크 없음 */

'use strict';

const app = document.getElementById('app');
let TAB = 'today';         // today | history | more
let PAGE = null;           // null | 'import' | 'prices' | 'settings' | {picker: toonId}
let SEL = -1;              // 펼친 캐릭터 (-1 = 접힘)
let CAL = null;            // 달력에서 보는 달 (Date, 1일)
let DAY = null;            // 달력에서 고른 날
let BUSY = '';             // 동기화 진행 문구
let TOAST = '';
let PAGERX = 0;          // 넘겨 둔 카드 위치
let SECRET = 0;          // 숨은 화면을 여는 연속 터치 수

const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = (a, b) => (b <= 0 ? 0 : Math.round((a / b) * 100));

function toast(msg) {
  TOAST = msg;
  render();
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { TOAST = ''; render(); }, 4000);
}

/* ── 공통 조각 ───────────────────────────────────────────── */

const card = (inner, cls = '') => `<div class="card ${cls}">${inner}</div>`;

function bar(done, total) {
  const p = pct(done, total);
  return `<div class="bar"><i style="width:${p}%"></i></div>`;
}

function tierChip(tier) {
  return `<span class="tier t-${tierClass(tier)}">${esc(tier)}</span>`;
}
const tierClass = (t) => ({ '이지': 'easy', '노멀': 'normal', '하드': 'hard', '카오스': 'chaos', '익스트림': 'ex' }[t] || 'muted');

/* ══════════════════════════════════════════════════════════
 * 오늘
 * ══════════════════════════════════════════════════════════ */

function viewToday() {
  const T = totals(S.toons);
  const rep = guildRep();

  const head = `
    <div class="head">
      <div>
        <div class="title">🍁 주간 메이플</div>
        <div class="sub">${S.lastApiDate ? '게임 데이터 기준 ' + esc(apiDateLabel(S.lastApiDate)) : '넥슨 스케줄러와 맞춥니다'}</div>
      </div>
      <button class="ghost sm" data-act="sync">${BUSY ? '…' : '새로고침'}</button>
    </div>`;

  if (!S.toons.length) {
    return head + card(`
      <div class="empty">
        <div>아직 캐릭터가 없습니다.</div>
        <button data-act="page" data-page="import">캐릭터 불러오기</button>
      </div>`);
  }

  const pager = `
    <div class="pager">
      <div class="page">${summaryCard(T)}</div>
      <div class="page">${shareCard()}</div>
    </div>
    <div class="dots"><b></b><b></b></div>`;

  const rail = `<div class="rail">` + S.toons.map((t, i) => {
    const s = stat(t);
    const on = i === SEL;
    return `<button class="chip ${on ? 'on' : ''}" data-act="sel" data-i="${i}">
      <span class="nm">${esc(t.name)}</span>
      <span class="ct">${s.wDone}/${s.wTotal}</span>
    </button>`;
  }).join('') + `</div>`;

  let body;
  if (SEL < 0 || SEL >= S.toons.length) {
    body = card(`<div class="folded">캐릭터를 누르면 보스 목록이 열립니다.</div>`);
  } else {
    body = toonCard(S.toons[SEL], rep);
  }

  return head + pager + rail + body;
}

function summaryCard(T) {
  const wLeft = Math.max(0, T.wTarget - T.wEarned);
  return `
    <div class="card pad">
      <div class="row">
        <div class="cap">이번 주 수익</div>
        <div class="cd">목요일 초기화까지 <span id="cdWeek">${countdown(nextWeekly())}</span></div>
      </div>
      <div class="big gold">${meso(T.wEarned)}</div>
      <div class="cap2">목표 ${meso(T.wTarget)} · 남은 ${meso(wLeft)}</div>
      ${bar(T.wEarned, T.wTarget)}
      <div class="row mt">
        <div class="cap">주간보스 ${T.wDone}/${T.wTotal}</div>
        <div class="cap">${pct(T.wEarned, T.wTarget)}%</div>
      </div>
      <div class="hr"></div>
      <div class="row">
        <div class="cap">월간 · 검은 마법사 ${T.mDone}/${T.mTotal}</div>
        <div class="cap gold">${meso(T.mEarned)} / ${meso(T.mTarget)}</div>
      </div>
      <div class="cap3">다음 달 1일까지 <span id="cdMonth">${countdown(nextMonthly())}</span></div>
    </div>`;
}

const SERIES = ['#3987E5', '#D95926', '#199E70', '#C98500', '#D55181', '#008300', '#9085E9', '#E66767'];

function shareCard() {
  const rows = S.toons.map((t, i) => {
    const s = stat(t);
    return { name: t.name, earned: s.earned, target: s.target, color: SERIES[i % SERIES.length] };
  });
  const sum = rows.reduce((a, r) => a + r.target, 0);
  if (sum <= 0) {
    return `<div class="card pad"><div class="cap">캐릭터 비중</div>
      <div class="folded">보스를 넣으면 비중이 보입니다.</div></div>`;
  }
  const stack = rows.map(r => `
    <span class="seg" style="flex:${r.target};background:${r.color}44">
      <i style="height:${pct(r.earned, r.target)}%;background:${r.color}"></i>
    </span>`).join('');

  const list = [...rows].sort((a, b) => b.target - a.target).map(r => `
    <div class="srow">
      <span class="dot" style="background:${r.color}"></span>
      <span class="nm">${esc(r.name)}</span>
      <span class="pc">${pct(r.target, sum)}%</span>
      <span class="mz">${meso(r.earned)}</span>
    </div>`).join('');

  return `
    <div class="card pad">
      <div class="row"><div class="cap">캐릭터 비중</div><div class="cap">진한 부분이 잡은 것</div></div>
      <div class="stack">${stack}</div>
      <div class="slist">${list}</div>
    </div>`;
}

function toonCard(t, rep) {
  const s = stat(t);
  const weekly = WEEKLY.map(w => w[0]).filter(id => id in t.bosses);
  const monthly = MONTHLY.map(w => w[0]).filter(id => id in t.bosses);
  const count = Object.keys(t.bosses).filter(id => BY_ID[id] && !BY_ID[id].monthly).length;

  const meta = [t.world, t.job, t.level ? 'Lv.' + t.level : '', powerText(t.power)]
    .filter(Boolean).join(' · ');

  const rows = (ids) => ids.map(id => bossRow(t, BY_ID[id])).join('');

  let inner = `
    <div class="thead">
      <div class="grow" data-act="fold">
        <div class="tname">${esc(t.name)} <span class="caret">▴</span></div>
        <div class="cap3">${esc(meta)}</div>
      </div>
      <span class="pill ${count > CAP_CHARACTER ? 'warn' : ''}">${count}/${CAP_CHARACTER}</span>
      <button class="link" data-act="page" data-page="picker" data-id="${esc(t.id)}">보스 선택</button>
    </div>`;

  if (!weekly.length && !monthly.length) {
    inner += `<div class="empty">
      <div>아직 도는 보스가 없어요.</div>
      <button data-act="page" data-page="picker" data-id="${esc(t.id)}">보스 선택하기</button>
    </div>`;
  } else {
    if (weekly.length) inner += subhead('주간보스', s.wDone + ' / ' + s.wTotal) + rows(weekly);
    if (monthly.length) inner += subhead('월간', '매월 1일 초기화') + rows(monthly);
  }

  if (rep && rep.id === t.id) {
    inner += subhead('길드 · 계정당 1회', (t.power > 0 ? '전투력 1위 · ' : '') + '목요일 초기화');
    inner += guildRow('플래그 레이스', S.guildFlag, 'flag');
    inner += guildRow('샤레니안의 지하 수로', S.guildWater, 'water');
  }
  return `<div class="card">${inner}</div>`;
}

const subhead = (l, r) => `<div class="subhead"><span>${esc(l)}</span><span>${esc(r)}</span></div>`;

function bossRow(t, boss) {
  const tier = t.bosses[boss.id];
  const party = partyOf(t, boss.id);
  const on = t.done.includes(boss.id);
  const price = sharePrice(priceOf(boss.id, tier), party);
  return `
    <div class="brow ${on ? 'on' : ''}">
      <i class="railmark"></i>
      <button class="btap" data-act="toggle" data-id="${esc(boss.id)}">
        <span class="check ${on ? 'on' : ''}"></span>
        <span class="bname ${on ? 'struck' : ''}"><em>${esc(boss.name)}</em></span>
        ${tierChip(tier)}
      </button>
      <button class="party ${party > 1 ? 'on' : ''}" data-act="party" data-id="${esc(boss.id)}">${party > 1 ? party + '인' : '솔로'}</button>
      <span class="mz ${on ? 'gold' : ''}">${esc(priceText(price))}</span>
    </div>`;
}

function guildRow(label, on, which) {
  return `
    <div class="brow ${on ? 'on' : ''}">
      <i class="railmark"></i>
      <button class="btap" data-act="guild" data-which="${which}">
        <span class="check ${on ? 'on' : ''}"></span>
        <span class="bname ${on ? 'struck' : ''}"><em>${esc(label)}</em></span>
      </button>
    </div>`;
}

function apiDateLabel(raw) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(raw || '');
  return m ? (+m[2]) + '/' + (+m[3]) + ' ' + m[4] + ':' + m[5] : raw;
}

/* ══════════════════════════════════════════════════════════
 * 기록
 * ══════════════════════════════════════════════════════════ */

function viewHistory() {
  const now = kstNow();
  if (!CAL) CAL = new Date(now.getFullYear(), now.getMonth(), 1);
  const totalsByDate = byDate();

  const first = new Date(CAL.getFullYear(), CAL.getMonth(), 1);
  const days = new Date(CAL.getFullYear(), CAL.getMonth() + 1, 0).getDate();
  const lead = first.getDay();

  let cells = '';
  for (let i = 0; i < lead; i++) cells += `<div class="cell blank"></div>`;
  for (let d = 1; d <= days; d++) {
    const key = dateKey(new Date(CAL.getFullYear(), CAL.getMonth(), d));
    const v = totalsByDate[key] || 0;
    const isToday = key === todayKey();
    const on = key === DAY;
    cells += `<button class="cell ${v > 0 ? 'has' : ''} ${isToday ? 'today' : ''} ${on ? 'pick' : ''}"
        data-act="day" data-key="${key}">
        <b>${d}</b>${v > 0 ? `<i>${meso(v)}</i>` : ''}
      </button>`;
  }

  const monthSum = Object.entries(totalsByDate)
    .filter(([k]) => k.startsWith(CAL.getFullYear() + '-' + pad2(CAL.getMonth() + 1)))
    .reduce((a, [, v]) => a + v, 0);

  const detail = DAY ? dayDetail(DAY) : '';

  return `
    <div class="head"><div><div class="title">기록</div>
      <div class="sub">체크한 날짜에 자동으로 쌓입니다</div></div></div>
    ${card(`
      <div class="calhead">
        <button class="ghost sm" data-act="mon" data-d="-1">‹</button>
        <div>
          <div class="calm">${CAL.getFullYear()}년 ${CAL.getMonth() + 1}월</div>
          <div class="cap3 center">${meso(monthSum)}</div>
        </div>
        <button class="ghost sm" data-act="mon" data-d="1">›</button>
      </div>
      <div class="dow">${['일', '월', '화', '수', '목', '금', '토'].map(d => `<span>${d}</span>`).join('')}</div>
      <div class="grid">${cells}</div>`)}
    ${detail}
    ${weekCompare()}`;
}

function dayDetail(key) {
  const rows = S.log.filter(e => e.date === key);
  const sum = rows.reduce((a, e) => a + e.meso, 0);
  const d = parseKey(key);
  const title = (d ? (d.getMonth() + 1) + '월 ' + d.getDate() + '일' : key);
  if (!rows.length) {
    return card(`<div class="pad"><div class="cap">${title}</div>
      <div class="folded">이 날은 기록이 없습니다.</div></div>`);
  }
  const list = rows.map(e => `
    <div class="lrow">
      <span class="nm">${esc(e.toonName)}</span>
      <span class="bn">${esc((BY_ID[e.bossId] || {}).name || e.bossId)}</span>
      ${tierChip(e.tier)}
      <span class="mz gold">${meso(e.meso)}</span>
    </div>`).join('');
  return card(`<div class="pad"><div class="row"><div class="cap">${title}</div>
    <div class="cap gold">${meso(sum)}</div></div></div>${list}`);
}

function weekCompare() {
  const thisWeek = weekStart(kstNow());
  const k0 = dateKey(thisWeek);
  const k1 = dateKey(addDays(thisWeek, -7));
  const k2 = dateKey(addDays(thisWeek, -14));
  const now = sumBetween(k0, dateKey(addDays(thisWeek, 7)));
  const prev = sumBetween(k1, k0);
  const before = sumBetween(k2, k1);
  const diff = now - prev;
  const line = prev <= 0 ? '지난주 기록이 없어 비교는 다음 주부터'
    : diff > 0 ? '지난주보다 ' + meso(diff) + ' 더 벌었어요'
    : diff < 0 ? '지난주보다 ' + meso(-diff) + ' 덜 벌었어요'
    : '지난주와 똑같아요';
  const max = Math.max(now, prev, before, 1);
  const b = (v, c) => `<div class="cbar"><i style="width:${Math.round(v / max * 100)}%;background:${c}"></i></div>`;
  return card(`<div class="pad">
    <div class="cap">주 단위 비교</div>
    <div class="cmp"><span>이번 주</span>${b(now, 'var(--accent)')}<em>${meso(now)}</em></div>
    <div class="cmp"><span>지난주</span>${b(prev, 'var(--muted)')}<em>${meso(prev)}</em></div>
    <div class="cmp"><span>2주 전</span>${b(before, 'var(--line)')}<em>${meso(before)}</em></div>
    <div class="cap3">${esc(line)}</div>
  </div>`);
}

/* ══════════════════════════════════════════════════════════
 * 더보기
 * ══════════════════════════════════════════════════════════ */

function viewMore() {
  return `
    <div class="head"><div><div class="title">더보기</div></div></div>
    ${card(`
      ${menu('캐릭터 불러오기', '넥슨 API 키로 계정의 캐릭터 조회', 'import')}
      <div class="hrline"></div>
      ${menu('결정석 가격 수정', '패치로 시세가 바뀌면 여기서', 'prices')}
      ${S.proxy ? '<div class="hrline"></div>' + menu('연결 설정', '중계 서버 사용 중', 'settings') : ''}
    `)}
    ${card(`
      <button class="opt" data-act="autosync">
        <span class="check ${S.autoSync ? 'on' : ''}"></span>
        <span class="grow">
          <b>돌아올 때마다 자동 동기화</b>
          <i>게임에서 캐시샵을 찍고 이 화면을 열면 바로 반영됩니다</i>
        </span>
      </button>`)}
    ${card(`<div class="pad">
      <div class="cap">홈 화면에 추가하기</div>
      <div class="note">사파리 아래쪽 <b>공유 버튼</b> → <b>홈 화면에 추가</b> 를 누르면
      아이콘이 생기고 주소창 없이 앱처럼 열립니다.</div>
    </div>`)}
    <div class="note pad" data-act="secret">
      결정석 가격은 2026년 7월 1일 기준입니다. 파티로 잡으면 인원수만큼 나뉘고 소수점은 버립니다.<br>
      주간보스와 플래그·수로는 매주 목요일 0시, 검은 마법사는 매월 1일에 초기화됩니다.<br>
      키와 기록은 이 브라우저에만 저장되며 넥슨 외에는 어디로도 보내지 않습니다.
    </div>`;
}

const menu = (title, sub, page) => `
  <button class="menu" data-act="page" data-page="${page}">
    <span class="grow"><b>${esc(title)}</b><i>${esc(sub)}</i></span>
    <span class="chev">›</span>
  </button>`;

/* ══════════════════════════════════════════════════════════
 * 하위 화면
 * ══════════════════════════════════════════════════════════ */

let IMPORT = { found: [], picked: new Set(), busy: false, error: '' };

function viewImport() {
  const existing = new Set(S.toons.map(t => t.name));
  const keyIsTest = (S.key || '').trim().startsWith('test_');

  let list = '';
  if (IMPORT.found.length) {
    const selectable = IMPORT.found.filter(r => !existing.has(r.name)).map(r => r.name);
    const allOn = selectable.length > 0 && selectable.every(n => IMPORT.picked.has(n));
    list = `
      <div class="row pad0">
        <div class="cap">불러온 캐릭터 ${IMPORT.found.length}명</div>
        <button class="link" data-act="allpick">${allOn ? '전체 해제' : '전체 선택'}</button>
      </div>
      <button class="wide ${IMPORT.picked.size ? '' : 'off'}" data-act="add">
        ${IMPORT.picked.size ? '선택한 ' + IMPORT.picked.size + '명 추가' : '추가할 캐릭터를 골라 주세요'}
      </button>
      ${card(IMPORT.found.map(r => {
        const already = existing.has(r.name);
        const on = IMPORT.picked.has(r.name);
        return `<div class="irow">
          <button class="btap grow" data-act="pick" data-name="${esc(r.name)}" ${already ? 'disabled' : ''}>
            <span class="check ${on && !already ? 'on' : ''}"></span>
            <span class="grow left">
              <b class="${already ? 'dim' : ''}">${esc(r.name)}</b>
              <i>${esc([r.world, r.job, r.level ? 'Lv.' + r.level : ''].filter(Boolean).join(' · '))}</i>
            </span>
          </button>
          ${already ? `<button class="danger sm" data-act="drop" data-name="${esc(r.name)}">빼기</button>` : ''}
        </div>`;
      }).join(''))}`;
  }

  return `
    ${topbar('캐릭터 불러오기')}
    ${card(`<div class="pad">
      <div class="cap">넥슨 오픈 API 키</div>
      <div class="note">캐릭터 목록은 계정 본인만 볼 수 있어서, 쓰는 사람마다 자기 키가 하나 있어야 합니다.
        처음 한 번만 하면 됩니다.</div>
      <ol class="steps">
        <li>아래 <b>넥슨에서 키 받기</b> → 게임할 때 쓰는 넥슨 계정으로 로그인</li>
        <li>내 애플리케이션 → 애플리케이션 등록하기</li>
        <li>게임은 꼭 <b>메이플스토리</b>, 타입은 <b>서비스 단계</b></li>
        <li>이름·소개·주소는 아무거나 적어도 됩니다</li>
        <li>나온 API Key 를 복사해서 아래에 붙여넣기</li>
      </ol>
      <a class="wide" href="https://openapi.nexon.com/ko/my-application/" target="_blank" rel="noopener">넥슨에서 키 받기</a>
      <input id="apikey" type="text" inputmode="latin" autocapitalize="off" autocorrect="off"
             spellcheck="false" placeholder="live_ 로 시작" value="${esc(S.key || '')}">
      <div class="row mt">
        <button class="ghost sm" data-act="paste">붙여넣기</button>
        <span class="cap3">${S.key ? S.key.length + '자' : ''}</span>
      </div>
      ${keyIsTest ? `<div class="warn-note">개발 단계(test) 키입니다. 캐릭터가 일부만 조회되는 일이 있으니
        넥슨에서 ‘서비스 단계’ 로 하나 더 만들어 live 키를 쓰는 걸 권합니다.</div>` : ''}
      <button class="wide mt" data-act="fetch">${IMPORT.busy ? '불러오는 중…' : '캐릭터 불러오기'}</button>
      <div class="note mt">키는 이 폰 안에만 저장되고, 넥슨 외에는 아무 데도 보내지 않습니다.
        다른 사람에게 주지 마세요.</div>
    </div>`)}
    ${IMPORT.error ? `<div class="err">${esc(IMPORT.error)}</div>` : ''}
    ${list}`;
}

function viewPicker(id) {
  const t = S.toons.find(x => x.id === id);
  if (!t) { PAGE = null; return viewToday(); }
  const count = Object.keys(t.bosses).filter(k => BY_ID[k] && !BY_ID[k].monthly).length;
  const rows = BOSSES.map(b => {
    const cur = t.bosses[b.id];
    const segs = b.tiers.map(tr => `
      <button class="seg2 ${cur === tr.name ? 'on t-' + tierClass(tr.name) : ''}"
        data-act="tier" data-id="${esc(b.id)}" data-tier="${esc(tr.name)}">
        <b>${esc(tr.name)}</b><i>${esc(priceText(tr.price))}</i>
      </button>`).join('');
    return `<div class="prow">
      <div class="row"><b>${esc(b.name)}</b>${b.monthly ? '<span class="pill">월간</span>' : ''}</div>
      <div class="segs">${segs}</div>
    </div>`;
  }).join('');

  return `
    ${topbar(t.name, `선택 ${count}/${CAP_CHARACTER}`, `<button class="danger sm" data-act="delchar" data-id="${esc(t.id)}">삭제</button>`)}
    <div class="note pad">난이도를 누르면 넣고, 같은 난이도를 다시 누르면 뺍니다.</div>
    ${card(rows)}`;
}

function viewPrices() {
  const rows = BOSSES.map(b => b.tiers.map(tr => {
    const k = priceKey(b.id, tr.name);
    const cur = priceOf(b.id, tr.name);
    const edited = S.prices[k] != null;
    return `<div class="prow2">
      <span class="grow"><b>${esc(b.name)}</b> ${tierChip(tr.name)}</span>
      <input class="num" type="number" inputmode="numeric" value="${cur || ''}"
             placeholder="0" data-act="price" data-key="${esc(k)}">
      <span class="cap3">${edited ? '수정됨' : '만'}</span>
    </div>`;
  }).join('')).join('');
  return `${topbar('결정석 가격 수정', '단위: 만 메소')}
    <div class="note pad">숫자를 고치면 바로 저장됩니다. 0 으로 두면 ‘가격 ?’ 로 표시하고 합계에서 뺍니다.</div>
    ${card(rows)}`;
}

function viewSettings() {
  return `${topbar('연결 설정')}
    ${card(`<div class="pad">
      <div class="cap">중계 서버 주소</div>
      <div class="note">지금은 넥슨이 브라우저 직접 호출을 허용하고 있어서 <b>비워두면 됩니다</b>.
        나중에 막히면 저장소의 <b>worker.js</b> 를 Cloudflare Workers 에 올리고,
        거기서 나온 주소를 여기에 넣으세요.</div>
      <input id="proxy" type="url" inputmode="url" autocapitalize="off" autocorrect="off"
             spellcheck="false" placeholder="https://내주소.workers.dev" value="${esc(S.proxy || '')}">
      <button class="wide mt" data-act="saveproxy">저장</button>
    </div>`)}
    ${card(`<div class="pad">
      <div class="cap">데이터</div>
      <div class="note">기록과 설정은 이 브라우저에만 있습니다. 사파리 방문 기록을 지우면 같이 사라집니다.</div>
      <button class="wide danger mt" data-act="wipe">전부 지우기</button>
    </div>`)}`;
}

const topbar = (title, sub, trailing) => `
  <div class="topbar">
    <button class="ghost sm" data-act="back">‹ 뒤로</button>
    <div class="grow center">
      <div class="tbt">${esc(title)}</div>
      ${sub ? `<div class="cap3">${esc(sub)}</div>` : ''}
    </div>
    ${trailing || '<span class="spacer"></span>'}
  </div>`;

/* ══════════════════════════════════════════════════════════
 * 렌더 · 이벤트
 * ══════════════════════════════════════════════════════════ */

function render() {
  let html;
  if (PAGE === 'import') html = viewImport();
  else if (PAGE === 'prices') html = viewPrices();
  else if (PAGE === 'settings') html = viewSettings();
  else if (PAGE && PAGE.picker) html = viewPicker(PAGE.picker);
  else if (TAB === 'today') html = viewToday();
  else if (TAB === 'history') html = viewHistory();
  else html = viewMore();

  const tabs = PAGE ? '' : `
    <nav class="tabs">
      ${tabBtn('today', '오늘', '체크')}
      ${tabBtn('history', '기록', '달력')}
      ${tabBtn('more', '더보기', '설정')}
    </nav>`;

  app.innerHTML =
    `<main class="${PAGE ? 'nopad' : ''}">${html}</main>` +
    (BUSY ? `<div class="busy">${esc(BUSY)}</div>` : '') +
    (TOAST ? `<div class="toast">${esc(TOAST)}</div>` : '') +
    tabs;

  const pg = app.querySelector('.pager');
  if (pg) {
    pg.scrollLeft = PAGERX;
    pg.addEventListener('scroll', () => {
      PAGERX = pg.scrollLeft;
      const i = pg.scrollLeft > pg.clientWidth / 2 ? 1 : 0;
      app.querySelectorAll('.dots b').forEach((d, j) => d.classList.toggle('on', i === j));
    }, { passive: true });
    const i = PAGERX > pg.clientWidth / 2 ? 1 : 0;
    app.querySelectorAll('.dots b').forEach((d, j) => d.classList.toggle('on', i === j));
  }
}

const tabBtn = (id, label, sub) => `
  <button class="tab ${TAB === id ? 'on' : ''}" data-act="tab" data-tab="${id}">
    <i></i><b>${label}</b><em>${sub}</em>
  </button>`;

app.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;

  switch (act) {
    case 'tab': TAB = el.dataset.tab; PAGE = null; render(); break;
    case 'back': PAGE = null; IMPORT.error = ''; render(); break;
    case 'page':
      PAGE = el.dataset.page === 'picker' ? { picker: el.dataset.id } : el.dataset.page;
      render();
      break;
    case 'sel': {
      const i = +el.dataset.i;
      SEL = (SEL === i) ? -1 : i;
      render();
      break;
    }
    case 'fold': SEL = -1; render(); break;
    case 'toggle': toggleBoss(S.toons[SEL], el.dataset.id); render(); break;
    case 'guild':
      if (el.dataset.which === 'flag') S.guildFlag = !S.guildFlag;
      else S.guildWater = !S.guildWater;
      save(); render();
      break;
    case 'party': askParty(S.toons[SEL], el.dataset.id); break;
    case 'sync': await doSync(); break;
    case 'autosync': S.autoSync = !S.autoSync; save(); render(); break;
    case 'mon': CAL = new Date(CAL.getFullYear(), CAL.getMonth() + (+el.dataset.d), 1); render(); break;
    case 'day': DAY = (DAY === el.dataset.key) ? null : el.dataset.key; render(); break;
    case 'paste': await pasteKey(); break;
    case 'fetch': await doFetch(); break;
    case 'pick': {
      const n = el.dataset.name;
      IMPORT.picked.has(n) ? IMPORT.picked.delete(n) : IMPORT.picked.add(n);
      render();
      break;
    }
    case 'allpick': {
      const existing = new Set(S.toons.map(t => t.name));
      const sel = IMPORT.found.filter(r => !existing.has(r.name)).map(r => r.name);
      IMPORT.picked = sel.every(n => IMPORT.picked.has(n)) ? new Set() : new Set(sel);
      render();
      break;
    }
    case 'add': addPicked(); break;
    case 'drop': {
      S.toons = S.toons.filter(t => t.name !== el.dataset.name);
      SEL = -1; save(); render();
      break;
    }
    case 'delchar':
      S.toons = S.toons.filter(t => t.id !== el.dataset.id);
      SEL = -1; PAGE = null; save(); render();
      break;
    case 'tier': setTier(el.dataset.id, el.dataset.tier); break;
    case 'saveproxy': {
      S.proxy = (document.getElementById('proxy').value || '').trim();
      save(); toast(S.proxy ? '중계 서버를 저장했습니다.' : '넥슨에 직접 호출합니다.');
      break;
    }
    case 'secret': {
      // 평소엔 쓸 일 없는 화면입니다. 넥슨이 브라우저 직접 호출을 막는 날에만 필요해서,
      // 안내 문구를 일곱 번 누르면 열리도록 숨겨 두었습니다.
      SECRET += 1;
      if (SECRET >= 7) { SECRET = 0; PAGE = 'settings'; render(); }
      break;
    }
    case 'wipe':
      if (confirm('캐릭터·기록·키를 전부 지웁니다. 되돌릴 수 없습니다.')) {
        try { localStorage.removeItem(STORE_KEY); } catch (e) {}
        S = blank(); SEL = -1; PAGE = null; render();
      }
      break;
  }
});

/* 키 입력은 실시간으로 붙잡아 둡니다 */
app.addEventListener('input', (ev) => {
  if (ev.target.id === 'apikey') { S.key = ev.target.value.trim(); save(); }
  if (ev.target.dataset && ev.target.dataset.act === 'price') {
    const v = parseInt(ev.target.value, 10);
    if (!v || v <= 0) delete S.prices[ev.target.dataset.key];
    else S.prices[ev.target.dataset.key] = v;
    save();
  }
});

function setTier(bossId, tier) {
  const t = S.toons.find(x => x.id === PAGE.picker);
  if (!t) return;
  if (t.bosses[bossId] === tier) {
    delete t.bosses[bossId];
    t.done = t.done.filter(id => id !== bossId);
  } else {
    t.bosses[bossId] = tier;
  }
  save(); render();
}

function askParty(t, bossId) {
  const boss = BY_ID[bossId];
  const cur = partyOf(t, bossId);
  const base = priceOf(bossId, t.bosses[bossId]);
  const opts = [];
  for (let n = 1; n <= boss.maxParty; n++) {
    opts.push(n + '. ' + (n === 1 ? '솔로' : n + '인') + ' — ' + priceText(sharePrice(base, n)));
  }
  const ans = prompt(boss.name + ' 파티 인원\n\n' + opts.join('\n'), String(cur));
  const n = parseInt(ans, 10);
  if (!n || n < 1 || n > boss.maxParty) return;
  if (n <= 1) delete t.party[bossId]; else t.party[bossId] = n;
  save(); render();
}

async function pasteKey() {
  try {
    const t = (await navigator.clipboard.readText()).trim();
    if (t) { S.key = t; save(); render(); }
  } catch (e) {
    toast('브라우저가 클립보드를 막았습니다. 직접 붙여넣어 주세요.');
  }
}

async function doFetch() {
  if (IMPORT.busy) return;
  IMPORT.busy = true; IMPORT.error = ''; render();
  try {
    IMPORT.found = await fetchCharacters();
    IMPORT.picked = new Set();
  } catch (e) {
    IMPORT.found = [];
    IMPORT.error = e.message + (e.raw ? '\n\n' + String(e.raw).slice(0, 400) : '');
  } finally {
    IMPORT.busy = false; render();
  }
}

function addPicked() {
  const existing = new Set(S.toons.map(t => t.name));
  const add = IMPORT.found.filter(r => IMPORT.picked.has(r.name) && !existing.has(r.name));
  if (!add.length) return;
  add.forEach(r => S.toons.push({
    id: r.name + '@' + r.world + '#' + Date.now() + Math.random().toString(16).slice(2, 6),
    name: r.name, ocid: r.ocid, world: r.world, job: r.job, level: r.level,
    power: 0, powerAt: 0, bosses: {}, done: [], party: {}, syncedAt: 0
  }));
  save();
  PAGE = null; TAB = 'today'; SEL = -1;
  render();
  doSync();
}

let lastSync = 0;
async function doSync(auto) {
  if (BUSY) return;
  if (!S.key || !S.toons.length) return;
  if (auto && Date.now() - lastSync < 60000) return;
  lastSync = Date.now();
  BUSY = '동기화 중…'; render();
  try {
    const r = await syncAll(msg => { BUSY = msg; render(); });
    const bits = [];
    if (r.ok) bits.push(r.ok + '명 확인');
    if (r.cleared) bits.push('클리어 +' + r.cleared);
    if (r.thin.length) bits.push('넥슨이 스케줄러를 안 주는 캐릭터 ' + r.thin.length + '명: ' + r.thin.join(', '));
    if (r.failed.length) bits.push('실패 ' + r.failed.join(', '));
    if (r.cors) bits.push('브라우저가 넥슨 직접 호출을 막았습니다 — 더보기 → 연결 설정');
    toast(bits.join(' · ') || '바뀐 것 없음');
  } catch (e) {
    toast(e.message || '동기화 실패');
  } finally {
    BUSY = ''; render();
  }
}

/* 화면으로 돌아올 때마다 한 번 (60초 제한) */
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  applyResets();
  render();
  if (S.autoSync) doSync(true);
});

/* 남은 시간은 글자만 갈아 끼웁니다. 통째로 다시 그리면 넘겨 둔 카드가 되돌아갑니다. */
setInterval(() => {
  const a = document.getElementById('cdWeek');
  if (a) a.textContent = countdown(nextWeekly());
  const b = document.getElementById('cdMonth');
  if (b) b.textContent = countdown(nextMonthly());
}, 1000);

/* 초기화 시각이 지났는지는 30초에 한 번만 봅니다 */
setInterval(() => { if (applyResets()) render(); }, 30000);

load();
render();
if (S.autoSync) doSync(true);

/*
 * 중계 서버 — 넥슨이 브라우저 직접 호출을 막을 때만 필요합니다.
 *
 * Cloudflare Workers 에 이 파일 하나만 올리면 됩니다. 무료 등급으로 충분합니다.
 *   1) dash.cloudflare.com → Workers & Pages → Create → Worker
 *   2) 편집기 내용을 이 파일로 통째로 바꾸고 Deploy
 *   3) 나온 주소(https://…workers.dev)를 앱의 더보기 → 연결 설정에 넣기
 *
 * 하는 일은 하나뿐입니다. 브라우저가 보낸 요청을 넥슨으로 그대로 넘기고,
 * 돌아온 응답에 "이 브라우저가 읽어도 된다"는 표시(CORS 헤더)를 붙여 돌려줍니다.
 * API 키는 지나가기만 하고 저장하지 않습니다.
 */

const NEXON = 'https://open.api.nexon.com';

// 메이플스토리 조회 경로만 통과시킵니다. 아무 주소나 대신 불러주는 서버가 되지 않도록.
const ALLOW = /^\/maplestory\/v1\//;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'x-nxopen-api-key,content-type',
  'Access-Control-Max-Age': '86400'
};

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }
    if (request.method !== 'GET') {
      return new Response('GET 만 됩니다.', { status: 405, headers: CORS });
    }

    const url = new URL(request.url);
    if (!ALLOW.test(url.pathname)) {
      return new Response('허용되지 않은 경로입니다.', { status: 403, headers: CORS });
    }

    const key = request.headers.get('x-nxopen-api-key');
    if (!key) {
      return new Response('API 키가 없습니다.', { status: 400, headers: CORS });
    }

    const target = NEXON + url.pathname + url.search;
    const res = await fetch(target, {
      headers: { 'x-nxopen-api-key': key, 'Accept': 'application/json' }
    });

    const headers = new Headers(CORS);
    headers.set('Content-Type', res.headers.get('Content-Type') || 'application/json');
    return new Response(res.body, { status: res.status, headers });
  }
};

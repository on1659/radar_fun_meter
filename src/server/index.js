'use strict';
const http = require('http');
const fs   = require('fs');
const path = require('path');

/**
 * FunMeterServer — 로컬 HTTP 서버 + SSE 스트리밍 + 히스토리 저장
 *
 * 엔드포인트:
 *   GET /         → dashboard.html
 *   GET /events   → SSE 스트림 (progress / result 이벤트)
 *   GET /history  → JSON 배열 (최근 maxHistory개)
 */
class FunMeterServer {
  /**
   * @param {object} options
   * @param {number}  [options.port=4567]
   * @param {string}  [options.historyDir='.funmeter-history']
   * @param {number}  [options.maxHistory=10]
   */
  constructor(options = {}) {
    this.port       = options.port       ?? 4567;
    this.historyDir = options.historyDir ?? '.funmeter-history';
    this.maxHistory = options.maxHistory ?? 10;

    this._server      = null;
    this._clients     = [];          // 활성 SSE 연결
    this._recentEvents = [];         // 버퍼: 신규 클라이언트에게 재전송용
    this._saveSeq     = 0;           // 파일명 순서 보장용 카운터
  }

  /** HTTP 서버 기동
   * @returns {Promise<{url: string, close: Function}>}
   */
  start() {
    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => this._handleRequest(req, res));
      server.once('error', reject);
      server.listen(this.port, '127.0.0.1', () => {
        const { port } = server.address();
        this._server = server;
        const url = `http://127.0.0.1:${port}`;
        resolve({ url, close: () => this.stop() });
      });
    });
  }

  /** 서버 종료 */
  stop() {
    if (this._server) {
      this._server.close();
      this._server = null;
    }
    // 열린 SSE 연결 종료
    for (const c of this._clients) {
      try { c.end(); } catch {}
    }
    this._clients = [];
  }

  /** SSE progress 이벤트 전송 */
  sendProgress(data) {
    this._broadcast('progress', data);
  }

  /** SSE result 이벤트 전송 */
  sendResult(data) {
    this._broadcast('result', data);
  }

  /**
   * 결과를 historyDir에 JSON으로 저장.
   * 저장 후 파일 수가 maxHistory 초과 시 가장 오래된 파일 삭제.
   * 실패해도 경고만 출력하고 계속 진행.
   */
  saveHistory(result) {
    try {
      if (!fs.existsSync(this.historyDir)) {
        fs.mkdirSync(this.historyDir, { recursive: true });
      }
      const ts  = new Date().toISOString().replace(/:/g, '-');
      const seq = String(this._saveSeq++).padStart(6, '0');
      const filename = `${ts}-${seq}.json`;
      const filepath = path.join(this.historyDir, filename);
      const entry = {
        savedAt: new Date().toISOString(),
        result,
      };
      fs.writeFileSync(filepath, JSON.stringify(entry, null, 2), 'utf8');

      // maxHistory 초과 시 가장 오래된 파일(알파벳 오름차순 = 생성 순) 삭제
      const files = fs.readdirSync(this.historyDir)
        .filter(f => f.endsWith('.json'))
        .sort(); // ISO timestamp prefix → 생성 순 정렬
      if (files.length > this.maxHistory) {
        const toDelete = files.slice(0, files.length - this.maxHistory);
        for (const f of toDelete) {
          try { fs.unlinkSync(path.join(this.historyDir, f)); } catch {}
        }
      }
    } catch (err) {
      console.warn(`[FunMeterServer] 히스토리 저장 실패: ${err.message}`);
    }
  }

  /**
   * historyDir에서 최근 maxHistory개 항목을 최신순으로 반환.
   * 파싱 실패 항목은 스킵.
   * @returns {Array<{savedAt: string, result: object}>}
   */
  getHistory() {
    try {
      if (!fs.existsSync(this.historyDir)) return [];
      const files = fs.readdirSync(this.historyDir)
        .filter(f => f.endsWith('.json'))
        .sort()         // 오름차순 = 오래된 것부터
        .reverse()      // 최신 순
        .slice(0, this.maxHistory);

      const result = [];
      for (const f of files) {
        try {
          const raw = fs.readFileSync(path.join(this.historyDir, f), 'utf8');
          result.push(JSON.parse(raw));
        } catch {} // 파싱 실패 스킵
      }
      return result;
    } catch {
      return [];
    }
  }

  // ─── 내부 ─────────────────────────────────────────────

  _broadcast(eventType, data) {
    const msg = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
    this._recentEvents.push(msg);
    if (this._recentEvents.length > 200) this._recentEvents.shift();
    const dead = [];
    for (const c of this._clients) {
      try {
        c.write(msg);
      } catch {
        dead.push(c);
      }
    }
    if (dead.length) {
      this._clients = this._clients.filter(c => !dead.includes(c));
    }
  }

  _handleRequest(req, res) {
    if (req.method !== 'GET') {
      res.writeHead(405).end();
      return;
    }

    if (req.url === '/') {
      const htmlPath = path.join(__dirname, 'dashboard.html');
      try {
        const html = fs.readFileSync(htmlPath, 'utf8');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
      } catch {
        res.writeHead(500).end('dashboard.html not found');
      }
      return;
    }

    if (req.url === '/events') {
      res.writeHead(200, {
        'Content-Type':  'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection':    'keep-alive',
      });
      // 버퍼된 이벤트를 신규 클라이언트에게 재전송
      for (const evt of this._recentEvents) {
        try { res.write(evt); } catch {}
      }
      this._clients.push(res);
      req.on('close', () => {
        this._clients = this._clients.filter(c => c !== res);
      });
      return;
    }

    if (req.url === '/history') {
      const data = this.getHistory();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(data));
      return;
    }

    res.writeHead(404).end('Not Found');
  }
}

module.exports = { FunMeterServer };

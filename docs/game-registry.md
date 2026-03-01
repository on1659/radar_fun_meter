# radar_fun_meter 외부 게임 패키지 규약

외부 npm 패키지를 `--game=@scope/radar-game-<name>` 형태로 즉시 실행할 수 있습니다.

---

## 필수 조건

1. `package.json`에 `"radar-game": true` 필드 포함
2. `main` 필드가 `GameAdapter` 서브클래스를 default export

---

## 최소 구현 예시

```js
// index.js (main 필드)
const { GameAdapter } = require('radar_fun_meter');

class MyGame extends GameAdapter {
  constructor(config = {}) {
    super();
    this.speed = config.speed ?? 100;
    this._alive = true;
    this._score = 0;
    this._tick = 0;
  }

  getName() { return 'my-game'; }
  getLevel() { return 1; }

  reset() {
    this._alive = true;
    this._score = 0;
    this._tick = 0;
  }

  update(action) {
    this._tick++;
    if (action === 1 && Math.random() < 0.1) this._alive = false;
    this._score = this._tick;
  }

  getScore() { return this._score; }
  isAlive() { return this._alive; }
  getDifficulty() { return this.speed; }
}

module.exports = MyGame;
```

---

## peerDependencies 설정

```json
{
  "name": "@yourscope/radar-game-mygame",
  "version": "1.0.0",
  "main": "index.js",
  "radar-game": true,
  "peerDependencies": {
    "radar_fun_meter": ">=2.2.0"
  }
}
```

---

## 디렉터리 구조 예시

```
radar-game-mygame/
  index.js          ← GameAdapter 서브클래스 (main)
  package.json      ← "radar-game": true 포함
  README.md
```

---

## CLI 사용 예시

```bash
# 패키지 설치
npm install @yourscope/radar-game-mygame

# 실행 (확인 프롬프트 표시)
funmeter --game=@yourscope/radar-game-mygame --runs=100

# --yes 플래그로 프롬프트 스킵
funmeter --game=@yourscope/radar-game-mygame --runs=100 --yes

# 최적화
funmeter --game=@yourscope/radar-game-mygame --optimize --opt.param=speed --opt.min=50 --opt.max=300 --yes
```

---

## Breaking Change 정책

`GameAdapter` 인터페이스의 Breaking Change는 반드시 `radar_fun_meter` major 버전 증가와 함께 이루어집니다.
외부 패키지는 `peerDependencies`에 호환 범위를 명시하세요.

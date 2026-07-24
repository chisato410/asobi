// localStorage: ブラウザに保存される簡易データ倉庫。タブを閉じても・再起動しても
// 同じ端末なら値が残る(シークレットモードや別端末には引き継がれない)。
const STORAGE_KEY = "pinpon-dash:best-streak";

// 連続成功回数(ストリーク)に応じた称号。しきい値が高い方から順にチェックする。
const TITLES = [
  { threshold: 0, label: "新米ダッシュ屋" },
  { threshold: 3, label: "忍び足" },
  { threshold: 6, label: "逃げ足自慢" },
  { threshold: 10, label: "影の逃亡者" },
  { threshold: 15, label: "伝説のダッシュ屋" },
];

// 成功するたびにランダムで出す一言。
const SUCCESS_LINES = [
  "きれいに鳴らして離脱。",
  "誰も気づいていない。",
  "スリル満点。",
  "足音を消して撤収。",
  "完璧なタイミング。",
];

// 捕まったときの結果画面に出す見出し。
const CAUGHT_LINES = [
  "げっ、見つかった。",
  "気配でバレた。",
  "走る前に捕まった。",
  "タイミング、ズレてた。",
  "御用だ。",
];

const elements = {
  streakValue: document.querySelector("#streakValue"),
  titleBadge: document.querySelector("#titleBadge"),
  bestLabel: document.querySelector("#bestLabel"),
  timingTrack: document.querySelector("#timingTrack"),
  safeZone: document.querySelector("#safeZone"),
  marker: document.querySelector("#marker"),
  feedbackLine: document.querySelector("#feedbackLine"),
  idlePanel: document.querySelector("#idlePanel"),
  startButton: document.querySelector("#startButton"),
  runningPanel: document.querySelector("#runningPanel"),
  pingButton: document.querySelector("#pingButton"),
  resultPanel: document.querySelector("#resultPanel"),
  resultKicker: document.querySelector("#resultKicker"),
  resultStreak: document.querySelector("#resultStreak"),
  resultDetail: document.querySelector("#resultDetail"),
  resultShareButton: document.querySelector("#resultShareButton"),
  retryButton: document.querySelector("#retryButton"),
};

// "idle"(スタート待ち) → "running"(ゲージが動いている) → "gameover"(捕まった) の3状態。
let gameState = "idle";

// 今回の連続成功回数。押すのに成功するたびに+1され、外した瞬間にリセットされる。
let currentStreak = 0;

// 自己ベスト(過去最高の連続成功回数)。localStorageから読み込む。
let bestStreak = loadBestStreak();

// requestAnimationFrame が返すID。cancelAnimationFrame(id) で描画ループを止めるために使う。
let animationFrameId = null;

// ゲージが1往復(0%→100%→0%)するのにかかる時間(ミリ秒)。連続成功するほど短くなる。
let periodMs = 1700;

// 今のセーフゾーン。startとwidthはどちらも0〜100のパーセント値。
let currentZone = { start: 40, width: 20 };

// 今のスウィング(往復)が始まった時刻。ここからの経過時間でゲージの位置を計算する。
let phaseStartedAt = 0;

function loadBestStreak() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  } catch {
    // プライベートブラウジングなどでlocalStorageが使えない場合はここに来る。
    return 0;
  }
}

function saveBestStreak(value) {
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    // 保存できなくてもゲーム自体は続けられるので何もしない。
  }
}

function currentTitle(streak) {
  for (let i = TITLES.length - 1; i >= 0; i -= 1) {
    if (streak >= TITLES[i].threshold) return TITLES[i];
  }
  return TITLES[0];
}

function updateBestLabel() {
  elements.bestLabel.textContent = `自己ベスト ${bestStreak.toLocaleString("ja-JP")}回`;
}

function updateStreakDisplay() {
  elements.streakValue.textContent = currentStreak.toLocaleString("ja-JP");

  const title = currentTitle(currentStreak);
  if (elements.titleBadge.textContent !== title.label) {
    elements.titleBadge.textContent = title.label;
    elements.titleBadge.classList.remove("is-changed");
    // 一度クラスを外して付け直すと、同じアニメーションを毎回再生できる。
    void elements.titleBadge.offsetWidth; // 強制的にレイアウトを再計算させる(リフロー)
    elements.titleBadge.classList.add("is-changed");
  }
}

function updateFeedback(pool) {
  const message = pool[Math.floor(Math.random() * pool.length)];
  elements.feedbackLine.textContent = message;
  return message;
}

// 連続成功回数から、今回の難易度(ゲージの速さ・セーフゾーンの広さ)を計算する。
function getPeriodMs(streak) {
  return Math.max(500, 1700 - streak * 70);
}

function getZoneWidthPercent(streak) {
  return Math.max(6, 24 - streak * 1.1);
}

// セーフゾーンをランダムな位置に置き直す。widthはパーセント。
function randomizeZone(width) {
  const maxStart = 100 - width;
  const start = Math.random() * maxStart;
  return { start, width };
}

function applyZoneToDom() {
  elements.safeZone.style.left = `${currentZone.start}%`;
  elements.safeZone.style.width = `${currentZone.width}%`;
}

// 今この瞬間の、ゲージの位置(0〜100のパーセント)を計算する。
// 0%→100%→0%と三角波(のこぎりではなく山型)で往復させている。
function getMarkerPercent(now) {
  const elapsed = now - phaseStartedAt;
  const t = (elapsed % periodMs) / periodMs; // 0〜1でループする経過割合
  const progress = t < 0.5 ? t * 2 : 2 - t * 2; // 0→1→0 の山型に変換
  return progress * 100;
}

// Web Audio API: ブラウザ標準の音声合成の仕組み。ファイルなしで短い音を作れる。
function playChime(frequencies, type = "sine") {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  const context = new AudioContext();

  frequencies.forEach(({ freq, delay, duration }) => {
    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, start);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(0.12, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  });
}

// 成功したときの「ピンポーン」という2音チャイム。
function playSuccessChime() {
  playChime(
    [
      { freq: 880, delay: 0, duration: 0.16 },
      { freq: 659, delay: 0.14, duration: 0.22 },
    ],
    "sine"
  );
}

// 失敗(捕まった)ときの、低いブザー音。
function playCaughtBuzz() {
  playChime(
    [
      { freq: 160, delay: 0, duration: 0.35 },
      { freq: 120, delay: 0.05, duration: 0.4 },
    ],
    "sawtooth"
  );
}

// requestAnimationFrame: ブラウザの描画タイミングに合わせて関数を繰り返し呼ぶ仕組み。
// setIntervalよりも滑らかにアニメーションさせられる。
function renderLoop() {
  if (gameState !== "running") return;

  const percent = getMarkerPercent(Date.now());
  elements.marker.style.left = `${percent}%`;

  animationFrameId = window.requestAnimationFrame(renderLoop);
}

function startNewRound(streak) {
  periodMs = getPeriodMs(streak);
  currentZone = randomizeZone(getZoneWidthPercent(streak));
  applyZoneToDom();
  phaseStartedAt = Date.now();
}

function startGame() {
  currentStreak = 0;
  updateStreakDisplay();
  elements.feedbackLine.textContent = " ";

  startNewRound(currentStreak);

  gameState = "running";
  elements.idlePanel.hidden = true;
  elements.resultPanel.hidden = true;
  elements.runningPanel.hidden = false;

  if (animationFrameId) window.cancelAnimationFrame(animationFrameId);
  animationFrameId = window.requestAnimationFrame(renderLoop);
}

function handleSuccess() {
  playSuccessChime();
  updateFeedback(SUCCESS_LINES);

  currentStreak += 1;
  updateStreakDisplay();

  elements.pingButton.classList.add("is-pressing");
  window.setTimeout(() => elements.pingButton.classList.remove("is-pressing"), 100);

  startNewRound(currentStreak);
}

function handleCaught() {
  playCaughtBuzz();

  if (animationFrameId) {
    window.cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  gameState = "gameover";

  const isNewBest = currentStreak > bestStreak;
  if (isNewBest) {
    bestStreak = currentStreak;
    saveBestStreak(bestStreak);
    updateBestLabel();
  }

  const caughtLine = CAUGHT_LINES[Math.floor(Math.random() * CAUGHT_LINES.length)];
  elements.resultKicker.textContent = caughtLine;
  elements.resultStreak.textContent = currentStreak.toLocaleString("ja-JP");
  elements.resultDetail.textContent = isNewBest
    ? "自己ベストを更新しました!"
    : `自己ベストは ${bestStreak.toLocaleString("ja-JP")}回 です。`;

  elements.runningPanel.hidden = true;
  elements.resultPanel.hidden = false;
}

// ピンポンを押した瞬間の判定。ゲージがセーフゾーンの範囲内にあれば成功。
function attemptPress() {
  if (gameState !== "running") return;

  const percent = getMarkerPercent(Date.now());
  const zoneEnd = currentZone.start + currentZone.width;
  const isHit = percent >= currentZone.start && percent <= zoneEnd;

  if (isHit) {
    handleSuccess();
  } else {
    handleCaught();
  }
}

function retryGame() {
  startGame();
}

// URLSearchParams: URLのクエリ文字列(?text=...の部分)を組み立てる標準機能。
function shareResult() {
  const isWebPage = window.location.protocol.startsWith("http");

  // 別パラメータ(url=...)ではなく、投稿本文(text)自体にリンクを埋め込む。
  // こうすることで、リンクが確実に投稿内容の一部として表示される。
  let text =
    `ピンポンダッシュで${currentStreak}回連続成功しました。\n` +
    `(自己ベスト: ${bestStreak}回)`;
  if (isWebPage) text += `\n\n${window.location.href}`;
  text += `\n\n#ピンポンダッシュ`;

  const params = new URLSearchParams({ text });

  window.open(
    `https://twitter.com/intent/tweet?${params.toString()}`,
    "x-share",
    "width=640,height=520,noopener,noreferrer"
  );
}

function initialise() {
  updateBestLabel();
  updateStreakDisplay();
  applyZoneToDom();

  elements.startButton.addEventListener("click", startGame);
  elements.pingButton.addEventListener("click", attemptPress);
  elements.retryButton.addEventListener("click", retryGame);
  elements.resultShareButton.addEventListener("click", shareResult);

  // スペースキーやEnterキーでもピンポンを押せるようにする(反射神経ゲームなので押しやすさ重視)。
  window.addEventListener("keydown", (event) => {
    if (event.code !== "Space" && event.code !== "Enter") return;
    if (gameState !== "running") return;

    // スペースキーの本来の動作(ページのスクロール)を止める。
    event.preventDefault();
    attemptPress();
  });
}

initialise();

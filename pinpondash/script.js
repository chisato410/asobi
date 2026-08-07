// localStorage: ブラウザに保存される簡易データ倉庫。タブを閉じても・再起動しても
// 同じ端末なら値が残る(シークレットモードや別端末には引き継がれない)。
const STORAGE_KEY = "pinpon-dash:best-streak";
const MAX_ROUND_TRIPS = 5;
const SHARE_ILLUSTRATIONS = Array.from(
  { length: 7 },
  (_, index) => `./assets/share/share-${String(index + 1).padStart(2, "0")}.png`
);

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
  turnsLeft: document.querySelector("#turnsLeft"),
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
  resultShareHelp: document.querySelector("#resultShareHelp"),
  retryButton: document.querySelector("#retryButton"),
  dashCat: document.querySelector("#dashCat"),
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

let shareIllustrationElements = [];
let lastShareIllustration = null;

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

  const now = Date.now();
  const elapsed = now - phaseStartedAt;
  const completedRoundTrips = Math.floor(elapsed / periodMs);
  const remainingRoundTrips = Math.max(0, MAX_ROUND_TRIPS - completedRoundTrips);

  elements.turnsLeft.textContent = `のこり ${remainingRoundTrips} 往復`;
  elements.turnsLeft.classList.toggle("is-danger", remainingRoundTrips <= 3);

  if (elapsed >= periodMs * MAX_ROUND_TRIPS) {
    elements.turnsLeft.textContent = "時間切れ";
    elements.turnsLeft.classList.add("is-danger");
    handleCaught("timeout");
    return;
  }

  const percent = getMarkerPercent(now);
  elements.marker.style.left = `${percent}%`;

  animationFrameId = window.requestAnimationFrame(renderLoop);
}

function startNewRound(streak) {
  periodMs = getPeriodMs(streak);
  currentZone = randomizeZone(getZoneWidthPercent(streak));
  applyZoneToDom();
  phaseStartedAt = Date.now();
  elements.turnsLeft.textContent = `のこり ${MAX_ROUND_TRIPS} 往復`;
  elements.turnsLeft.classList.remove("is-danger");
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
  elements.dashCat.classList.remove("is-caught", "is-celebrating");
  elements.dashCat.classList.add("is-running");

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
  elements.dashCat.classList.add("is-celebrating");
  window.setTimeout(() => elements.dashCat.classList.remove("is-celebrating"), 280);

  startNewRound(currentStreak);
}

function handleCaught(reason = "miss") {
  playCaughtBuzz();

  if (animationFrameId) {
    window.cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  gameState = "gameover";
  elements.dashCat.classList.remove("is-running", "is-celebrating");
  elements.dashCat.classList.add("is-caught");

  const isNewBest = currentStreak > bestStreak;
  if (isNewBest) {
    bestStreak = currentStreak;
    saveBestStreak(bestStreak);
    updateBestLabel();
  }

  const caughtLine = reason === "timeout"
    ? "押す前に時間切れ。"
    : CAUGHT_LINES[Math.floor(Math.random() * CAUGHT_LINES.length)];
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

  const now = Date.now();
  if (now - phaseStartedAt >= periodMs * MAX_ROUND_TRIPS) {
    elements.turnsLeft.textContent = "時間切れ";
    elements.turnsLeft.classList.add("is-danger");
    handleCaught("timeout");
    return;
  }

  const percent = getMarkerPercent(now);
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

function drawRoundedRect(context, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.arcTo(x + width, y, x + width, y + height, safeRadius);
  context.arcTo(x + width, y + height, x, y + height, safeRadius);
  context.arcTo(x, y + height, x, y, safeRadius);
  context.arcTo(x, y, x + width, y, safeRadius);
  context.closePath();
}

function dataUrlToFile(dataUrl, filename) {
  const [metadata, encoded] = dataUrl.split(",");
  const mimeType = metadata.match(/data:(.*?);base64/)?.[1] || "image/png";
  const bytes = Uint8Array.from(window.atob(encoded), (character) => character.charCodeAt(0));
  return new File([bytes], filename, { type: mimeType });
}

function pickRandomShareIllustration() {
  const loaded = shareIllustrationElements.filter(
    (image) => image.complete && image.naturalWidth > 0
  );
  if (loaded.length === 0) return null;

  const candidates = loaded.length > 1
    ? loaded.filter((image) => image.src !== lastShareIllustration)
    : loaded;
  const selected = candidates[Math.floor(Math.random() * candidates.length)];
  lastShareIllustration = selected.src;
  return selected;
}

function prepareShareIllustrations() {
  let settledCount = 0;
  let isShareReady = false;

  const updateReadyState = () => {
    settledCount += 1;
    const hasLoadedImage = shareIllustrationElements.some(
      (image) => image.complete && image.naturalWidth > 0
    );

    if (!isShareReady && hasLoadedImage) {
      isShareReady = true;
      elements.resultShareButton.disabled = false;
      const supportsDirectShare = supportsNativeFileShare();
      elements.resultShareHelp.textContent = supportsDirectShare
        ? ""
        : "Xが開いたら⌘V / Ctrl+Vで画像を貼り付けてください。";
      elements.resultShareHelp.hidden = supportsDirectShare;
      return;
    }

    if (!isShareReady && settledCount === SHARE_ILLUSTRATIONS.length) {
      elements.resultShareHelp.textContent = "共有画像を読み込めませんでした。再読み込みしてください。";
    }
  };

  shareIllustrationElements = SHARE_ILLUSTRATIONS.map((source) => {
    const image = new Image();
    image.addEventListener("load", updateReadyState, { once: true });
    image.addEventListener("error", updateReadyState, { once: true });
    image.src = source;
    return image;
  });
}

function supportsNativeFileShare() {
  const isMobileDevice = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  if (!isMobileDevice || !navigator.share || !navigator.canShare || typeof File === "undefined") {
    return false;
  }
  try {
    const testFile = new File([new Uint8Array([0])], "share-check.png", { type: "image/png" });
    return navigator.canShare({ files: [testFile] });
  } catch {
    return false;
  }
}

function createPinponShareCard(useJpeg = false) {
  if (typeof File === "undefined") return null;
  const illustration = pickRandomShareIllustration();
  if (!illustration) return null;

  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 630;
  const context = canvas.getContext("2d");
  if (!context) return null;

  context.fillStyle = "#c9dcde";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(255, 248, 232, 0.2)";
  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 15; column += 1) {
      if ((row + column) % 2 === 0) context.fillRect(column * 80, row * 80, 80, 80);
    }
  }

  context.save();
  context.shadowColor = "rgba(81, 72, 63, 0.14)";
  context.shadowBlur = 28;
  context.shadowOffsetY = 14;
  drawRoundedRect(context, 70, 58, 1060, 514, 48);
  context.fillStyle = "#fff8e8";
  context.fill();
  context.restore();

  context.fillStyle = "#51483f";
  context.font = '800 27px "Hiragino Sans", "Yu Gothic", sans-serif';
  context.fillText("ピンポンダッシュ", 135, 137);
  context.fillStyle = "#ce8d78";
  context.font = '800 24px "Hiragino Sans", "Yu Gothic", sans-serif';
  context.fillText("逃走記録", 135, 195);
  context.fillStyle = "#51483f";
  context.font = '900 98px "Hiragino Sans", "Yu Gothic", sans-serif';
  context.fillText(`${currentStreak.toLocaleString("ja-JP")}回`, 130, 320, 500);
  context.font = '800 31px "Hiragino Sans", "Yu Gothic", sans-serif';
  context.fillText("連続成功", 135, 385);
  context.fillStyle = "#8b7d70";
  context.font = '700 24px "Hiragino Sans", "Yu Gothic", sans-serif';
  context.fillText(currentTitle(currentStreak).label, 135, 438, 500);
  context.font = '600 20px "Hiragino Sans", "Yu Gothic", sans-serif';
  context.fillText(`自己ベスト ${bestStreak.toLocaleString("ja-JP")}回`, 135, 510);

  context.drawImage(illustration, 650, 92, 430, 430);
  const mimeType = useJpeg ? "image/jpeg" : "image/png";
  const filename = useJpeg ? "pinpon-dash-result.jpg" : "pinpon-dash-result.png";
  return dataUrlToFile(canvas.toDataURL(mimeType, 0.86), filename);
}

function showShareToast(message) {
  document.querySelector(".share-toast")?.remove();
  const toast = document.createElement("p");
  toast.className = "share-toast";
  toast.setAttribute("role", "status");
  toast.textContent = message;
  document.body.append(toast);
  window.setTimeout(() => toast.remove(), 3200);
}

function setShareButtonBusy(isBusy) {
  elements.resultShareButton.disabled = isBusy;
}

async function copyImageToClipboard(file) {
  if (!file || !navigator.clipboard?.write || typeof ClipboardItem === "undefined") return false;
  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": file })]);
    return true;
  } catch {
    return false;
  }
}

function openXShare(text) {
  const params = new URLSearchParams({ text });
  window.location.assign(`https://twitter.com/intent/tweet?${params.toString()}`);
}

async function shareResult() {
  setShareButtonBusy(true);
  const isWebPage = window.location.protocol.startsWith("http");

  // 別パラメータ(url=...)ではなく、投稿本文(text)自体にリンクを埋め込む。
  // こうすることで、リンクが確実に投稿内容の一部として表示される。
  let text =
    `ピンポンダッシュで${currentStreak}回連続成功しました。\n` +
    `(自己ベスト: ${bestStreak}回)`;
  if (isWebPage) text += `\n\n${window.location.href}`;
  text += `\n\n#ピンポンダッシュ`;

  const supportsDirectShare = supportsNativeFileShare();
  const cardFile = createPinponShareCard(supportsDirectShare);
  if (!cardFile) {
    showShareToast("共有画像を準備中です。少し待ってもう一度押してください。");
    setShareButtonBusy(false);
    return;
  }

  const shareData = { title: "ピンポンダッシュ", text, files: [cardFile] };
  if (navigator.share && navigator.canShare?.(shareData)) {
    try {
      await navigator.share(shareData);
      setShareButtonBusy(false);
      return;
    } catch (error) {
      if (error?.name === "AbortError") {
        setShareButtonBusy(false);
        return;
      }
    }
  }

  if (await copyImageToClipboard(cardFile)) {
    showShareToast("画像をコピーしました。Xを開いています。投稿欄で⌘V / Ctrl+Vしてください。");
    window.setTimeout(() => {
      const params = new URLSearchParams({ text });
      window.location.assign(`https://twitter.com/intent/tweet?${params.toString()}`);
    }, 850);
    return;
  }

  showShareToast("画像共有に未対応のため、文章だけでXを開きます。");
  setShareButtonBusy(false);
  openXShare(text);
}

function initialise() {
  updateBestLabel();
  updateStreakDisplay();
  applyZoneToDom();

  prepareShareIllustrations();

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

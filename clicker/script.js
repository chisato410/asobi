// localStorage: ブラウザに保存される簡易データ倉庫。
// ここに保存した値は、タブを閉じても・PCを再起動しても同じ端末なら残り続ける。
// (ただしシークレットモードや別の端末では引き継がれない)
const STORAGE_KEY = "muimi-clicker:lifetime-total";

// 称号(ランク)の一覧。しきい値(threshold)以上のスコアで名乗れる称号を
// 配列の後ろから順にチェックする。
const RANKS = [
  { threshold: 0, label: "見習いクリッカー" },
  { threshold: 10, label: "クリック迷子" },
  { threshold: 30, label: "指が疲れてきた人" },
  { threshold: 60, label: "無心の境地" },
  { threshold: 100, label: "クリック仙人" },
  { threshold: 200, label: "穴の守護者" },
  { threshold: 400, label: "何かを悟った人" },
  { threshold: 700, label: "伝説のクリッカー" },
  { threshold: 1000, label: "もはや宇宙" },
];

// 叩くたびにランダムで出すだけの、意味のない一言たち。
const FEEDBACK_LINES = [
  "えらい。",
  "その調子。",
  "指、大丈夫?",
  "意味は特にない。",
  "でも叩いちゃう。",
  "誰も見ていない。",
  "宇宙が少し広がった気がする。",
  "これは修行かもしれない。",
  "叩いた。それだけ。",
  "そろそろ休憩してもいいのに。",
];

// querySelector: CSSセレクタと同じ書き方でDOM要素を1つ取得するメソッド。
// querySelectorAll は条件に合う要素を「全部」取得し、NodeListというリストで返す。
// Array.from でNodeListを普通の配列に変換しておくと、filterやforEachが使いやすい。
// 使う要素をここでまとめて取得しておくと、以降のコードで見通しが良くなる。
const elements = {
  scoreValue: document.querySelector("#scoreValue"),
  rankBadge: document.querySelector("#rankBadge"),
  moleHoles: Array.from(document.querySelectorAll(".mole-hole")),
  feedbackLine: document.querySelector("#feedbackLine"),
  cpsValue: document.querySelector("#cpsValue"),
  resetButton: document.querySelector("#resetButton"),
  scoreShareButton: document.querySelector("#scoreShareButton"),
  lifetimeLabel: document.querySelector("#lifetimeLabel"),
  flash: document.querySelector("#flash"),
  durationPicker: document.querySelector("#durationPicker"),
  duration3: document.querySelector("#duration3"),
  duration5: document.querySelector("#duration5"),
  countdownPanel: document.querySelector("#countdownPanel"),
  countdownCaption: document.querySelector("#countdownCaption"),
  countdownValue: document.querySelector("#countdownValue"),
  finishButton: document.querySelector("#finishButton"),
  checkModal: document.querySelector("#checkModal"),
  notYetButton: document.querySelector("#notYetButton"),
  doneButton: document.querySelector("#doneButton"),
  cupResult: document.querySelector("#cupResult"),
  resultWaitTime: document.querySelector("#resultWaitTime"),
  resultDetail: document.querySelector("#resultDetail"),
  cupShareButton: document.querySelector("#cupShareButton"),
  cupRetryButton: document.querySelector("#cupRetryButton"),
};

// このセッション(今このページを開いてから)のスコア。リロードすると0に戻る。
let sessionScore = 0;

// 通算(累計)クリック数。localStorageに保存され、リロードしても引き継がれる。
let lifetimeTotal = loadLifetimeTotal();

// CPS (Clicks Per Second = 1秒あたりのクリック回数) を計算するために、
// 直近のクリック時刻(タイムスタンプ)を配列に貯めておく。
let recentClickTimestamps = [];

// --- ここからモグラ叩き機能 ---
// ゲーム(出現ループ)が始まった時刻。ここからの経過時間で難易度を上げていく。
let gameStartedAt = Date.now();

// setTimeoutが返すID。次に出す/隠す/猶予を止めるためのタイマーを保持しておく。
let moleSpawnTimeoutId = null;
let moleHideTimeoutId = null;
let moleGraceTimeoutId = null;

// 今まさに出ている(is-upクラスがついている)穴の要素。何も出ていなければnull。
let activeMoleHole = null;

// 時間切れで消えた直後の穴。「消えた瞬間ギリギリのクリック」も
// ヒット扱いにしてあげるための猶予(グレースピリオド)として使う。
let graceMoleHole = null;

// 消えてからこの時間(ミリ秒)以内のクリックなら、まだヒットとして認める。
const MOLE_HIT_GRACE_MS = 220;
// --- ここまでモグラ叩き機能 ---

// --- ここからカップ麺タイマー機能 ---
// setInterval が返すID。clearInterval(id) でタイマーを止めるために保持しておく。
let cupIntervalId = null;

// 選んだ待ち時間(秒)。3分なら180、5分なら300。
let cupDurationSeconds = 0;

// タイマーを開始した瞬間の時刻(ミリ秒)。経過時間を計算する基準になる。
let cupStartedAt = 0;

// タイマー開始時点でのスコア。終了時のスコアからこれを引くと
// 「待っている間に押した回数」だけを取り出せる。
let cupRoundStartScore = 0;

// タイマーが0になったあと、まだ「できた」が押されていない状態かどうか。
let cupAwaitingManualFinish = false;

// Xでシェアする文面を組み立てるために、確定した結果を覚えておく。
let cupLastResult = null;
// --- ここまでカップ麺タイマー機能 ---

function loadLifetimeTotal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  } catch {
    // プライベートブラウジングなどでlocalStorageが使えない場合はここに来る。
    return 0;
  }
}

function saveLifetimeTotal(total) {
  try {
    localStorage.setItem(STORAGE_KEY, String(total));
  } catch {
    // 保存できなくてもゲーム自体は続けられるので何もしない。
  }
}

function currentRank(score) {
  // 後ろ(しきい値が高い方)から見ていき、最初に条件を満たしたものを称号にする。
  for (let i = RANKS.length - 1; i >= 0; i -= 1) {
    if (score >= RANKS[i].threshold) return RANKS[i];
  }
  return RANKS[0];
}

function updateScoreDisplay() {
  elements.scoreValue.textContent = sessionScore.toLocaleString("ja-JP");
  elements.lifetimeLabel.textContent = `累計 ${lifetimeTotal.toLocaleString("ja-JP")}回`;

  const rank = currentRank(sessionScore);
  if (elements.rankBadge.textContent !== rank.label) {
    elements.rankBadge.textContent = rank.label;
    elements.rankBadge.classList.remove("is-changed");
    // 一度クラスを外して付け直すことで、同じアニメーションを毎回再生させるテクニック。
    void elements.rankBadge.offsetWidth; // 強制的にレイアウトを再計算させる(リフロー)
    elements.rankBadge.classList.add("is-changed");
  }
}

function updateFeedback() {
  const message = FEEDBACK_LINES[Math.floor(Math.random() * FEEDBACK_LINES.length)];
  elements.feedbackLine.textContent = message;
}

function updateCps(now) {
  // 直近1000ミリ秒(1秒)より前のタイムスタンプは配列から取り除く。
  recentClickTimestamps = recentClickTimestamps.filter((timestamp) => now - timestamp <= 1000);
  elements.cpsValue.textContent = `毎秒 ${recentClickTimestamps.length} 回`;
}

// Web Audio API: ブラウザ標準の音声合成・再生の仕組み。
// mp3ファイルを用意しなくても、波形を組み立てて短い音を鳴らせる。
function playClickSound() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  const context = new AudioContext();
  const now = context.currentTime;

  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = "square";
  oscillator.frequency.setValueAtTime(520, now);
  oscillator.frequency.exponentialRampToValueAtTime(220, now + 0.05);

  gain.gain.setValueAtTime(0.05, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

  oscillator.connect(gain).connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.08);
}

// カップ麺タイマーが0になった瞬間に鳴らす「ピピピ」というアラーム音。
// キッチンタイマーのように、短いビープ音を3回連続で鳴らす。
function playTimerAlarmSound() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  const context = new AudioContext();
  const beepDuration = 0.12;
  const gapBetweenBeeps = 0.13;

  for (let i = 0; i < 3; i += 1) {
    const start = context.currentTime + i * (beepDuration + gapBetweenBeeps);

    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(880, start);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(0.11, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + beepDuration);

    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + beepDuration + 0.02);
  }
}

// 叩けた瞬間に呼ばれる。スコア加算・保存・演出をまとめて行う。
// (どの穴を叩いたかは問わないので、穴自体の見た目の演出はhandleHoleClick側で行う)
function registerHit() {
  const now = Date.now();

  sessionScore += 1;
  lifetimeTotal += 1;
  recentClickTimestamps.push(now);

  saveLifetimeTotal(lifetimeTotal);
  updateScoreDisplay();
  updateFeedback();
  updateCps(now);
  playClickSound();

  // 100回・500回など区切りの良い数字を踏んだ瞬間だけ画面をピカッと光らせる。
  if (sessionScore % 100 === 0) {
    elements.flash.classList.add("is-active");
    window.setTimeout(() => elements.flash.classList.remove("is-active"), 200);
  }
}

function getElapsedGameSeconds() {
  return (Date.now() - gameStartedAt) / 1000;
}

// 次にモグラを出すまでの待ち時間(ミリ秒)。
// 経過時間が長いほど短くなり、最短450msで頭打ちにする。
// 毎回まったく同じ間隔だと機械的すぎるので、ランダムに±30%ほどゆらす。
function getSpawnDelayMs(elapsedSeconds) {
  const base = Math.max(450, 1300 - elapsedSeconds * 3);
  return base * (0.7 + Math.random() * 0.6);
}

// モグラが出ている時間(ミリ秒)。これも経過時間とともに短くなる。
function getVisibleDurationMs(elapsedSeconds) {
  return Math.max(500, 1100 - elapsedSeconds * 2);
}

// 直前と同じ穴が連続で出ないように、可能なら別の穴を選ぶ。
function pickRandomHole(excludeHole) {
  const candidates = elements.moleHoles.filter((hole) => hole !== excludeHole);
  const pool = candidates.length > 0 ? candidates : elements.moleHoles;
  return pool[Math.floor(Math.random() * pool.length)];
}

function scheduleNextMole() {
  const delay = getSpawnDelayMs(getElapsedGameSeconds());
  moleSpawnTimeoutId = window.setTimeout(spawnMole, delay);
}

function spawnMole() {
  const hole = pickRandomHole(activeMoleHole);
  activeMoleHole = hole;
  hole.classList.add("is-up");

  const visibleDuration = getVisibleDurationMs(getElapsedGameSeconds());
  moleHideTimeoutId = window.setTimeout(() => {
    // 叩かれないまま時間切れ。穴を引っ込めるが、消えた直後の一瞬だけは
    // 「猶予中の穴」として覚えておき、次のモグラの予約に進む。
    hole.classList.remove("is-up");
    if (activeMoleHole === hole) activeMoleHole = null;

    graceMoleHole = hole;
    window.clearTimeout(moleGraceTimeoutId);
    moleGraceTimeoutId = window.setTimeout(() => {
      if (graceMoleHole === hole) graceMoleHole = null;
    }, MOLE_HIT_GRACE_MS);

    scheduleNextMole();
  }, visibleDuration);
}

function handleHoleClick(hole) {
  if (hole === activeMoleHole) {
    // ちゃんと出ている間に叩けた、通常のヒット。
    window.clearTimeout(moleHideTimeoutId);
    hole.classList.remove("is-up");
    hole.classList.add("is-hit");
    window.setTimeout(() => hole.classList.remove("is-hit"), 200);
    activeMoleHole = null;

    registerHit();
    scheduleNextMole();
    return;
  }

  if (hole === graceMoleHole) {
    // 見えた瞬間に押したつもりが一歩遅れた、猶予期間内のクリック。
    // 次のモグラの出現はタイムアウト側ですでに予約済みなので、ここではヒット扱いにするだけ。
    graceMoleHole = null;
    window.clearTimeout(moleGraceTimeoutId);
    hole.classList.add("is-hit");
    window.setTimeout(() => hole.classList.remove("is-hit"), 200);

    registerHit();
    return;
  }

  // 何も出ていない・猶予も切れている穴を押しても無視する。
}

// タイマーを止めて、出ているモグラを引っ込めてから、最初からループを始め直す。
function restartMoleLoop() {
  window.clearTimeout(moleSpawnTimeoutId);
  window.clearTimeout(moleHideTimeoutId);
  window.clearTimeout(moleGraceTimeoutId);
  if (activeMoleHole) {
    activeMoleHole.classList.remove("is-up");
    activeMoleHole = null;
  }
  graceMoleHole = null;
  scheduleNextMole();
}

function handleReset() {
  // 累計(lifetimeTotal)は消さず、今回のセッションのスコアだけ0に戻す。
  sessionScore = 0;
  elements.feedbackLine.textContent = " "; // 見た目の高さを保つための空白(&nbsp;)
  updateScoreDisplay();

  // 出現スピードの難易度も、今リセットした瞬間から数え直す。
  gameStartedAt = Date.now();
  restartMoleLoop();
}

// setInterval: 指定した間隔(ミリ秒)で繰り返し処理を実行するタイマー関数。
// クリックしていない間もCPS表示を0に近づけていくために使う。
function tickCps() {
  updateCps(Date.now());
}

// 秒数を "03:00" のような mm:ss 形式にする。
// padStart(2, "0") は「2桁になるよう先頭を0で埋める」文字列メソッド。
function formatCountdown(totalSeconds) {
  const clamped = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// 結果表示用に「3分15秒」のような読みやすい形式にする。
function formatWaitLabel(totalSeconds) {
  const clamped = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  if (minutes === 0) return `${seconds}秒`;
  if (seconds === 0) return `${minutes}分`;
  return `${minutes}分${seconds}秒`;
}

function openCheckModal() {
  elements.checkModal.hidden = false;
  playTimerAlarmSound();
}

function closeCheckModal() {
  elements.checkModal.hidden = true;
}

// タイマーが動いている間、250msごとに呼ばれる。
// カウントダウン中か、「いやまだ」後のカウントアップ中かで表示を切り替える。
function tickCupTimer() {
  const elapsedSeconds = (Date.now() - cupStartedAt) / 1000;

  if (cupAwaitingManualFinish) {
    // 「いやまだ」後は、待った時間をそのままカウントアップして見せる。
    elements.countdownValue.textContent = formatCountdown(elapsedSeconds);
    return;
  }

  const remainingSeconds = cupDurationSeconds - elapsedSeconds;

  if (remainingSeconds <= 0) {
    elements.countdownValue.textContent = "00:00";
    window.clearInterval(cupIntervalId);
    cupIntervalId = null;
    openCheckModal();
    return;
  }

  elements.countdownValue.textContent = formatCountdown(remainingSeconds);
}

function startCupTimer(durationSeconds) {
  cupDurationSeconds = durationSeconds;
  cupStartedAt = Date.now();
  cupRoundStartScore = sessionScore;
  cupAwaitingManualFinish = false;
  cupLastResult = null;

  elements.durationPicker.hidden = true;
  elements.cupResult.hidden = true;
  elements.countdownPanel.hidden = false;
  elements.countdownCaption.textContent = "残り時間";
  elements.finishButton.hidden = true;
  elements.countdownValue.textContent = formatCountdown(durationSeconds);

  if (cupIntervalId) window.clearInterval(cupIntervalId);
  cupIntervalId = window.setInterval(tickCupTimer, 250);
}

// 「いやまだ」: モーダルを閉じて、好きなタイミングで「できた!」を押せるようにする。
// (定期的な再確認はしない仕様)
function handleNotYet() {
  closeCheckModal();
  cupAwaitingManualFinish = true;
  elements.countdownCaption.textContent = "経過時間(まだ待ち中)";
  elements.finishButton.hidden = false;

  if (!cupIntervalId) {
    cupIntervalId = window.setInterval(tickCupTimer, 250);
  }
}

// 「できた」: 待った時間とその間のクリック数を確定し、結果画面を表示する。
function finalizeCupRound() {
  if (cupIntervalId) {
    window.clearInterval(cupIntervalId);
    cupIntervalId = null;
  }
  closeCheckModal();

  const elapsedSeconds = (Date.now() - cupStartedAt) / 1000;
  const clicksDuringWait = Math.max(0, sessionScore - cupRoundStartScore);

  cupLastResult = {
    elapsedSeconds,
    durationSeconds: cupDurationSeconds,
    clicks: clicksDuringWait,
  };

  elements.countdownPanel.hidden = true;
  elements.resultWaitTime.textContent = formatWaitLabel(elapsedSeconds);
  elements.resultDetail.textContent = `その間に ${clicksDuringWait.toLocaleString("ja-JP")} 回叩きました。おいしく食べます!`;
  elements.cupResult.hidden = false;
}

// 「もう一度挑戦する」: サイズ選択画面に戻す。
function retryCupTimer() {
  if (cupIntervalId) {
    window.clearInterval(cupIntervalId);
    cupIntervalId = null;
  }
  cupAwaitingManualFinish = false;
  cupLastResult = null;

  elements.cupResult.hidden = true;
  elements.countdownPanel.hidden = true;
  elements.durationPicker.hidden = false;
}

// URLSearchParams: URLのクエリ文字列(?text=...の部分)を組み立てる標準機能。
// カップ麺タイマーの結果シェアと、常時使えるスコアシェアの両方から呼び出す共通処理。
function openXShareWindow(baseText) {
  const isWebPage = window.location.protocol.startsWith("http");
  // 別パラメータ(url=...)ではなく、投稿本文(text)自体にリンクを埋め込む。
  // こうすることで、リンクが確実に投稿内容の一部として表示される。
  const text = isWebPage ? `${baseText}\n\n${window.location.href}` : baseText;
  const params = new URLSearchParams({ text });

  window.open(
    `https://twitter.com/intent/tweet?${params.toString()}`,
    "x-share",
    "width=640,height=520,noopener,noreferrer"
  );
}

function shareCupResult() {
  if (!cupLastResult) return;

  const sizeLabel = cupLastResult.durationSeconds === 300 ? "ビッグサイズ" : "ふつうサイズ";
  const waitLabel = formatWaitLabel(cupLastResult.elapsedSeconds);
  const text =
    `カップ麺(${sizeLabel})、${waitLabel}待って完成。\n` +
    `待っている間に${cupLastResult.clicks}回叩きました。おいしく食べます!\n\n` +
    `#無意味クリッカー #カップ麺タイマー`;

  openXShareWindow(text);
}

// タイマーの完了を待たず、今この瞬間のスコア・称号をいつでもシェアできるボタン用。
function shareCurrentScore() {
  const rank = currentRank(sessionScore);
  const text =
    `無意味クリッカーで「${rank.label}」(スコア${sessionScore.toLocaleString("ja-JP")})になりました。\n\n` +
    `#無意味クリッカー`;

  openXShareWindow(text);
}

function initialise() {
  updateScoreDisplay();

  // 9つの穴それぞれに「押されたら自分自身をhandleHoleClickに渡す」リスナーをつける。
  elements.moleHoles.forEach((hole) => {
    hole.addEventListener("click", () => handleHoleClick(hole));
  });
  elements.resetButton.addEventListener("click", handleReset);
  elements.scoreShareButton.addEventListener("click", shareCurrentScore);

  window.setInterval(tickCps, 250);

  // ページを開いた瞬間からモグラの出現ループを開始する。
  gameStartedAt = Date.now();
  scheduleNextMole();

  elements.duration3.addEventListener("click", () => startCupTimer(180));
  elements.duration5.addEventListener("click", () => startCupTimer(300));
  elements.notYetButton.addEventListener("click", handleNotYet);
  elements.doneButton.addEventListener("click", finalizeCupRound);
  elements.finishButton.addEventListener("click", finalizeCupRound);
  elements.cupShareButton.addEventListener("click", shareCupResult);
  elements.cupRetryButton.addEventListener("click", retryCupTimer);
}

initialise();

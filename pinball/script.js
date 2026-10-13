(() => {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const ballsEl = document.getElementById('balls');
  const messageEl = document.getElementById('gameMessage');
  const startButton = document.getElementById('startButton');
  const launchControl = document.getElementById('launchControl');
  const launchLabel = document.getElementById('launchLabel');
  const powerMeter = document.getElementById('powerMeter');
  const powerFill = document.getElementById('powerFill');
  const leftControl = document.getElementById('leftControl');
  const rightControl = document.getElementById('rightControl');
  const statusText = document.getElementById('statusText');
  const statusDot = document.getElementById('statusDot');
  const soundButton = document.getElementById('soundButton');

  const W = 560;
  const H = 860;
  const TAU = Math.PI * 2;
  const PLAYFIELD_LEFT = 15;
  const PLAYFIELD_RIGHT = 545;
  const SHOOTER_X = 517;
  const theme = {
    night: '#171329', ink: '#30263e', panel: '#fff1c9', cream: '#fff1c9',
    brass: '#ffd25f', hot: '#ef6d5c', cyan: '#6ac7ad', muted: '#a99dba',
    brown: '#a986c2', salmon: '#f08b6a', paper: '#fff1c9'
  };
  const catMascot = new Image();
  catMascot.src = 'assets/cat-mascot.png';
  const catMeow = new Audio('assets/cat-meow.mp3');
  catMeow.preload = 'auto';
  catMeow.volume = .78;

  function readBest() {
    try { return Number(localStorage.getItem('neko-pinball-best') || 0); }
    catch { return 0; }
  }

  function saveBest(value) {
    try { localStorage.setItem('neko-pinball-best', String(value)); }
    catch { /* The game remains playable when storage is unavailable. */ }
  }

  let score = 0;
  let best = readBest();
  let ballsLeft = 3;
  let state = 'title';
  let lastTime = performance.now();
  let shake = 0;
  let multiplier = 1;
  let multiplierTimer = 0;
  let playfieldTime = 0;
  let launchPower = 1;
  let soundOn = true;
  let audioContext = null;
  const input = { left: false, right: false };
  // Hold the launch control to wind the plunger up; release to fire. `power`
  // runs 0..1 and `suppress` swallows the release of the press that merely
  // started or resumed the game.
  const plunger = { charging: false, power: 0, suppress: false, tick: 0 };
  const CHARGE_SECONDS = 1.05;
  const TAP_POWER = .12;
  const CLICK_POWER = .55;
  const GRAVITY = 625;
  const POST_RESTITUTION = .84;
  const SLING_RESTITUTION = .9;
  const SLING_LIFT = 82;
  const BUMPER_BOOST = 150;
  const particles = [];
  const stars = Array.from({ length: 55 }, (_, i) => ({
    x: (i * 137.5) % W,
    y: 40 + ((i * 83.7) % 610),
    r: (i % 4 === 0 ? 1.6 : .8),
    a: .035 + (i % 5) * .018
  }));

  const ball = {
    x: SHOOTER_X, y: 744, vx: 0, vy: 0, r: 10,
    launched: false, inShooterLane: true, trail: []
  };

  const bumpers = [
    { x: 180, y: 280, r: 30, color: theme.hot, value: 300, pulse: 0, mark: 'にゃ' },
    { x: 380, y: 287, r: 30, color: theme.cyan, value: 300, pulse: 0, mark: 'ねこ' },
    { x: 278, y: 414, r: 34, color: theme.brass, value: 500, pulse: 0, mark: '★' }
  ];

  const catObstacle = {
    x: 280, y: 196, r: 39, cooldown: 0, pulse: 0
  };
  const catSpinner = {
    x: 280, y: 312, length: 84, radius: 9,
    angle: -.18, angularVelocity: 1.15, cooldown: 0, pulse: 0
  };

  const posts = [
    { x: 112, y: 350, r: 8 }, { x: 444, y: 350, r: 8 },
    { x: 142, y: 424, r: 9 }, { x: 414, y: 424, r: 9 },
    { x: 116, y: 500, r: 10 }, { x: 442, y: 500, r: 10 },
    { x: 142, y: 628, r: 8 }, { x: 416, y: 628, r: 8 }
  ];

  const warpHoles = [
    { x: 185, y: 572, r: 20, rim: theme.hot, cooldown: 0 },
    { x: 375, y: 572, r: 20, rim: theme.cyan, cooldown: 0 },
    { x: 280, y: 510, r: 19, rim: theme.brass, cooldown: 0 }
  ];
  const warpTargets = [
    { x: 102, y: 226 }, { x: 278, y: 332 }, { x: 438, y: 220 },
    { x: 105, y: 462 }, { x: 438, y: 468 }
  ];

  const leftWall = [18, 138, 30, 646];
  const rails = [
    [542, 138, 542, 776], [492, 180, 492, 646],
    [48, 190, 95, 158], [95, 158, 150, 136],
    [410, 136, 465, 158]
  ];
  const lowerGuides = [
    { start: [30, 646], control1: [30, 682], control2: [92, 712], end: [150, 712] },
    { start: [492, 646], control1: [492, 682], control2: [458, 712], end: [410, 712] }
  ];

  function sampleCurvedGuide({ start, control1, control2, end }, steps = 18) {
    const points = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const u = 1 - t;
      points.push([
        u * u * u * start[0] + 3 * u * u * t * control1[0] + 3 * u * t * t * control2[0] + t * t * t * end[0],
        u * u * u * start[1] + 3 * u * u * t * control1[1] + 3 * u * t * t * control2[1] + t * t * t * end[1]
      ]);
    }
    return points;
  }

  const lowerGuidePaths = lowerGuides.map(guide => {
    const points = sampleCurvedGuide(guide);
    const radii = points.map((_, i) => {
      const t = i / (points.length - 1);
      const eased = t * t * (3 - 2 * t);
      return 3 + eased * 10;
    });
    return { guide, points, radii };
  });
  const lowerGuideSegments = lowerGuidePaths.flatMap(({ points, radii }) =>
    points.slice(1).map((point, i) => ({
      line: [points[i][0], points[i][1], point[0], point[1]],
      radius: (radii[i] + radii[i + 1]) / 2
    }))
  );
  const drawnRails = [leftWall, ...rails];

  const shooterGate = {
    x1: 492, y1: 180, x2: 542, y2: 180,
    cooldown: 0, pulse: 0
  };

  const slingshots = [
    {
      segments: [[92, 526, 160, 606], [160, 606, 197, 625]],
      x: 150, y: 582, push: 100, cooldown: 0
    },
    {
      segments: [[492, 526, 398, 606], [398, 606, 361, 625]],
      x: 410, y: 582, push: -100, cooldown: 0
    }
  ];

  const lanes = [126, 201, 276, 351, 426].map(x => ({ x, lit: false, flash: 0 }));
  const leftFlipper = { pivotX: 150, pivotY: 712, length: 108, radius: 13, angle: .26, target: .26, side: -1 };
  const rightFlipper = { pivotX: 410, pivotY: 712, length: 108, radius: 13, angle: Math.PI - .26, target: Math.PI - .26, side: 1 };

  function initAudio() {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
  }

  function tone(frequency, duration = .08, type = 'sine', volume = .06, slide = 0) {
    if (!soundOn) return;
    initAudio();
    const now = audioContext.currentTime;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(50, frequency + slide), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    osc.connect(gain).connect(audioContext.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  function meow() {
    if (!soundOn) return;
    catMeow.pause();
    catMeow.currentTime = 0;
    const playback = catMeow.play();
    if (playback) playback.catch(() => {});
  }

  function formatScore(value) {
    return Math.floor(value).toString().padStart(6, '0');
  }

  function updateHud() {
    scoreEl.textContent = formatScore(score);
    bestEl.textContent = formatScore(best);
    ballsEl.textContent = Array.from({ length: 3 }, (_, i) => i < ballsLeft ? '●' : '○').join(' ');
  }

  function setStatus(text, mode = 'ready') {
    statusText.textContent = text;
    statusDot.dataset.state = mode;
  }

  function addScore(points, x, y, color = theme.brass) {
    const gained = points * multiplier;
    score += gained;
    if (score > best) {
      best = score;
      saveBest(best);
    }
    updateHud();
    particles.push({ x, y, text: `+${gained}`, life: 1, color, type: 'text' });
  }

  function burst(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU + Math.random() * .25;
      const speed = 55 + Math.random() * 90;
      particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: 1, color, type: 'spark' });
    }
  }

  function resetBall() {
    ball.x = SHOOTER_X;
    ball.y = 746;
    ball.vx = 0;
    ball.vy = 0;
    ball.launched = false;
    ball.inShooterLane = true;
    ball.trail.length = 0;
    playfieldTime = 0;
    shooterGate.cooldown = 0;
    shooterGate.pulse = 0;
    catObstacle.cooldown = 0;
    catObstacle.pulse = 0;
    catSpinner.cooldown = 0;
    catSpinner.pulse = 0;
    warpHoles.forEach(hole => hole.cooldown = 0);
    plunger.charging = false;
    plunger.power = 0;
    launchControl.classList.remove('is-charging');
    launchControl.removeAttribute('data-full');
    setPowerUi(0);
    launchLabel.textContent = 'ボール発射';
    launchControl.disabled = false;
    setStatus('発射ボタンか Space を長押し', 'ready');
  }

  function newGame() {
    initAudio();
    score = 0;
    ballsLeft = 3;
    multiplier = 1;
    multiplierTimer = 0;
    lanes.forEach(lane => lane.lit = false);
    state = 'playing';
    messageEl.classList.add('hidden');
    resetBall();
    updateHud();
    tone(330, .08, 'square', .035, 220);
    setTimeout(() => tone(660, .12, 'square', .025, 180), 80);
  }

  function setPowerUi(power) {
    const percent = Math.round(power * 100);
    powerFill.style.width = `${percent}%`;
    powerMeter.setAttribute('aria-valuenow', String(percent));
    powerMeter.setAttribute('aria-valuetext', `強さ ${percent}パーセント`);
  }

  function canPlunge() {
    return state === 'playing' && !ball.launched;
  }

  function beginCharge() {
    // A press that starts, restarts or resumes the game only does that much:
    // its release must not fling the ball away before the player is ready.
    if (state === 'title' || state === 'gameover') {
      plunger.suppress = true;
      return newGame();
    }
    if (state === 'paused') {
      plunger.suppress = true;
      return togglePause();
    }
    if (plunger.charging || !canPlunge()) return;
    initAudio();
    plunger.charging = true;
    plunger.power = 0;
    plunger.tick = 0;
    launchControl.classList.add('is-charging');
    launchLabel.textContent = '強さ 0%';
    setPowerUi(0);
    setStatus('はなすと発射', 'ready');
  }

  function cancelCharge() {
    if (!plunger.charging) return;
    plunger.charging = false;
    plunger.power = 0;
    ball.y = 746;
    launchControl.classList.remove('is-charging');
    launchControl.removeAttribute('data-full');
    launchLabel.textContent = 'ボール発射';
    setPowerUi(0);
  }

  function releaseCharge() {
    if (plunger.suppress) {
      plunger.suppress = false;
      cancelCharge();
      return;
    }
    if (!plunger.charging) return;
    const power = Math.max(TAP_POWER, plunger.power);
    cancelCharge();
    fireBall(power);
  }

  function fireBall(power) {
    if (!canPlunge()) return;
    initAudio();
    launchPower = Math.min(1, Math.max(0, power));
    playfieldTime = 0;
    ball.launched = true;
    ball.x = SHOOTER_X;
    ball.y = 746;
    ball.vx = 0;
    // Every plunge clears the lane's kicker, but a weak one crawls up and
    // trickles onto the playfield while a full one arrives with real speed.
    ball.vy = -(840 + 400 * launchPower);
    launchLabel.textContent = 'プレイ中';
    launchControl.disabled = true;
    setPowerUi(launchPower);
    setStatus('プレイ中', 'playing');
    tone(110 + 70 * launchPower, .2, 'sawtooth', .045, 500 + 620 * launchPower);
  }

  function updateCharge(dt) {
    if (!plunger.charging) return;
    if (!canPlunge()) return cancelCharge();
    const before = plunger.power;
    plunger.power = Math.min(1, plunger.power + dt / CHARGE_SECONDS);
    // The resting ball is only drawn, never simulated, so nudging it down the
    // lane is enough to show the spring compressing.
    ball.y = 746 + plunger.power * 10;
    const step = Math.floor(plunger.power * 5);
    if (step > plunger.tick) {
      plunger.tick = step;
      tone(190 + plunger.power * 320, .025, 'square', .012);
    }
    if (before < 1 && plunger.power === 1) {
      launchControl.setAttribute('data-full', 'true');
      tone(880, .07, 'triangle', .03, 120);
    }
    const percent = Math.round(plunger.power * 100);
    if (Math.round(before * 100) !== percent) {
      launchLabel.textContent = `強さ ${percent}%`;
      setPowerUi(plunger.power);
    }
  }

  function togglePause() {
    if (state !== 'playing' && state !== 'paused') return;
    cancelCharge();
    state = state === 'playing' ? 'paused' : 'playing';
    messageEl.classList.toggle('hidden', state === 'playing');
    if (state === 'paused') {
      messageEl.classList.add('compact');
      messageEl.querySelector('.message-kicker').textContent = 'ちょっと休憩';
      messageEl.querySelector('h1').innerHTML = 'ひとやすみ';
      messageEl.querySelector('p:not(.message-kicker)').innerHTML = '猫ものんびり待っています。<br />好きなときに戻ってきてね。';
      startButton.textContent = 'ゲームにもどる';
      launchControl.disabled = true;
      launchLabel.textContent = '一時停止中';
      setStatus('一時停止中', 'paused');
    } else {
      launchControl.disabled = ball.launched;
      launchLabel.textContent = ball.launched ? 'プレイ中' : 'ボール発射';
      setStatus(ball.launched ? 'プレイ中' : '発射ボタンか Space を長押し', ball.launched ? 'playing' : 'ready');
    }
  }

  function gameOver() {
    cancelCharge();
    state = 'gameover';
    messageEl.classList.add('compact');
    messageEl.querySelector('.message-kicker').textContent = '今回のあそびはここまで';
    messageEl.querySelector('h1').innerHTML = 'おしまい';
    messageEl.querySelector('p:not(.message-kicker)').innerHTML = `今回のスコアは <strong>${formatScore(score)}</strong><br />猫たちがもう一度待っています。`;
    startButton.textContent = 'もう一度あそぶ';
    messageEl.classList.remove('hidden');
    launchControl.disabled = false;
    launchLabel.textContent = 'もう一度あそぶ';
    setStatus('ゲーム終了', 'over');
    tone(220, .2, 'triangle', .045, -80);
    setTimeout(() => tone(150, .38, 'triangle', .04, -60), 170);
  }

  function loseBall(reason = '') {
    if (!ball.launched) return;

    ballsLeft--;
    updateHud();
    shake = 12;
    if (ballsLeft <= 0) {
      gameOver();
    } else {
      state = 'between';
      launchControl.disabled = true;
      setStatus(reason || '次のボールをセット中', 'paused');
      tone(180, .25, 'sawtooth', .025, -80);
      setTimeout(() => {
        if (state === 'between') {
          state = 'playing';
          resetBall();
        }
      }, 850);
    }
  }

  function checkWarpHole() {
    if (ball.inShooterLane) return false;
    for (const hole of warpHoles) {
      if (hole.cooldown > 0) continue;
      const dx = ball.x - hole.x;
      const dy = ball.y - hole.y;
      if (dx * dx + dy * dy < (hole.r - 2) ** 2) {
        const target = warpTargets[Math.floor(Math.random() * warpTargets.length)];
        const sourceX = ball.x;
        const sourceY = ball.y;
        burst(hole.x, hole.y, hole.rim, 16);
        ball.x = target.x + (Math.random() - .5) * 18;
        ball.y = target.y + (Math.random() - .5) * 14;
        const angle = -Math.PI + .35 + Math.random() * (Math.PI - .7);
        const speed = 360 + Math.random() * 220;
        ball.vx = Math.cos(angle) * speed;
        ball.vy = Math.sin(angle) * speed;
        ball.trail.length = 0;
        warpHoles.forEach(item => item.cooldown = Math.max(item.cooldown, 1.15));
        burst(ball.x, ball.y, hole.rim, 18);
        particles.push({ x: sourceX, y: sourceY - 22, text: 'どこ!?', life: 1, color: hole.rim, type: 'text' });
        addScore(100, ball.x, ball.y - 24, hole.rim);
        setStatus('猫ワープ！ どこへ飛ぶ？', 'playing');
        tone(180, .1, 'triangle', .03, 240);
        setTimeout(() => tone(620, .12, 'sine', .028, 180), 70);
        return true;
      }
    }
    return false;
  }

  function circleCollision(obj, restitution = 1.2, boost = 0) {
    const dx = ball.x - obj.x;
    const dy = ball.y - obj.y;
    const minDist = ball.r + obj.r;
    const d2 = dx * dx + dy * dy;
    if (d2 >= minDist * minDist || d2 === 0) return false;
    const d = Math.sqrt(d2);
    const nx = dx / d;
    const ny = dy / d;
    ball.x = obj.x + nx * minDist;
    ball.y = obj.y + ny * minDist;
    const rel = ball.vx * nx + ball.vy * ny;
    if (rel < 0) {
      ball.vx -= (1 + restitution) * rel * nx;
      ball.vy -= (1 + restitution) * rel * ny;
    }
    if (boost) {
      ball.vx += nx * boost;
      ball.vy += ny * boost;
    }
    return true;
  }

  function segmentCollision(x1, y1, x2, y2, radius = 3, restitution = .82) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    let t = ((ball.x - x1) * dx + (ball.y - y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = x1 + t * dx;
    const py = y1 + t * dy;
    const ox = ball.x - px;
    const oy = ball.y - py;
    const minDist = ball.r + radius;
    const d2 = ox * ox + oy * oy;
    if (d2 >= minDist * minDist || d2 === 0) return false;
    const d = Math.sqrt(d2);
    const nx = ox / d;
    const ny = oy / d;
    ball.x = px + nx * minDist;
    ball.y = py + ny * minDist;
    const rel = ball.vx * nx + ball.vy * ny;
    if (rel < 0) {
      ball.vx -= (1 + restitution) * rel * nx;
      ball.vy -= (1 + restitution) * rel * ny;
    }
    return true;
  }

  function spinnerEndpoints() {
    const half = catSpinner.length / 2;
    const dx = Math.cos(catSpinner.angle) * half;
    const dy = Math.sin(catSpinner.angle) * half;
    return [catSpinner.x - dx, catSpinner.y - dy, catSpinner.x + dx, catSpinner.y + dy];
  }

  function leftWallCollision() {
    const [x1, y1, x2, y2] = leftWall;
    if (ball.y < y1 || ball.y > y2) return false;
    const t = (ball.y - y1) / (y2 - y1);
    const wallX = x1 + (x2 - x1) * t;
    const insideX = wallX + ball.r + 3;
    if (ball.x >= insideX) return false;
    ball.x = insideX;
    if (ball.vx < 0) ball.vx = Math.abs(ball.vx) * .82;
    return true;
  }

  function flipperCollision(f, angularVelocity) {
    const x2 = f.pivotX + Math.cos(f.angle) * f.length;
    const y2 = f.pivotY + Math.sin(f.angle) * f.length;
    const hit = segmentCollision(f.pivotX, f.pivotY, x2, y2, f.radius, .68);
    if (hit && Math.abs(angularVelocity) > .01) {
      const dx = ball.x - f.pivotX;
      const dy = ball.y - f.pivotY;
      const tangentX = -dy * angularVelocity;
      const tangentY = dx * angularVelocity;
      ball.vx += tangentX * 1.05;
      ball.vy += tangentY * 1.05;
      ball.vy -= 90;
      tone(115, .045, 'square', .025, 30);
    }
  }

  function updateFlippers(dt) {
    leftFlipper.target = input.left ? -.56 : .26;
    rightFlipper.target = input.right ? Math.PI + .56 : Math.PI - .26;
    const speed = 15;
    for (const f of [leftFlipper, rightFlipper]) {
      const previous = f.angle;
      f.angle += (f.target - f.angle) * Math.min(1, speed * dt);
      f.angularVelocity = (f.angle - previous) / Math.max(dt, .001);
    }
  }

  function updatePhysics(dt) {
    updateFlippers(dt);
    updateCharge(dt);
    warpHoles.forEach(hole => hole.cooldown = Math.max(0, hole.cooldown - dt));
    catObstacle.cooldown = Math.max(0, catObstacle.cooldown - dt);
    catObstacle.pulse = Math.max(0, catObstacle.pulse - dt * 3.5);
    catSpinner.cooldown = Math.max(0, catSpinner.cooldown - dt);
    catSpinner.pulse = Math.max(0, catSpinner.pulse - dt * 4);
    catSpinner.angularVelocity += (1.15 - catSpinner.angularVelocity) * Math.min(1, dt * .42);
    catSpinner.angle = (catSpinner.angle + catSpinner.angularVelocity * dt) % TAU;
    bumpers.forEach(b => b.pulse = Math.max(0, b.pulse - dt * 4));
    lanes.forEach(l => l.flash = Math.max(0, l.flash - dt * 4));
    slingshots.forEach(sling => sling.cooldown = Math.max(0, sling.cooldown - dt));
    shooterGate.cooldown = Math.max(0, shooterGate.cooldown - dt);
    shooterGate.pulse = Math.max(0, shooterGate.pulse - dt * 5);
    if (multiplierTimer > 0) {
      multiplierTimer -= dt;
      if (multiplierTimer <= 0) multiplier = 1;
    }
    if (state !== 'playing' || !ball.launched) return;

    playfieldTime += dt;

    const steps = 4;
    const step = dt / steps;
    for (let s = 0; s < steps; s++) {
      // A gradual downward assist prevents long upper-board loops. It fades
      // out before the flippers so the final approach remains controllable.
      const descentAssist = !ball.inShooterLane && ball.y < 640
        ? Math.min(360, Math.max(0, playfieldTime - 1.3) * 180)
        : 0;
      ball.vy += (GRAVITY + descentAssist) * step;
      ball.vx *= 0.9995;
      ball.vy *= 0.9995;
      const speed = Math.hypot(ball.vx, ball.vy);
      if (speed > 1250) {
        ball.vx *= 1250 / speed;
        ball.vy *= 1250 / speed;
      }
      ball.x += ball.vx * step;
      ball.y += ball.vy * step;

      // The shooter lane has a concealed curved kicker at its top. Once the
      // ball reaches it, turn raw plunger speed into a controlled field entry.
      // Capping the vertical component keeps a full-power shot from orbiting
      // the upper board for too long before it reaches the flippers.
      if (ball.inShooterLane && ball.y < 168) {
        ball.inShooterLane = false;
        ball.vx = -(250 + 180 * launchPower);
        ball.vy = -(285 + 105 * launchPower);
        burst(ball.x - 8, ball.y, theme.hot, 7);
        tone(340 + 110 * launchPower, .07, 'triangle', .025, 210);
      }

      // Safety net: should a ball ever stall in the lane, it rolls back to the
      // plunger for a free retry rather than sitting there or draining.
      if (ball.inShooterLane && ball.vy > 0 && ball.y > 746) {
        resetBall();
        setStatus('よわすぎ！ もう一度どうぞ', 'ready');
        tone(150, .12, 'triangle', .022, -40);
        return;
      }

      if (ball.x - ball.r < PLAYFIELD_LEFT) {
        ball.x = PLAYFIELD_LEFT + ball.r;
        ball.vx = Math.abs(ball.vx) * .82;
      }
      if (ball.x + ball.r > PLAYFIELD_RIGHT) {
        ball.x = PLAYFIELD_RIGHT - ball.r;
        ball.vx = -Math.abs(ball.vx) * .82;
      }
      if (ball.y - ball.r < 58) {
        ball.y = 58 + ball.r;
        ball.vy = Math.abs(ball.vy) * .82;
      }

      if (checkWarpHole()) return;

      leftWallCollision();
      rails.forEach(r => segmentCollision(...r));
      lowerGuideSegments.forEach(({ line, radius }) => segmentCollision(...line, radius));

      // After launch, close the mouth of the shooter lane. The ball can leave
      // through it on the way up, but a returning ball is kicked back into the
      // playfield before it can fall down the lane and drain.
      if (
        !ball.inShooterLane && ball.vy > 0 && ball.y < shooterGate.y1 + ball.r + 5 &&
        segmentCollision(shooterGate.x1, shooterGate.y1, shooterGate.x2, shooterGate.y2, 4, .86)
      ) {
        ball.vx = -Math.max(260, Math.abs(ball.vx) * .82);
        ball.vy = -Math.max(280, Math.abs(ball.vy));
        if (shooterGate.cooldown === 0) {
          shooterGate.cooldown = .18;
          shooterGate.pulse = 1;
          burst(517, 174, theme.cyan, 6);
          tone(330, .045, 'triangle', .018, 120);
        }
      }

      slingshots.forEach(sling => {
        let hit = false;
        sling.segments.forEach(segment => {
          if (segmentCollision(...segment, 8, SLING_RESTITUTION)) hit = true;
        });
        if (hit && sling.cooldown === 0) {
          sling.cooldown = .2;
          ball.vx += sling.push;
          ball.vy -= SLING_LIFT;
          addScore(100, sling.x, sling.y - 18, theme.salmon);
          burst(sling.x, sling.y, theme.salmon, 8);
          tone(260, .055, 'triangle', .025, 100);
        }
      });
      posts.forEach(p => {
        if (circleCollision(p, POST_RESTITUTION)) tone(170, .025, 'square', .012);
      });
      if (circleCollision(catObstacle, 1.02, 118) && catObstacle.cooldown === 0) {
        catObstacle.cooldown = .9;
        catObstacle.pulse = 1;
        shake = 6;
        addScore(250, catObstacle.x, catObstacle.y - 48, theme.brass);
        burst(catObstacle.x, catObstacle.y, theme.hot, 15);
        particles.push({
          x: catObstacle.x,
          y: catObstacle.y - 68,
          text: 'にゃ〜！',
          life: 1.15,
          color: theme.cream,
          type: 'text'
        });
        setStatus('にゃ〜！ 猫バンパー！', 'playing');
        meow();
      }
      const spinnerLine = spinnerEndpoints();
      if (segmentCollision(...spinnerLine, catSpinner.radius, .94)) {
        const cos = Math.cos(catSpinner.angle);
        const sin = Math.sin(catSpinner.angle);
        const along = (ball.x - catSpinner.x) * cos + (ball.y - catSpinner.y) * sin;
        const incomingTorque = along * (-ball.vx * sin + ball.vy * cos) * .00022;
        catSpinner.angularVelocity = Math.max(
          -8,
          Math.min(8, catSpinner.angularVelocity + incomingTorque)
        );
        const surfaceSpeed = Math.max(-180, Math.min(180, catSpinner.angularVelocity * along));
        ball.vx += -sin * surfaceSpeed * .7;
        ball.vy += cos * surfaceSpeed * .7;
        if (catSpinner.cooldown === 0) {
          catSpinner.cooldown = .18;
          catSpinner.pulse = 1;
          addScore(175, catSpinner.x, catSpinner.y - 28, theme.hot);
          burst(ball.x, ball.y, theme.brass, 9);
          setStatus('くるくる猫風車！', 'playing');
          tone(310, .07, 'triangle', .026, 210);
        }
      }
      bumpers.forEach(b => {
        if (circleCollision(b, 1.03, BUMPER_BOOST)) {
          if (b.pulse <= .1) {
            b.pulse = 1;
            shake = 6;
            addScore(b.value, b.x, b.y - 38, b.color);
            burst(b.x, b.y, b.color, 12);
            tone(b.value === 500 ? 720 : 520, .09, 'square', .035, 180);
          }
        }
      });

      flipperCollision(leftFlipper, leftFlipper.angularVelocity);
      flipperCollision(rightFlipper, rightFlipper.angularVelocity);

      for (const lane of lanes) {
        if (Math.abs(ball.x - lane.x) < 19 && ball.y > 96 && ball.y < 154 && !lane.lit) {
          lane.lit = true;
          lane.flash = 1;
          addScore(150, lane.x, 112, theme.cyan);
          tone(430 + lanes.indexOf(lane) * 55, .07, 'sine', .026, 80);
          if (lanes.every(l => l.lit)) {
            multiplier = Math.min(5, multiplier + 1);
            multiplierTimer = 15;
            lanes.forEach(l => l.lit = false);
            particles.push({ x: 280, y: 190, text: `${multiplier}倍！`, life: 1.5, color: theme.hot, type: 'text' });
            burst(280, 190, theme.hot, 22);
          }
        }
      }
    }

    ball.trail.unshift({ x: ball.x, y: ball.y });
    if (ball.trail.length > 10) ball.trail.pop();
    if (ball.y > H + 30) loseBall();
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt * (p.type === 'text' ? .9 : 1.5);
      if (p.type === 'spark') {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 150 * dt;
      } else {
        p.y -= 28 * dt;
      }
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function roundedRectPath(x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }

  function drawTaperedGuide({ guide, points, radii }) {
    const left = [];
    const right = [];
    points.forEach((point, i) => {
      const before = points[Math.max(0, i - 1)];
      const after = points[Math.min(points.length - 1, i + 1)];
      const dx = after[0] - before[0];
      const dy = after[1] - before[1];
      const length = Math.hypot(dx, dy) || 1;
      const nx = -dy / length;
      const ny = dx / length;
      left.push([point[0] + nx * radii[i], point[1] + ny * radii[i]]);
      right.push([point[0] - nx * radii[i], point[1] - ny * radii[i]]);
    });

    const gradient = ctx.createLinearGradient(
      guide.start[0], guide.start[1], guide.end[0], guide.end[1]
    );
    gradient.addColorStop(0, theme.brass);
    gradient.addColorStop(1, theme.hot);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(...left[0]);
    left.slice(1).forEach(point => ctx.lineTo(...point));
    [...right].reverse().forEach(point => ctx.lineTo(...point));
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,241,201,.72)';
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(guide.start[0], guide.start[1] - 2);
    ctx.bezierCurveTo(
      guide.control1[0], guide.control1[1] - 2,
      guide.control2[0], guide.control2[1] - 2,
      guide.end[0], guide.end[1] - 2
    );
    ctx.stroke();
  }

  function drawWarpHole(hole) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.85)';
    ctx.shadowBlur = 12;
    const depth = ctx.createRadialGradient(
      hole.x - 5, hole.y - 6, 2, hole.x, hole.y, hole.r
    );
    depth.addColorStop(0, '#21172f');
    depth.addColorStop(.58, '#0d0a18');
    depth.addColorStop(1, '#05040a');
    ctx.fillStyle = depth;
    ctx.beginPath();
    ctx.arc(hole.x, hole.y, hole.r, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 4;
    ctx.strokeStyle = hole.rim;
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255,241,201,.7)';
    ctx.beginPath();
    ctx.arc(hole.x, hole.y, hole.r - 6, 0, TAU);
    ctx.stroke();

    ctx.globalAlpha = hole.cooldown > 0 ? .35 : .82;
    ctx.fillStyle = theme.paper;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 17px "DotGothic16", sans-serif';
    ctx.fillText('?', hole.x, hole.y + 1);
    ctx.restore();
  }

  function drawCatObstacle() {
    const pulse = catObstacle.pulse;
    const scale = (catObstacle.r / 45) * (1 + pulse * .08);
    ctx.save();
    ctx.translate(catObstacle.x, catObstacle.y);
    ctx.scale(scale, scale);

    ctx.shadowColor = pulse > 0 ? theme.hot : 'rgba(255,210,95,.45)';
    ctx.shadowBlur = 10 + pulse * 22;
    ctx.fillStyle = 'rgba(23,19,41,.72)';
    ctx.strokeStyle = pulse > 0 ? theme.cream : 'rgba(255,210,95,.38)';
    ctx.lineWidth = 2 + pulse * 2;
    ctx.beginPath();
    ctx.ellipse(0, 8, 53, 38, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (catMascot.complete && catMascot.naturalWidth) {
      ctx.globalAlpha = .98;
      ctx.drawImage(catMascot, -75, -51, 150, 100);
    }
    ctx.restore();
  }

  function drawCatSpinner() {
    const pulse = catSpinner.pulse;
    const size = catSpinner.length / 96;
    ctx.save();
    ctx.translate(catSpinner.x, catSpinner.y);
    ctx.rotate(catSpinner.angle);
    ctx.scale(size * (1 + pulse * .055), size * (1 + pulse * .055));

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = pulse > 0 ? theme.brass : 'rgba(239,109,92,.38)';
    ctx.shadowBlur = 8 + pulse * 15;

    // Curled tail, long body and a small face make the rotating bar read as
    // a cat first and a mechanical spinner second.
    ctx.strokeStyle = '#c96843';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(-37, 1);
    ctx.bezierCurveTo(-52, -2, -55, 13, -45, 15);
    ctx.stroke();

    const body = ctx.createLinearGradient(-42, 0, 50, 0);
    body.addColorStop(0, '#d77745');
    body.addColorStop(.55, '#f0a15f');
    body.addColorStop(1, '#e58648');
    ctx.fillStyle = body;
    ctx.strokeStyle = theme.cream;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-42, -14, 78, 28, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#e58a4b';
    ctx.beginPath();
    ctx.arc(38, 0, 17, 0, TAU);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#e58a4b';
    ctx.beginPath();
    ctx.moveTo(25, -10);
    ctx.lineTo(28, -24);
    ctx.lineTo(37, -15);
    ctx.moveTo(40, -16);
    ctx.lineTo(49, -23);
    ctx.lineTo(51, -9);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = 'rgba(122,66,49,.62)';
    ctx.lineWidth = 3;
    [-25, -12, 2].forEach(x => {
      ctx.beginPath();
      ctx.moveTo(x, -11);
      ctx.lineTo(x + 4, -4);
      ctx.stroke();
    });

    ctx.shadowBlur = 0;
    ctx.fillStyle = theme.ink;
    ctx.beginPath();
    ctx.arc(33, -2, 1.8, 0, TAU);
    ctx.arc(44, -2, 1.8, 0, TAU);
    ctx.fill();
    ctx.fillStyle = theme.hot;
    ctx.beginPath();
    ctx.arc(39, 4, 2, 0, TAU);
    ctx.fill();

    ctx.fillStyle = theme.night;
    ctx.strokeStyle = theme.brass;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = theme.cream;
    ctx.beginPath();
    ctx.arc(0, 0, 2.2, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawBoard() {
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, '#3b2b50');
    gradient.addColorStop(.48, '#281e40');
    gradient.addColorStop(1, theme.night);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    const glow = ctx.createRadialGradient(280, 240, 20, 280, 300, 440);
    glow.addColorStop(0, 'rgba(223,80,66,.12)');
    glow.addColorStop(.52, 'rgba(255,210,95,.035)');
    glow.addColorStop(1, 'rgba(18,15,36,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    for (const star of stars) {
      ctx.globalAlpha = star.a;
      ctx.fillStyle = star.r > 1 ? theme.brass : theme.paper;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.strokeStyle = 'rgba(255,210,95,.10)';
    ctx.lineWidth = 1;
    for (let r = 100; r < 520; r += 76) {
      ctx.beginPath();
      ctx.arc(280, 334, r, Math.PI * 1.05, Math.PI * 1.95);
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(280, 520);
    ctx.rotate(-.08);
    ctx.textAlign = 'center';
    ctx.font = '800 48px "M PLUS Rounded 1c", sans-serif';
    ctx.fillStyle = 'rgba(255,241,201,.055)';
    ctx.fillText('NEKO ASOBI', 0, 0);
    ctx.restore();

    warpHoles.forEach(drawWarpHole);
    drawCatObstacle();

    ctx.strokeStyle = theme.brass;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    drawnRails.forEach(([x1,y1,x2,y2]) => {
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    });
    ctx.strokeStyle = 'rgba(255,241,201,.68)';
    ctx.lineWidth = 1.5;
    drawnRails.forEach(([x1,y1,x2,y2]) => {
      ctx.beginPath(); ctx.moveTo(x1,y1-2); ctx.lineTo(x2,y2-2); ctx.stroke();
    });
    lowerGuidePaths.forEach(drawTaperedGuide);

    ctx.save();
    ctx.lineCap = 'round';
    ctx.shadowColor = theme.cyan;
    ctx.shadowBlur = shooterGate.pulse * 14;
    ctx.strokeStyle = shooterGate.pulse > 0 ? theme.cyan : theme.brown;
    ctx.lineWidth = 5 + shooterGate.pulse * 2;
    ctx.beginPath();
    ctx.moveTo(shooterGate.x1 + 2, shooterGate.y1);
    ctx.lineTo(shooterGate.x2 - 2, shooterGate.y2);
    ctx.stroke();
    ctx.fillStyle = theme.salmon;
    ctx.beginPath();
    ctx.arc(shooterGate.x1 + 2, shooterGate.y1, 6, 0, TAU);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = theme.salmon;
    ctx.lineWidth = 10;
    slingshots.forEach(sling => sling.segments.forEach(([x1, y1, x2, y2]) => {
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }));
    ctx.strokeStyle = theme.cream;
    ctx.lineWidth = 2;
    slingshots.forEach(sling => sling.segments.forEach(([x1, y1, x2, y2]) => {
      ctx.beginPath(); ctx.moveTo(x1, y1 - 2); ctx.lineTo(x2, y2 - 2); ctx.stroke();
    }));

    ctx.fillStyle = 'rgba(240,139,56,.08)';
    roundedRectPath(500, 115, 43, 658, 21);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,241,201,.28)';
    ctx.lineWidth = 2;
    ctx.stroke();

    if (!canPlunge()) {
      ctx.save();
      ctx.translate(SHOOTER_X, 446);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.font = '700 13px "M PLUS Rounded 1c", sans-serif';
      ctx.letterSpacing = '3px';
      ctx.fillStyle = 'rgba(255,241,201,.58)';
      ctx.fillText('BALL  はっしゃ', 0, 0);
      ctx.restore();
    }
  }

  const GAUGE = { x: 508, y: 250, w: 18, h: 450 };

  function powerColor(power) {
    if (power >= .999) return theme.cyan;
    if (power >= .5) return theme.hot;
    return theme.salmon;
  }

  // The plunger gauge lives in the shooter lane so the player watches the
  // strength build right where the ball is waiting.
  function drawPlungerGauge() {
    if (!canPlunge()) return;
    const power = plunger.power;

    ctx.save();
    ctx.letterSpacing = '0px';
    ctx.fillStyle = 'rgba(255,241,201,.94)';
    roundedRectPath(GAUGE.x, GAUGE.y, GAUGE.w, GAUGE.h, 9);
    ctx.fill();

    const filled = GAUGE.h * power;
    if (filled > 1) {
      ctx.save();
      roundedRectPath(GAUGE.x, GAUGE.y, GAUGE.w, GAUGE.h, 9);
      ctx.clip();
      ctx.fillStyle = powerColor(power);
      ctx.fillRect(GAUGE.x, GAUGE.y + GAUGE.h - filled, GAUGE.w, filled);
      ctx.restore();
    }

    ctx.strokeStyle = theme.ink;
    ctx.lineWidth = 2;
    roundedRectPath(GAUGE.x, GAUGE.y, GAUGE.w, GAUGE.h, 9);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(48,40,31,.35)';
    ctx.lineWidth = 1.5;
    [.25, .5, .75].forEach(mark => {
      const y = GAUGE.y + GAUGE.h * (1 - mark);
      ctx.beginPath();
      ctx.moveTo(GAUGE.x + 3, y);
      ctx.lineTo(GAUGE.x + GAUGE.w - 3, y);
      ctx.stroke();
    });

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = plunger.charging ? theme.ink : 'rgba(48,40,31,.5)';
    ctx.font = '800 15px "M PLUS Rounded 1c", sans-serif';
    ctx.fillText(`${Math.round(power * 100)}%`, GAUGE.x + GAUGE.w / 2, GAUGE.y - 12);
    ctx.font = '700 11px "M PLUS Rounded 1c", sans-serif';
    ctx.fillStyle = 'rgba(48,40,31,.5)';
    ctx.fillText('つよさ', GAUGE.x + GAUGE.w / 2, GAUGE.y + GAUGE.h + 22);

    // The spring under the ball squashes down as the plunger is drawn back.
    const top = ball.y + ball.r;
    const bottom = 772;
    const coils = 3;
    ctx.strokeStyle = theme.brown;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(SHOOTER_X, top);
    for (let i = 1; i <= coils; i++) {
      const y = top + (bottom - top) * (i / coils);
      ctx.lineTo(i % 2 ? SHOOTER_X - 8 : SHOOTER_X + 8, y - (bottom - top) / (coils * 2));
      ctx.lineTo(SHOOTER_X, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawLanes() {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lanes.forEach((lane, i) => {
      const lit = lane.lit || lane.flash > 0;
      ctx.shadowBlur = lit ? 6 : 0;
      ctx.shadowColor = theme.cyan;
      ctx.fillStyle = lit ? theme.cyan : 'rgba(106,199,173,.12)';
      ctx.beginPath();
      ctx.arc(lane.x, 117, 17 + lane.flash * 5, 0, TAU);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(106,199,173,.6)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = lit ? theme.ink : theme.cyan;
      ctx.font = '800 18px "M PLUS Rounded 1c", sans-serif';
      ctx.fillText('NEKO!'[i], lane.x, 118);
    });
  }

  function drawBumper(b) {
    const p = b.pulse;
    const size = b.r / (b.mark === '★' ? 39 : 35);
    const outerR = b.r + p * 6;
    ctx.save();
    ctx.shadowBlur = 5 + p * 16;
    ctx.shadowColor = b.color;

    if (b.mark !== '★') {
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.moveTo(b.x - 23 * size, b.y - b.r + 9 * size);
      ctx.lineTo(b.x - 14 * size, b.y - b.r - 9 * size);
      ctx.lineTo(b.x - 3 * size, b.y - b.r + 7 * size);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(b.x + 3 * size, b.y - b.r + 7 * size);
      ctx.lineTo(b.x + 14 * size, b.y - b.r - 9 * size);
      ctx.lineTo(b.x + 23 * size, b.y - b.r + 9 * size);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(29,23,52,.96)';
    ctx.beginPath();
    ctx.arc(b.x, b.y, outerR, 0, TAU);
    ctx.fill();
    ctx.lineWidth = 7 * size;
    ctx.strokeStyle = b.color;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.lineWidth = 2 * size;
    ctx.strokeStyle = 'rgba(255,241,201,.72)';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r - 10 * size, 0, TAU);
    ctx.stroke();

    if (b.mark === '★') {
      ctx.fillStyle = b.color;
      [[0, -25], [25, 0], [0, 25], [-25, 0]].forEach(([dx, dy]) => {
        ctx.beginPath();
        ctx.arc(b.x + dx * size, b.y + dy * size, 2.5 * size, 0, TAU);
        ctx.fill();
      });
    }

    ctx.fillStyle = theme.paper;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = b.mark === '★'
      ? `${27 * size}px "Dela Gothic One", sans-serif`
      : `700 ${15 * size}px "DotGothic16", "M PLUS Rounded 1c", sans-serif`;
    ctx.fillText(b.mark, b.x, b.y + (b.mark === '★' ? 2 : 3));
    ctx.restore();
  }

  function drawPost(p) {
    ctx.shadowBlur = 0;
    ctx.fillStyle = theme.brass;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = theme.ink;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r * .38, 0, TAU); ctx.fill();
  }

  function drawFlipper(f) {
    const x2 = f.pivotX + Math.cos(f.angle) * f.length;
    const y2 = f.pivotY + Math.sin(f.angle) * f.length;
    const gradient = ctx.createLinearGradient(f.pivotX, f.pivotY, x2, y2);
    gradient.addColorStop(0, theme.hot);
    gradient.addColorStop(1, theme.brass);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = f.radius * 2;
    ctx.lineCap = 'round';
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.moveTo(f.pivotX, f.pivotY); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = theme.cream;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(f.pivotX, f.pivotY - 2); ctx.lineTo(x2, y2 - 2); ctx.stroke();
  }

  function drawBall() {
    ball.trail.forEach((point, i) => {
      ctx.globalAlpha = (1 - i / ball.trail.length) * .22;
      ctx.fillStyle = theme.cyan;
      ctx.beginPath();
      ctx.arc(point.x, point.y, Math.max(1, ball.r * (1 - i / 12)), 0, TAU);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    const g = ctx.createRadialGradient(ball.x - 4, ball.y - 5, 1, ball.x, ball.y, ball.r);
    g.addColorStop(0, '#fff');
    g.addColorStop(.45, theme.cream);
    g.addColorStop(1, '#778092');
    ctx.fillStyle = g;
    ctx.shadowBlur = 14;
    ctx.shadowColor = '#fff';
    ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
  }

  function drawParticles() {
    ctx.textAlign = 'center';
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      if (p.type === 'text') {
        ctx.fillStyle = p.color;
        ctx.font = '800 24px "M PLUS Rounded 1c", sans-serif';
        ctx.fillText(p.text, p.x, p.y);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, 3.2 * p.life, 0, TAU); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function draw() {
    ctx.save();
    if (shake > .1) {
      ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
      shake *= .88;
    }
    drawBoard();
    drawPlungerGauge();
    drawLanes();
    bumpers.forEach(drawBumper);
    drawCatSpinner();
    posts.forEach(drawPost);
    drawFlipper(leftFlipper);
    drawFlipper(rightFlipper);

    if (multiplier > 1) {
      ctx.textAlign = 'center';
      ctx.fillStyle = theme.hot;
      ctx.font = '800 24px "M PLUS Rounded 1c", sans-serif';
      ctx.fillText(`スコア ${multiplier}倍`, 280, 52);
    } else {
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,241,201,.6)';
      ctx.font = '700 14px "M PLUS Rounded 1c", sans-serif';
      ctx.fillText('「NEKO!」をそろえるとスコア倍率アップ', 280, 52);
    }
    drawBall();
    drawParticles();
    ctx.restore();
  }

  function frame(time) {
    const dt = Math.min(.025, (time - lastTime) / 1000 || 0);
    lastTime = time;
    updatePhysics(dt);
    updateParticles(dt);
    draw();
    requestAnimationFrame(frame);
  }

  function setInput(side, active) {
    input[side] = active;
    (side === 'left' ? leftControl : rightControl).classList.toggle('is-active', active);
    if (active && state === 'playing') tone(92, .025, 'square', .012, 30);
  }

  const keyMap = {
    ArrowLeft: 'left', a: 'left', A: 'left',
    ArrowRight: 'right', d: 'right', D: 'right'
  };

  window.addEventListener('keydown', (event) => {
    if (keyMap[event.key]) {
      event.preventDefault();
      if (!event.repeat) setInput(keyMap[event.key], true);
    } else if (event.code === 'Space') {
      // Swallowing the default also stops a focused button from self-clicking,
      // so Space always runs through the charge/release pair.
      event.preventDefault();
      if (!event.repeat) beginCharge();
    } else if (event.key === 'Escape') {
      togglePause();
    }
  });

  window.addEventListener('keyup', (event) => {
    if (keyMap[event.key]) {
      event.preventDefault();
      setInput(keyMap[event.key], false);
    } else if (event.code === 'Space') {
      event.preventDefault();
      releaseCharge();
    }
  });

  function bindHold(button, side) {
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      setInput(side, true);
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => {
      button.addEventListener(type, () => setInput(side, false));
    });
  }

  bindHold(leftControl, 'left');
  bindHold(rightControl, 'right');
  startButton.addEventListener('click', () => state === 'paused' ? togglePause() : newGame());
  let lastPointerPlunge = -Infinity;
  launchControl.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    launchControl.setPointerCapture(event.pointerId);
    beginCharge();
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => {
    launchControl.addEventListener(type, () => {
      lastPointerPlunge = performance.now();
      releaseCharge();
    });
  });
  // Keyboard activation (Enter on the focused button) never holds, so it fires
  // at a middling strength instead.
  launchControl.addEventListener('click', () => {
    if (performance.now() - lastPointerPlunge < 700) return;
    if (state === 'title' || state === 'gameover') return newGame();
    if (state === 'paused') return togglePause();
    if (canPlunge()) fireBall(CLICK_POWER);
  });
  soundButton.addEventListener('click', () => {
    soundOn = !soundOn;
    soundButton.setAttribute('aria-pressed', String(soundOn));
    soundButton.setAttribute('aria-label', soundOn ? '音をオフにする' : '音をオンにする');
    soundButton.firstElementChild.textContent = soundOn ? '♪' : '×';
    if (soundOn) {
      tone(440, .08, 'sine', .04, 160);
    } else {
      catMeow.pause();
      catMeow.currentTime = 0;
    }
  });
  window.addEventListener('blur', () => {
    setInput('left', false);
    setInput('right', false);
    cancelCharge();
    if (state === 'playing' && ball.launched) togglePause();
  });

  bestEl.textContent = formatScore(best);
  updateHud();
  resetBall();
  requestAnimationFrame(frame);
})();

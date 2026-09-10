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
  const leftControl = document.getElementById('leftControl');
  const rightControl = document.getElementById('rightControl');
  const statusText = document.getElementById('statusText');
  const soundButton = document.getElementById('soundButton');

  const W = 560;
  const H = 860;
  const TAU = Math.PI * 2;
  const theme = {
    night: '#070b16', ink: '#0b1020', panel: '#11182b', cream: '#f6eedc',
    brass: '#f0bd62', hot: '#ff4f81', cyan: '#64e3df', muted: '#8991a5'
  };

  let score = 0;
  let best = Number(localStorage.getItem('neko-pinball-best') || 0);
  let ballsLeft = 3;
  let state = 'title';
  let lastTime = performance.now();
  let shake = 0;
  let multiplier = 1;
  let multiplierTimer = 0;
  let soundOn = true;
  let audioContext = null;
  const input = { left: false, right: false };
  const particles = [];
  const stars = Array.from({ length: 55 }, (_, i) => ({
    x: (i * 137.5) % W,
    y: 40 + ((i * 83.7) % 610),
    r: (i % 4 === 0 ? 1.6 : .8),
    a: .18 + (i % 5) * .1
  }));

  const ball = {
    x: 501, y: 744, vx: 0, vy: 0, r: 10,
    launched: false, inShooterLane: true, trail: []
  };

  const bumpers = [
    { x: 190, y: 260, r: 42, color: theme.hot, value: 300, pulse: 0 },
    { x: 367, y: 267, r: 42, color: theme.cyan, value: 300, pulse: 0 },
    { x: 278, y: 394, r: 47, color: theme.brass, value: 500, pulse: 0 }
  ];

  const posts = [
    { x: 116, y: 480, r: 11 }, { x: 442, y: 480, r: 11 },
    { x: 142, y: 618, r: 9 }, { x: 416, y: 618, r: 9 },
    { x: 278, y: 555, r: 10 }
  ];

  const rails = [
    [42, 138, 65, 646], [65, 646, 150, 735],
    [518, 138, 518, 776], [468, 180, 468, 658],
    [92, 526, 160, 606], [160, 606, 197, 625],
    [466, 526, 398, 606], [398, 606, 361, 625],
    [80, 190, 113, 163], [113, 163, 155, 143],
    [405, 143, 447, 163]
  ];

  const lanes = [126, 201, 276, 351, 426].map((x, i) => ({ x, lit: i === 2, flash: 0 }));
  const leftFlipper = { pivotX: 205, pivotY: 712, length: 100, radius: 13, angle: .26, target: .26, side: -1 };
  const rightFlipper = { pivotX: 355, pivotY: 712, length: 100, radius: 13, angle: Math.PI - .26, target: Math.PI - .26, side: 1 };

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

  function formatScore(value) {
    return Math.floor(value).toString().padStart(6, '0');
  }

  function updateHud() {
    scoreEl.textContent = formatScore(score);
    bestEl.textContent = formatScore(best);
    ballsEl.textContent = Array.from({ length: 3 }, (_, i) => i < ballsLeft ? '●' : '○').join(' ');
  }

  function addScore(points, x, y, color = theme.brass) {
    const gained = points * multiplier;
    score += gained;
    if (score > best) {
      best = score;
      localStorage.setItem('neko-pinball-best', String(best));
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
    ball.x = 501;
    ball.y = 746;
    ball.vx = 0;
    ball.vy = 0;
    ball.launched = false;
    ball.inShooterLane = true;
    ball.trail.length = 0;
    launchLabel.textContent = 'ボール発射';
    statusText.textContent = 'Space を押して発射';
  }

  function newGame() {
    initAudio();
    score = 0;
    ballsLeft = 3;
    multiplier = 1;
    lanes.forEach((lane, i) => lane.lit = i === 2);
    state = 'playing';
    messageEl.classList.add('hidden');
    resetBall();
    updateHud();
    tone(330, .08, 'square', .035, 220);
    setTimeout(() => tone(660, .12, 'square', .025, 180), 80);
  }

  function launch() {
    if (state === 'title' || state === 'gameover') return newGame();
    if (state === 'paused') return togglePause();
    if (!ball.launched) {
      initAudio();
      ball.launched = true;
      ball.vx = 0;
      ball.vy = -930;
      launchLabel.textContent = 'プレイ中';
      statusText.textContent = '深夜営業中';
      tone(135, .2, 'sawtooth', .045, 760);
    }
  }

  function togglePause() {
    if (state !== 'playing' && state !== 'paused') return;
    state = state === 'playing' ? 'paused' : 'playing';
    messageEl.classList.toggle('hidden', state === 'playing');
    if (state === 'paused') {
      messageEl.querySelector('.message-kicker').textContent = 'Take a break';
      messageEl.querySelector('h1').innerHTML = 'PAUSE';
      messageEl.querySelector('p:not(.message-kicker)').innerHTML = 'ひと休み中。<br />ボールはそこで待っています。';
      startButton.textContent = 'ゲームにもどる';
      statusText.textContent = '一時停止中';
    } else {
      statusText.textContent = ball.launched ? '深夜営業中' : 'Space を押して発射';
    }
  }

  function gameOver() {
    state = 'gameover';
    messageEl.querySelector('.message-kicker').textContent = 'Closed for tonight';
    messageEl.querySelector('h1').innerHTML = 'GAME<br />OVER';
    messageEl.querySelector('p:not(.message-kicker)').innerHTML = `今回のスコアは <strong>${formatScore(score)}</strong><br />もう一度、夜の街へ。`;
    startButton.textContent = 'もう一度あそぶ';
    messageEl.classList.remove('hidden');
    statusText.textContent = '本日の営業は終了しました';
    tone(220, .2, 'triangle', .045, -80);
    setTimeout(() => tone(150, .38, 'triangle', .04, -60), 170);
  }

  function loseBall() {
    if (!ball.launched) return;
    ballsLeft--;
    updateHud();
    shake = 12;
    if (ballsLeft <= 0) {
      gameOver();
    } else {
      state = 'between';
      statusText.textContent = '次のボールを準備中';
      tone(180, .25, 'sawtooth', .025, -80);
      setTimeout(() => {
        if (state === 'between') {
          state = 'playing';
          resetBall();
        }
      }, 850);
    }
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
    bumpers.forEach(b => b.pulse = Math.max(0, b.pulse - dt * 4));
    lanes.forEach(l => l.flash = Math.max(0, l.flash - dt * 4));
    if (multiplierTimer > 0) {
      multiplierTimer -= dt;
      if (multiplierTimer <= 0) multiplier = 1;
    }
    if (state !== 'playing' || !ball.launched) return;

    const steps = 4;
    const step = dt / steps;
    for (let s = 0; s < steps; s++) {
      ball.vy += 510 * step;
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
      // ball reaches it, guide the ball cleanly through the narrow one-way gap.
      if (ball.inShooterLane && ball.y < 168) {
        ball.inShooterLane = false;
        ball.vx = -340;
        ball.vy = Math.min(ball.vy, -430);
        burst(ball.x - 8, ball.y, theme.hot, 7);
        tone(390, .07, 'triangle', .025, 210);
      }

      if (ball.x - ball.r < 43) {
        ball.x = 43 + ball.r;
        ball.vx = Math.abs(ball.vx) * .82;
      }
      if (ball.x + ball.r > 519) {
        ball.x = 519 - ball.r;
        ball.vx = -Math.abs(ball.vx) * .82;
      }
      if (ball.y - ball.r < 58) {
        ball.y = 58 + ball.r;
        ball.vy = Math.abs(ball.vy) * .82;
      }

      rails.forEach(r => segmentCollision(...r));
      posts.forEach(p => {
        if (circleCollision(p, .92)) tone(170, .025, 'square', .012);
      });
      bumpers.forEach(b => {
        if (circleCollision(b, 1.05, 205)) {
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
            particles.push({ x: 280, y: 190, text: `${multiplier}× MULTI`, life: 1.5, color: theme.hot, type: 'text' });
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

  function drawBoard() {
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, '#111a31');
    gradient.addColorStop(1, theme.ink);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    for (const star of stars) {
      ctx.globalAlpha = star.a;
      ctx.fillStyle = theme.cream;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.strokeStyle = 'rgba(240,189,98,.12)';
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
    ctx.font = '56px "Bebas Neue", sans-serif';
    ctx.fillStyle = 'rgba(240,189,98,.055)';
    ctx.fillText('OPEN ALL NIGHT', 0, 0);
    ctx.restore();

    ctx.strokeStyle = theme.brass;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    rails.forEach(([x1,y1,x2,y2]) => {
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    });
    ctx.strokeStyle = 'rgba(255,255,255,.22)';
    ctx.lineWidth = 1.5;
    rails.forEach(([x1,y1,x2,y2]) => {
      ctx.beginPath(); ctx.moveTo(x1,y1-2); ctx.lineTo(x2,y2-2); ctx.stroke();
    });

    ctx.fillStyle = 'rgba(255,79,129,.08)';
    roundedRectPath(476, 115, 43, 658, 21);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,79,129,.42)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.save();
    ctx.translate(501, 446);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.font = '14px "Bebas Neue", sans-serif';
    ctx.letterSpacing = '3px';
    ctx.fillStyle = 'rgba(255,79,129,.7)';
    ctx.fillText('LAUNCH LANE', 0, 0);
    ctx.restore();
  }

  function drawLanes() {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lanes.forEach((lane, i) => {
      const lit = lane.lit || lane.flash > 0;
      ctx.shadowBlur = lit ? 18 : 0;
      ctx.shadowColor = theme.cyan;
      ctx.fillStyle = lit ? theme.cyan : 'rgba(100,227,223,.11)';
      ctx.beginPath();
      ctx.arc(lane.x, 117, 17 + lane.flash * 5, 0, TAU);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(100,227,223,.65)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = lit ? theme.ink : theme.cyan;
      ctx.font = '18px "Bebas Neue", sans-serif';
      ctx.fillText('NIGHT'[i], lane.x, 118);
    });
  }

  function drawBumper(b) {
    const p = b.pulse;
    ctx.shadowBlur = 16 + p * 30;
    ctx.shadowColor = b.color;
    ctx.fillStyle = '#10182b';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r + p * 6, 0, TAU); ctx.fill();
    ctx.lineWidth = 7;
    ctx.strokeStyle = b.color;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2;
    ctx.strokeStyle = theme.cream;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r - 10, 0, TAU); ctx.stroke();

    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(b.x - 11, b.y - 5, 4, 0, TAU);
    ctx.arc(b.x + 11, b.y - 5, 4, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = b.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(b.x, b.y + 5, 13, .2, Math.PI - .2);
    ctx.stroke();
  }

  function drawPost(p) {
    ctx.shadowBlur = 9;
    ctx.shadowColor = theme.brass;
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
    ctx.shadowBlur = 10;
    ctx.shadowColor = theme.hot;
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
        ctx.font = '26px "Bebas Neue", sans-serif';
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
    drawLanes();
    bumpers.forEach(drawBumper);
    posts.forEach(drawPost);
    drawFlipper(leftFlipper);
    drawFlipper(rightFlipper);

    if (multiplier > 1) {
      ctx.textAlign = 'center';
      ctx.fillStyle = theme.hot;
      ctx.font = '28px "Bebas Neue", sans-serif';
      ctx.fillText(`${multiplier}× MULTIPLIER`, 280, 52);
    } else {
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(246,238,220,.5)';
      ctx.font = '15px "Bebas Neue", sans-serif';
      ctx.fillText('LIGHT NIGHT FOR SCORE MULTIPLIER', 280, 52);
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
      event.preventDefault();
      if (!event.repeat) launch();
    } else if (event.key === 'Escape') {
      togglePause();
    }
  });

  window.addEventListener('keyup', (event) => {
    if (keyMap[event.key]) {
      event.preventDefault();
      setInput(keyMap[event.key], false);
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
  launchControl.addEventListener('click', launch);
  soundButton.addEventListener('click', () => {
    soundOn = !soundOn;
    soundButton.setAttribute('aria-pressed', String(soundOn));
    soundButton.setAttribute('aria-label', soundOn ? '音をオフにする' : '音をオンにする');
    soundButton.firstElementChild.textContent = soundOn ? '♪' : '×';
    if (soundOn) tone(440, .08, 'sine', .04, 160);
  });
  window.addEventListener('blur', () => {
    setInput('left', false);
    setInput('right', false);
    if (state === 'playing' && ball.launched) togglePause();
  });

  bestEl.textContent = formatScore(best);
  updateHud();
  resetBall();
  requestAnimationFrame(frame);
})();

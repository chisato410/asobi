import * as THREE from "three";
import { GLTFLoader } from "./assets/vendor/GLTFLoader.js";

// ---------------------------------------------------------------------------
// 定数
// ---------------------------------------------------------------------------

const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const IS_SMALL = window.innerWidth < 640;

const CAT_COUNT = IS_SMALL ? 8 : 14;
const CAT_SCALE = 1.5;
const AMBIENT_ACCEL = (REDUCED_MOTION ? 0.05 : 0.16) * 0.6;
const MAX_DRIFT_SPEED = (REDUCED_MOTION ? 0.18 : 0.42);
const DAMPING = 0.35;
// 弾いた/放り投げた「勢い」の減衰速度(1/秒)。小さいほど長く滑る。
const INERTIA_DECAY = REDUCED_MOTION ? 1.4 : 0.6;
const SPIN_DAMPING = 0.3;
const SEPARATION_DIST = 1.15;
const SEPARATION_STRENGTH = 1.6;

// ウィンドウ端(=カメラの見える範囲)と奥行きの壁、猫同士の衝突。
// 半径は猫の見た目サイズ(baseScale)に対する倍率。壁用は、体や尻尾が
// 画面からはみ出さないよう衝突用より少し大きめにしてある。
const Z_MIN = -2.6;
const Z_MAX = 2.2;
const WALL_RESTITUTION = 0.85;
const CAT_RESTITUTION = 0.85;
const WALL_RADIUS = 0.5;
const BODY_RADIUS = 0.4;
// これ未満のそっと触れる程度の衝突では、演出(火花・ぷるん)は出さない
const HIT_FX_MIN_SPEED = 0.35;
const HIT_FX_COOLDOWN = 0.3;
const HALO_BASE = 0xfff2df;
const HALO_FLASH = 0xffd08a;

const TAP_MIN_SPEED = 1.1;
const TAP_MAX_SPEED = 2.0;
const CLICK_MAX_DURATION = 260;
const CLICK_MAX_MOVE_PX = 10;
const LONG_PRESS_DURATION = 420;
const MAX_FLING_SPEED = 3.2;
const MIN_HIT_PX = 34;

const PALETTES = [
  {
    name: "Orange", fur: 0xdd7f3c, stripe: 0x8a4a1f, belly: 0xf6e6c9, nose: 0xe98fa0,
    inner: 0xfac0c0, glow: 0x4df08c, pattern: "tabby",
  },
  {
    name: "Black", fur: 0x1c1c22, stripe: 0x1c1c22, belly: 0x44444e, nose: 0x8a5a68,
    inner: 0x6b3a44, glow: 0xffb327, pattern: "solid",
  },
  {
    name: "Cream", fur: 0xf1e7d3, stripe: 0xdcbd90, belly: 0xfffaef, nose: 0xf0a3ad,
    inner: 0xf29aa2, glow: 0x4d99ff, pattern: "tabby",
  },
  {
    name: "Gray", fur: 0x7a808c, stripe: 0x4a4e58, belly: 0xdadde3, nose: 0xd98fa0,
    inner: 0xd99aa5, glow: 0xa666f2, pattern: "tabby",
  },
];

// ---------------------------------------------------------------------------
// レンダラー / シーン / カメラ
// ---------------------------------------------------------------------------

const host = document.getElementById("scene-host");
const loadingNote = document.getElementById("loadingNote");

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05060f);
scene.fog = new THREE.FogExp2(0x05060f, 0.055);

const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
camera.position.set(0, 0, 7.2);

// 最後に反映したウィンドウサイズ。resize イベントが来なくても、
// サイズが変わったことをアニメーションループ側で検知して追従するために持つ。
const appliedSize = { w: 0, h: 0 };

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  // 背景タブなどで読み込み直後にウィンドウサイズが 0 のことがある。そのまま
  // w / h を計算すると aspect が NaN/Infinity になり、見える範囲に基づく
  // 猫の配置・壁の計算が壊れるので、実サイズが分かるまで更新しない。
  if (!w || !h) return;
  appliedSize.w = w;
  appliedSize.h = h;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

// ---------------------------------------------------------------------------
// ライト
// ---------------------------------------------------------------------------

scene.add(new THREE.HemisphereLight(0x8fb4ff, 0x100a1e, 0.9));
const keyLight = new THREE.DirectionalLight(0xfff3e0, 1.1);
keyLight.position.set(3.5, 4, 5);
scene.add(keyLight);
const rimLight = new THREE.PointLight(0x6f8bff, 6, 20, 2);
rimLight.position.set(-4, -2, -3);
scene.add(rimLight);

// ---------------------------------------------------------------------------
// 星空
// ---------------------------------------------------------------------------

function makeSoftDotTexture() {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.4, "rgba(255,255,255,0.7)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const dotTexture = makeSoftDotTexture();

function buildStars(count, radiusMin, radiusMax, size, opacity) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = THREE.MathUtils.lerp(radiusMin, radiusMax, Math.random());
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(THREE.MathUtils.lerp(-1, 1, Math.random()));
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = -Math.abs(r * Math.cos(phi)) - 4;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    size,
    map: dotTexture,
    transparent: true,
    opacity,
    depthWrite: false,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  return new THREE.Points(geometry, material);
}

const starsFar = buildStars(IS_SMALL ? 700 : 1500, 12, 34, 0.11, 0.8);
const starsNear = buildStars(IS_SMALL ? 220 : 450, 6, 14, 0.2, 0.55);
scene.add(starsFar, starsNear);

function makeNebulaSprite(colorHex, size, opacity, position) {
  const canvasSize = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = canvasSize;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(
    canvasSize / 2, canvasSize / 2, 0,
    canvasSize / 2, canvasSize / 2, canvasSize / 2
  );
  const color = new THREE.Color(colorHex);
  gradient.addColorStop(0, `rgba(${color.r * 255},${color.g * 255},${color.b * 255},0.55)`);
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvasSize, canvasSize);
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.setScalar(size);
  sprite.position.copy(position);
  return sprite;
}

scene.add(
  makeNebulaSprite(0x5a3df0, 16, 0.5, new THREE.Vector3(-6, 3, -12)),
  makeNebulaSprite(0x1fb6c9, 14, 0.4, new THREE.Vector3(7, -3, -14)),
  makeNebulaSprite(0xd9578f, 12, 0.32, new THREE.Vector3(2, 5, -10))
);

// ---------------------------------------------------------------------------
// 猫テンプレート (glTF 優先、なければプロシージャルで代用)
// ---------------------------------------------------------------------------

function makeStandardMaterial(colorHex, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: opts.roughness ?? 0.75,
    metalness: 0.02,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    flatShading: false,
    map: opts.map ?? null,
  });
}

function colorToCss(hex) {
  const c = new THREE.Color(hex);
  return `rgb(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)})`;
}

// 猫っぽさを底上げする、しっぽ模様/毛柄のキャンバス生成テクスチャ。
// SphereGeometryの既定UV(経度・緯度)に貼ると、体の周りに縦縞が回り込む。
function makeFurTexture(palette) {
  const w = 256;
  const h = 128;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = colorToCss(palette.fur);
  ctx.fillRect(0, 0, w, h);

  if (palette.pattern === "tabby") {
    ctx.strokeStyle = colorToCss(palette.stripe);
    ctx.lineCap = "round";
    const stripeCount = 9;
    for (let i = 0; i < stripeCount; i++) {
      const x = ((i + 0.5) / stripeCount) * w;
      ctx.lineWidth = h * (0.045 + Math.random() * 0.03);
      ctx.globalAlpha = 0.55 + Math.random() * 0.3;
      ctx.beginPath();
      ctx.moveTo(x + (Math.random() - 0.5) * 6, -6);
      ctx.quadraticCurveTo(
        x + (Math.random() - 0.5) * 22, h * 0.5,
        x + (Math.random() - 0.5) * 16, h + 6
      );
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  const shade = ctx.createLinearGradient(0, 0, 0, h);
  shade.addColorStop(0, "rgba(255,255,255,0.10)");
  shade.addColorStop(0.55, "rgba(255,255,255,0)");
  shade.addColorStop(1, "rgba(0,0,0,0.16)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, w, h);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function buildProceduralCat(palette) {
  const root = new THREE.Group();
  root.name = `Cat_${palette.name}`;

  const furTexture = makeFurTexture(palette);
  const furMat = makeStandardMaterial(palette.fur, { map: furTexture, roughness: 0.8 });
  const bellyMat = makeStandardMaterial(palette.belly, { roughness: 0.85 });
  const innerMat = makeStandardMaterial(palette.inner, { roughness: 0.6 });
  const noseMat = makeStandardMaterial(palette.nose, { roughness: 0.4 });
  const scleraMat = makeStandardMaterial(0xf5f3ea, { roughness: 0.35 });
  const pupilMat = makeStandardMaterial(0x0a0a0d, {
    emissive: palette.glow,
    emissiveIntensity: 0.5,
    roughness: 0.25,
  });
  const catchlightMat = makeStandardMaterial(0xffffff, {
    emissive: 0xffffff,
    emissiveIntensity: 0.6,
    roughness: 0.3,
  });
  const whiskerMat = makeStandardMaterial(0xf5f0e6, { roughness: 0.5 });

  const sphere = (r, ws = 20, hs = 16) => new THREE.SphereGeometry(r, ws, hs);

  // マスコット風プロポーション: 頭を大きく主役にし、体は小さく添える。
  // (同じくらいの大きさの球を2つくっつけると雪だるまに見えるので、
  //  頭と体の大きさをはっきり変えて「丸の集合」に見せない)
  const headR = 0.3;
  const headPos = new THREE.Vector3(0, 0.1, 0.02);
  const head = new THREE.Mesh(sphere(headR), furMat);
  head.scale.set(1.05, 0.98, 1.0);
  head.position.copy(headPos);
  root.add(head);

  const bodyR = headR * 0.66;
  const bodyPos = new THREE.Vector3(0, -0.27, -0.01);
  const body = new THREE.Mesh(sphere(bodyR), furMat);
  body.scale.set(1.0, 0.92, 0.95);
  body.position.copy(bodyPos);
  root.add(body);

  // お腹の差し色パッチ
  const belly = new THREE.Mesh(sphere(bodyR * 0.68, 16, 12), bellyMat);
  belly.scale.set(0.82, 0.75, 0.85);
  belly.position.set(0, bodyPos.y - 0.02, bodyPos.z + bodyR * 0.55);
  root.add(belly);

  const nose = new THREE.Mesh(sphere(headR * 0.09, 8, 6), noseMat);
  nose.scale.set(1, 0.7, 0.55);
  nose.position.set(0, headPos.y - headR * 0.08, headPos.z + headR * 1.0);
  root.add(nose);

  // ひげ (顔の付け根から外向きに伸びる細い棒。原点側を付け根に揃えてから配置)
  const whiskerGeo = new THREE.CylinderGeometry(0.0025, 0.0009, 0.2, 5);
  whiskerGeo.translate(0, 0.1, 0);
  for (const side of [1, -1]) {
    for (let i = 0; i < 3; i++) {
      const whisker = new THREE.Mesh(whiskerGeo, whiskerMat);
      whisker.position.set(
        side * headR * 0.16,
        headPos.y - headR * 0.02 - i * 0.018,
        headPos.z + headR * 0.88
      );
      whisker.rotation.z = -side * (Math.PI / 2 - 0.12 + i * 0.1);
      whisker.rotation.x = (i - 1) * 0.12;
      root.add(whisker);
    }
  }

  for (const side of [1, -1]) {
    const ear = new THREE.Group();
    ear.name = side === 1 ? "EarR" : "EarL";
    const earCone = new THREE.Mesh(new THREE.ConeGeometry(headR * 0.32, headR * 0.52, 14), furMat);
    earCone.rotation.z = side * 0.3;
    earCone.position.y = headR * 0.26;
    ear.add(earCone);

    const innerCone = new THREE.Mesh(new THREE.ConeGeometry(headR * 0.18, headR * 0.32, 12), innerMat);
    innerCone.rotation.copy(earCone.rotation);
    innerCone.position.set(-side * 0.005, headR * 0.2, headR * 0.09);
    ear.add(innerCone);

    ear.position.set(side * headR * 0.56, headPos.y + headR * 0.86, headPos.z - headR * 0.08);
    ear.rotation.z = side * 0.1;
    root.add(ear);
  }

  // 目: 白目+黒目の大きな二枚構成で、まん丸のかわいい表情にする
  for (const side of [1, -1]) {
    const eyeGroup = new THREE.Group();
    const sclera = new THREE.Mesh(sphere(headR * 0.32, 16, 14), scleraMat);
    sclera.scale.set(1, 1, 0.55);
    eyeGroup.add(sclera);

    const pupil = new THREE.Mesh(sphere(headR * 0.17, 12, 10), pupilMat);
    pupil.scale.set(1, 1, 0.6);
    pupil.position.set(0, -headR * 0.02, headR * 0.14);
    eyeGroup.add(pupil);

    const catchlight = new THREE.Mesh(sphere(headR * 0.05, 6, 6), catchlightMat);
    catchlight.position.set(side * -0.02, headR * 0.05, headR * 0.24);
    eyeGroup.add(catchlight);

    eyeGroup.position.set(side * headR * 0.42, headPos.y + headR * 0.1, headPos.z + headR * 0.85);
    eyeGroup.rotation.y = side * 0.15;
    root.add(eyeGroup);
  }

  // しっぽ: 体の後ろから伸びて先端でくるっと上向きに巻く
  const tail = new THREE.Group();
  tail.name = "Tail";
  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, bodyPos.y + 0.03, bodyPos.z - bodyR * 0.85),
    new THREE.Vector3(0.03, bodyPos.y - 0.08, bodyPos.z - bodyR * 1.7),
    new THREE.Vector3(0.1, bodyPos.y - 0.04, bodyPos.z - bodyR * 2.35),
    new THREE.Vector3(0.17, bodyPos.y + 0.12, bodyPos.z - bodyR * 2.5),
    new THREE.Vector3(0.2, bodyPos.y + 0.26, bodyPos.z - bodyR * 2.1),
  ]);
  const tailTube = new THREE.Mesh(new THREE.TubeGeometry(tailCurve, 20, 0.036, 8, false), furMat);
  tail.add(tailTube);
  const tailBase = new THREE.Mesh(sphere(0.042, 10, 8), furMat);
  tailBase.position.copy(tailCurve.getPoint(0));
  tail.add(tailBase);
  const tailTip = new THREE.Mesh(sphere(0.024, 10, 8), furMat);
  tailTip.position.copy(tailCurve.getPoint(1));
  tail.add(tailTip);
  root.add(tail);

  // 前足だけを体の下に小さく覗かせる
  for (const side of [1, -1]) {
    const paw = new THREE.Mesh(sphere(bodyR * 0.28, 12, 10), furMat);
    paw.scale.set(0.9, 0.7, 1.0);
    paw.position.set(side * bodyR * 0.58, bodyPos.y - bodyR * 0.88, bodyPos.z + bodyR * 0.35);
    root.add(paw);
  }

  return root;
}

function buildProceduralTemplates() {
  return PALETTES.map(buildProceduralCat);
}

function extractGltfTemplates(gltf) {
  const templates = gltf.scene.children.filter((child) => child.name.startsWith("Cat_"));
  for (const t of templates) {
    t.traverse((node) => {
      if (node.isMesh) {
        node.material.flatShading = false;
        node.material.needsUpdate = true;
      }
    });
  }
  return templates;
}

function loadGltfTemplates() {
  return new Promise((resolve) => {
    const loader = new GLTFLoader();
    loader.load(
      "./assets/models/cats.glb",
      (gltf) => {
        const templates = extractGltfTemplates(gltf);
        resolve(templates.length ? templates : null);
      },
      undefined,
      () => resolve(null)
    );
  });
}

// ---------------------------------------------------------------------------
// 猫インスタンス
// ---------------------------------------------------------------------------

const haloTexture = makeSoftDotTexture();
const cats = [];
const clusterCenter = new THREE.Vector3(0, 0, 0);

// 奥行き z での、画面(ウィンドウ)に映る範囲の半分の幅・高さ。
// カメラは z 軸方向を向いたままなので、視野角とアスペクト比だけで決まる。
const viewHalf = { x: 0, y: 0 };
function updateViewHalf(z) {
  const dz = Math.max(camera.position.z - z, 0.5);
  viewHalf.y = dz * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  const aspect = Number.isFinite(camera.aspect) && camera.aspect > 0 ? camera.aspect : 1;
  viewHalf.x = viewHalf.y * aspect;
}

// 猫がウィンドウ(と奥行きの範囲)から出ないようにする。bounce なら壁で跳ね返し、
// 掴んで動かしている間は位置だけ止める。戻り値は壁にぶつかった速さ(演出用)。
function confineToView(cat, bounce) {
  const p = cat.root.position;
  const v = cat.velocity;
  let impact = 0;

  // 万一 NaN などが混ざっても、猫が見えなくなったままにならないよう中央へ戻す
  if (!Number.isFinite(p.x + p.y + p.z + v.x + v.y + v.z)) {
    p.set(0, 0, 0);
    v.set(0, 0, 0);
  }

  if (p.z > Z_MAX) {
    p.z = Z_MAX;
    if (bounce && v.z > 0) {
      impact = Math.max(impact, v.z);
      v.z = -v.z * WALL_RESTITUTION;
    }
  } else if (p.z < Z_MIN) {
    p.z = Z_MIN;
    if (bounce && v.z < 0) {
      impact = Math.max(impact, -v.z);
      v.z = -v.z * WALL_RESTITUTION;
    }
  }

  updateViewHalf(p.z);
  const limitX = Math.max(viewHalf.x - cat.wallRadius, 0);
  const limitY = Math.max(viewHalf.y - cat.wallRadius, 0);

  if (p.x > limitX) {
    p.x = limitX;
    if (bounce && v.x > 0) {
      impact = Math.max(impact, v.x);
      v.x = -v.x * WALL_RESTITUTION;
    }
  } else if (p.x < -limitX) {
    p.x = -limitX;
    if (bounce && v.x < 0) {
      impact = Math.max(impact, -v.x);
      v.x = -v.x * WALL_RESTITUTION;
    }
  }

  if (p.y > limitY) {
    p.y = limitY;
    if (bounce && v.y > 0) {
      impact = Math.max(impact, v.y);
      v.y = -v.y * WALL_RESTITUTION;
    }
  } else if (p.y < -limitY) {
    p.y = -limitY;
    if (bounce && v.y < 0) {
      impact = Math.max(impact, -v.y);
      v.y = -v.y * WALL_RESTITUTION;
    }
  }

  return impact;
}

function instantiateCat(template, index) {
  const root = template.clone(true);
  root.scale.setScalar(CAT_SCALE * THREE.MathUtils.lerp(0.82, 1.12, Math.random()));

  const haloMat = new THREE.SpriteMaterial({
    map: haloTexture,
    color: HALO_BASE,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const halo = new THREE.Sprite(haloMat);
  halo.scale.setScalar(1.7);
  halo.position.set(0, 0.08, 0.05);
  root.add(halo);

  root.position.set(0, 0, THREE.MathUtils.lerp(Z_MIN + 0.3, Z_MAX - 0.3, Math.random()));
  root.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);

  scene.add(root);

  const cat = {
    root,
    tail: root.getObjectByName("Tail"),
    earL: root.getObjectByName("EarL"),
    earR: root.getObjectByName("EarR"),
    halo,
    haloOpacity: 0,
    velocity: new THREE.Vector3(
      (Math.random() - 0.5) * 0.12,
      (Math.random() - 0.5) * 0.12,
      (Math.random() - 0.5) * 0.12
    ),
    angularVelocity: new THREE.Vector3(
      (Math.random() - 0.5) * 0.25,
      (Math.random() - 0.5) * 0.25,
      (Math.random() - 0.5) * 0.25
    ),
    phase: Math.random() * Math.PI * 2,
    baseScale: root.scale.x,
    currentScale: 1,
    hitRadius: 0.62,
    radius: BODY_RADIUS * root.scale.x,
    wallRadius: WALL_RADIUS * root.scale.x,
    prevPos: new THREE.Vector3(),
    hovered: false,
    pulseTimer: 0,
    flashTimer: 0,
    fxCooldown: 0,
    longPressed: false,
    state: "drift",
    grabDepth: 0,
  };

  // ウィンドウの見える範囲の中へ、ばらけて配置する
  updateViewHalf(root.position.z);
  const limitX = Math.max(viewHalf.x - cat.wallRadius, 0) * 0.9;
  const limitY = Math.max(viewHalf.y - cat.wallRadius, 0) * 0.9;
  root.position.x = (Math.random() * 2 - 1) * limitX;
  root.position.y = (Math.random() * 2 - 1) * limitY;
  cat.prevPos.copy(root.position);

  return cat;
}

async function spawnCats() {
  let templates = null;
  try {
    templates = await loadGltfTemplates();
  } catch (err) {
    templates = null;
  }
  if (!templates) templates = buildProceduralTemplates();

  for (let i = 0; i < CAT_COUNT; i++) {
    const template = templates[i % templates.length];
    cats.push(instantiateCat(template, i));
  }
  loadingNote.hidden = true;
}

loadingNote.hidden = false;
spawnCats();

// ---------------------------------------------------------------------------
// ポインター操作: ホバー / タップ / 長押し / ドラッグ
// ---------------------------------------------------------------------------

const tmpProject = new THREE.Vector3();
let activePointerId = null;
let heldCat = null;
let hoveredCat = null;
let grabStartTime = 0;
let grabStartClient = { x: 0, y: 0 };
let pointerHistory = [];
let pointerMoved = false;
let longPressTimer = null;

function projectToScreen(position) {
  tmpProject.copy(position).project(camera);
  return {
    x: (tmpProject.x * 0.5 + 0.5) * window.innerWidth,
    y: (-tmpProject.y * 0.5 + 0.5) * window.innerHeight,
    z: tmpProject.z,
  };
}

function screenRadiusFor(worldRadius, worldPos) {
  const dist = Math.max(camera.position.distanceTo(worldPos), 0.001);
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const heightAtDist = 2 * Math.tan(vFov / 2) * dist;
  const pxPerWorld = window.innerHeight / heightAtDist;
  return worldRadius * pxPerWorld;
}

function pickCatAt(clientX, clientY) {
  let best = null;
  let bestZ = Infinity;
  for (const cat of cats) {
    if (cat.state === "held") continue;
    const screen = projectToScreen(cat.root.position);
    if (screen.z < -1 || screen.z > 1) continue;
    const r = Math.max(screenRadiusFor(cat.hitRadius * cat.baseScale, cat.root.position), MIN_HIT_PX);
    const d = Math.hypot(screen.x - clientX, screen.y - clientY);
    if (d <= r && screen.z < bestZ) {
      best = cat;
      bestZ = screen.z;
    }
  }
  return best;
}

function pointerToWorldAtDepth(clientX, clientY, depth) {
  const ndc = new THREE.Vector2(
    (clientX / window.innerWidth) * 2 - 1,
    -(clientY / window.innerHeight) * 2 + 1
  );
  const vec = new THREE.Vector3(ndc.x, ndc.y, 0.5).unproject(camera);
  const dir = vec.sub(camera.position).normalize();
  return camera.position.clone().addScaledVector(dir, depth);
}

function releaseCat(clientX, clientY, wasCancelled) {
  if (!heldCat) return;
  const cat = heldCat;
  const duration = performance.now() - grabStartTime;
  clearTimeout(longPressTimer);

  if (wasCancelled) {
    cat.velocity.set(0, 0, 0);
  } else if (!pointerMoved && duration < CLICK_MAX_DURATION) {
    const dir = cat.root.position.clone().sub(clusterCenter);
    if (dir.lengthSq() < 0.0001) dir.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
    dir.normalize();
    dir.x += (Math.random() - 0.5) * 0.6;
    dir.y += (Math.random() - 0.5) * 0.6;
    dir.normalize();
    const speed = THREE.MathUtils.lerp(TAP_MIN_SPEED, TAP_MAX_SPEED, Math.random());
    cat.velocity.copy(dir.multiplyScalar(speed));
    cat.angularVelocity.set(
      (Math.random() - 0.5) * 4,
      (Math.random() - 0.5) * 4,
      (Math.random() - 0.5) * 4
    );
    cat.pulseTimer = 0.35;
  } else if (!pointerMoved && duration >= LONG_PRESS_DURATION) {
    cat.velocity.set(
      (Math.random() - 0.5) * 0.2,
      (Math.random() - 0.5) * 0.2,
      (Math.random() - 0.5) * 0.2
    );
  } else {
    const recent = pointerHistory.filter((p) => performance.now() - p.t < 140);
    if (recent.length >= 2) {
      const first = recent[0];
      const last = recent[recent.length - 1];
      const dt = Math.max(last.t - first.t, 1) / 1000;
      const worldFirst = pointerToWorldAtDepth(first.x, first.y, cat.grabDepth);
      const worldLast = pointerToWorldAtDepth(last.x, last.y, cat.grabDepth);
      const vel = worldLast.sub(worldFirst).divideScalar(dt);
      if (vel.length() > MAX_FLING_SPEED) vel.setLength(MAX_FLING_SPEED);
      cat.velocity.copy(vel);
      cat.angularVelocity.set(
        vel.y * 0.6 + (Math.random() - 0.5),
        -vel.x * 0.6 + (Math.random() - 0.5),
        (Math.random() - 0.5) * 2
      );
    }
  }

  cat.state = "drift";
  cat.longPressed = false;
  heldCat = null;
  activePointerId = null;
  pointerHistory = [];
}

function onPointerDown(event) {
  if (activePointerId !== null) return;
  const picked = pickCatAt(event.clientX, event.clientY);
  if (!picked) return;

  activePointerId = event.pointerId;
  heldCat = picked;
  heldCat.state = "held";
  heldCat.velocity.set(0, 0, 0);
  heldCat.angularVelocity.set(0, 0, 0);
  heldCat.grabDepth = camera.position.distanceTo(heldCat.root.position);
  grabStartTime = performance.now();
  grabStartClient = { x: event.clientX, y: event.clientY };
  pointerHistory = [{ x: event.clientX, y: event.clientY, t: grabStartTime }];
  pointerMoved = false;

  renderer.domElement.setPointerCapture?.(event.pointerId);

  clearTimeout(longPressTimer);
  longPressTimer = setTimeout(() => {
    if (heldCat === picked && !pointerMoved) {
      heldCat.longPressed = true;
      heldCat.pulseTimer = 0.5;
      heldCat.angularVelocity.set(
        (Math.random() - 0.5) * 3,
        (Math.random() - 0.5) * 3 + 3,
        (Math.random() - 0.5) * 3
      );
    }
  }, LONG_PRESS_DURATION);

  event.preventDefault();
}

function onPointerMove(event) {
  if (activePointerId === event.pointerId && heldCat) {
    const dx = event.clientX - grabStartClient.x;
    const dy = event.clientY - grabStartClient.y;
    if (Math.hypot(dx, dy) > CLICK_MAX_MOVE_PX) pointerMoved = true;

    pointerHistory.push({ x: event.clientX, y: event.clientY, t: performance.now() });
    if (pointerHistory.length > 8) pointerHistory.shift();

    const target = pointerToWorldAtDepth(event.clientX, event.clientY, heldCat.grabDepth);
    heldCat.root.position.lerp(target, 0.65);
    event.preventDefault();
    return;
  }

  if (!heldCat) {
    const picked = pickCatAt(event.clientX, event.clientY);
    if (hoveredCat && hoveredCat !== picked) hoveredCat.hovered = false;
    if (picked) picked.hovered = true;
    hoveredCat = picked;
  }
}

function onPointerUp(event) {
  if (activePointerId !== event.pointerId) return;
  releaseCat(event.clientX, event.clientY, false);
}

function onPointerCancel(event) {
  if (activePointerId !== event.pointerId) return;
  releaseCat(event.clientX, event.clientY, true);
}

const canvasEl = renderer.domElement;
canvasEl.style.touchAction = "none";
canvasEl.addEventListener("pointerdown", onPointerDown);
window.addEventListener("pointermove", onPointerMove, { passive: false });
window.addEventListener("pointerup", onPointerUp);
window.addEventListener("pointercancel", onPointerCancel);
window.addEventListener("blur", () => {
  if (heldCat) releaseCat(0, 0, true);
});

// ---------------------------------------------------------------------------
// あそびかたダイアログ
// ---------------------------------------------------------------------------

const rulesDialog = document.getElementById("rulesDialog");
document.getElementById("rulesButton").addEventListener("click", () => rulesDialog.showModal());
rulesDialog.querySelectorAll("[data-close-dialog]").forEach((btn) =>
  btn.addEventListener("click", () => rulesDialog.close())
);
rulesDialog.addEventListener("click", (event) => {
  if (event.target === rulesDialog) rulesDialog.close();
});

// ---------------------------------------------------------------------------
// アニメーションループ
// ---------------------------------------------------------------------------

const tmpSeparation = new THREE.Vector3();
const tmpNormal = new THREE.Vector3();
const tmpContact = new THREE.Vector3();
const tmpHeldVel = new THREE.Vector3();
let lastTime = performance.now();

// ---- 衝突の火花 ----------------------------------------------------------
// 使い回しのスプライトを円環バッファで再利用する(古いものから上書き)。

const SPARK_POOL = 48;
const sparks = [];
for (let i = 0; i < SPARK_POOL; i++) {
  const material = new THREE.SpriteMaterial({
    map: dotTexture,
    color: HALO_FLASH,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.visible = false;
  scene.add(sprite);
  sparks.push({ sprite, vel: new THREE.Vector3(), life: 0, maxLife: 1, size: 0.2 });
}
let sparkCursor = 0;

function emitSparks(origin, count, strength) {
  for (let n = 0; n < count; n++) {
    const s = sparks[sparkCursor];
    sparkCursor = (sparkCursor + 1) % SPARK_POOL;
    s.sprite.position.copy(origin);
    s.vel
      .set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
      .normalize()
      .multiplyScalar((0.6 + Math.random() * 1.2) * (0.5 + strength * 0.4));
    s.maxLife = s.life = 0.35 + Math.random() * 0.35;
    s.size = 0.14 + Math.random() * 0.16;
    s.sprite.visible = true;
  }
}

function updateSparks(dt) {
  for (const s of sparks) {
    if (s.life <= 0) continue;
    s.life -= dt;
    if (s.life <= 0) {
      s.sprite.visible = false;
      continue;
    }
    s.sprite.position.addScaledVector(s.vel, dt);
    s.vel.multiplyScalar(Math.exp(-2.5 * dt));
    const k = s.life / s.maxLife;
    s.sprite.material.opacity = k;
    s.sprite.scale.setScalar(s.size * (0.4 + 0.6 * k));
  }
}

// ---- 衝突 ----------------------------------------------------------------

function kickSpin(cat, strength) {
  const s = Math.min(strength, 3) * 0.9;
  cat.angularVelocity.x += (Math.random() - 0.5) * s * 2;
  cat.angularVelocity.y += (Math.random() - 0.5) * s * 2;
  cat.angularVelocity.z += (Math.random() - 0.5) * s * 2;
  if (cat.angularVelocity.length() > 6) cat.angularVelocity.setLength(6);
}

// ぶつかった2匹へのリアクション: ぷるんと膨らんで光り、くるっと回り、火花が散る。
function hitEffect(a, b, impact) {
  let fired = false;
  for (const cat of [a, b]) {
    if (cat.fxCooldown > 0) continue;
    cat.fxCooldown = HIT_FX_COOLDOWN;
    cat.flashTimer = 0.4;
    if (cat.state !== "held") cat.pulseTimer = Math.max(cat.pulseTimer, 0.3);
    kickSpin(cat, impact);
    fired = true;
  }
  if (!fired) return;
  tmpContact.copy(a.root.position).add(b.root.position).multiplyScalar(0.5);
  emitSparks(tmpContact, Math.min(6 + Math.floor(impact * 3), 12), Math.min(impact, 3));
}

function capSpeed(cat) {
  if (cat.velocity.length() > MAX_FLING_SPEED) cat.velocity.setLength(MAX_FLING_SPEED);
}

// 猫同士の相互作用。近づきすぎにはそっと反発し(密集予防)、実際に重なったら
// 位置を押し戻したうえで、質量が等しい弾性衝突として運動量をやり取りする。
// 掴んでいる猫は動かさない(無限の質量扱い)ので、掴んでぶつけて弾き飛ばせる。
function resolveCatInteractions(dt) {
  for (let i = 0; i < cats.length; i++) {
    const a = cats[i];
    const aHeld = a.state === "held";
    for (let j = i + 1; j < cats.length; j++) {
      const b = cats[j];
      const bHeld = b.state === "held";
      if (aHeld && bHeld) continue;

      tmpSeparation.copy(a.root.position).sub(b.root.position);
      let dist = tmpSeparation.length();
      if (dist < 0.0001) {
        tmpSeparation.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
        dist = tmpSeparation.length() || 1;
      }
      tmpNormal.copy(tmpSeparation).divideScalar(dist); // b から a へ向かう向き

      if (!aHeld && !bHeld && dist < SEPARATION_DIST) {
        const push = (1 - dist / SEPARATION_DIST) * SEPARATION_STRENGTH * dt;
        a.velocity.addScaledVector(tmpNormal, push);
        b.velocity.addScaledVector(tmpNormal, -push);
      }

      const minDist = a.radius + b.radius;
      if (dist >= minDist) continue;

      // 重なりを解消(掴んでいる側は動かさず、もう片方だけ押し戻す)
      const overlap = minDist - dist;
      const moveA = aHeld ? 0 : bHeld ? 1 : 0.5;
      const moveB = bHeld ? 0 : aHeld ? 1 : 0.5;
      a.root.position.addScaledVector(tmpNormal, overlap * moveA);
      b.root.position.addScaledVector(tmpNormal, -overlap * moveB);

      // 近づいている場合だけ、法線方向の速度を弾性衝突として交換する
      const approach =
        (a.velocity.x - b.velocity.x) * tmpNormal.x +
        (a.velocity.y - b.velocity.y) * tmpNormal.y +
        (a.velocity.z - b.velocity.z) * tmpNormal.z;
      if (approach >= 0) continue;

      const invA = aHeld ? 0 : 1;
      const invB = bHeld ? 0 : 1;
      const impulse = (-(1 + CAT_RESTITUTION) * approach) / (invA + invB);
      a.velocity.addScaledVector(tmpNormal, impulse * invA);
      b.velocity.addScaledVector(tmpNormal, -impulse * invB);
      capSpeed(a);
      capSpeed(b);

      if (-approach > HIT_FX_MIN_SPEED) hitEffect(a, b, -approach);
    }
  }
}

function updateCat(cat, dt, t) {
  if (cat.fxCooldown > 0) cat.fxCooldown -= dt;
  if (cat.flashTimer > 0) cat.flashTimer -= dt;

  if (cat.state === "held") {
    // 掴んでいる間も、ウィンドウの外へは出さない
    confineToView(cat, false);
    // 動かしている速さを推定しておく(他の猫にぶつけたとき、勢いが伝わるように)
    tmpHeldVel.copy(cat.root.position).sub(cat.prevPos).divideScalar(Math.max(dt, 0.0001));
    if (tmpHeldVel.length() > MAX_FLING_SPEED) tmpHeldVel.setLength(MAX_FLING_SPEED);
    cat.velocity.lerp(tmpHeldVel, Math.min(1, dt * 12));

    cat.root.rotation.y += dt * 0.8;
    if (cat.tail) cat.tail.rotation.x = Math.sin(t * 5 + cat.phase) * 0.4 - 0.2;
    cat.haloOpacity = THREE.MathUtils.lerp(cat.haloOpacity, 0.85, Math.min(1, dt * 8));
  } else {
    const nx = Math.sin(t * 0.15 + cat.phase) + Math.sin(t * 0.083 + cat.phase * 1.7) * 0.5;
    const ny = Math.cos(t * 0.12 + cat.phase * 1.3) + Math.sin(t * 0.09 + cat.phase * 2.1) * 0.5;
    const nz = Math.sin(t * 0.1 + cat.phase * 0.6);
    cat.velocity.x += nx * AMBIENT_ACCEL * dt;
    cat.velocity.y += ny * AMBIENT_ACCEL * dt;
    cat.velocity.z += nz * AMBIENT_ACCEL * dt;

    // 慣性: ふだんの漂い速度(MAX_DRIFT_SPEED)を超えた「勢い」の分だけを
    // ゆっくり減衰させる。以前は毎フレーム MAX_DRIFT_SPEED へ強制クランプしていて、
    // タップや放り投げの勢いが一瞬で消えていた。
    const speed = cat.velocity.length();
    if (speed > MAX_DRIFT_SPEED) {
      const excess = (speed - MAX_DRIFT_SPEED) * Math.exp(-INERTIA_DECAY * dt);
      cat.velocity.setLength(MAX_DRIFT_SPEED + excess);
    } else {
      cat.velocity.multiplyScalar(Math.max(0, 1 - DAMPING * dt));
    }

    cat.root.position.addScaledVector(cat.velocity, dt);

    // ウィンドウの端(と奥行きの壁)で跳ね返す。勢いよくぶつかったらくるっと回る。
    const wallImpact = confineToView(cat, true);
    if (wallImpact > HIT_FX_MIN_SPEED) kickSpin(cat, wallImpact * 0.5);

    cat.root.rotation.x += cat.angularVelocity.x * dt;
    cat.root.rotation.y += cat.angularVelocity.y * dt;
    cat.root.rotation.z += cat.angularVelocity.z * dt;
    cat.angularVelocity.multiplyScalar(Math.max(0, 1 - SPIN_DAMPING * dt));

    if (cat.tail) cat.tail.rotation.x = Math.sin(t * 1.6 + cat.phase) * 0.28 - 0.1;
    if (cat.earL) cat.earL.rotation.z = Math.sin(t * 2.3 + cat.phase) * 0.08;
    if (cat.earR) cat.earR.rotation.z = -Math.sin(t * 2.1 + cat.phase * 1.1) * 0.08;

    if (cat.pulseTimer > 0) cat.pulseTimer -= dt;
    const haloTarget = cat.flashTimer > 0 ? 1 : cat.hovered || cat.pulseTimer > 0 ? 0.7 : 0;
    cat.haloOpacity = THREE.MathUtils.lerp(cat.haloOpacity, haloTarget, Math.min(1, dt * 6));
  }

  const targetScale = cat.pulseTimer > 0 ? 1.2 : cat.hovered || cat.state === "held" ? 1.08 : 1;
  cat.currentScale = THREE.MathUtils.lerp(cat.currentScale, targetScale, Math.min(1, dt * 8));
  cat.root.scale.setScalar(cat.baseScale * cat.currentScale);
  cat.halo.material.opacity = cat.haloOpacity;
  cat.halo.material.color.setHex(cat.flashTimer > 0 ? HALO_FLASH : HALO_BASE);

  cat.prevPos.copy(cat.root.position);
}

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  const t = now / 1000;

  if (window.innerWidth !== appliedSize.w || window.innerHeight !== appliedSize.h) resize();

  resolveCatInteractions(dt);
  for (const cat of cats) updateCat(cat, dt, t);
  updateSparks(dt);

  starsFar.rotation.y += dt * 0.004;
  starsNear.rotation.y -= dt * 0.006;

  renderer.render(scene, camera);
}
animate();

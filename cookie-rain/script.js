const COOKIE_SRC = "./assets/cookie.png";
const SHARE_IMAGE_SRC = "./og-image.png";
const SHARE_URL = document.querySelector('link[rel="canonical"]')?.href || window.location.href;

const elements = {
  acceptButton: document.querySelector("#acceptButton"),
  animalCelebration: document.querySelector("#animalCelebration"),
  announcement: document.querySelector("#announcement"),
  card: document.querySelector("#consentCard"),
  cookieLayer: document.querySelector("#cookieLayer"),
  questionView: document.querySelector("#questionView"),
  replayButton: document.querySelector("#replayButton"),
  resultCopy: document.querySelector("#resultCopy"),
  resultLabel: document.querySelector("#resultLabel"),
  resultTitle: document.querySelector("#resultTitle"),
  resultView: document.querySelector("#resultView"),
  shareButton: document.querySelector("#shareButton"),
  shareImageButton: document.querySelector("#shareImageButton"),
  shareStatus: document.querySelector("#shareStatus"),
  singleButton: document.querySelector("#singleButton"),
};

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let cheerTimer;
let currentMode = "all";

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function makeCookie(index, total, isSingle = false) {
  const cookie = document.createElement("img");
  const reduced = prefersReducedMotion.matches;
  const size = isSingle ? 112 : randomBetween(44, 104);
  const spread = isSingle ? 0 : randomBetween(-95, 95);
  const rotation = randomBetween(-70, 70);

  cookie.src = COOKIE_SRC;
  cookie.alt = "";
  cookie.className = "falling-cookie";
  cookie.style.setProperty(
    "--x",
    isSingle ? `calc(50vw - ${size / 2}px)` : `${randomBetween(-4, 96)}vw`
  );
  cookie.style.setProperty("--size", `${size}px`);
  cookie.style.setProperty("--delay", `${isSingle ? 0.08 : randomBetween(0, 1.05)}s`);
  cookie.style.setProperty("--duration", `${isSingle ? 2.4 : randomBetween(1.9, 3.65)}s`);
  cookie.style.setProperty("--drift", `${spread}px`);
  cookie.style.setProperty("--rotation", `${rotation}deg`);
  cookie.style.setProperty("--spin", `${rotation + randomBetween(260, 820)}deg`);

  if (isSingle) cookie.classList.add("is-single");

  if (reduced) {
    cookie.classList.add("is-static");
    cookie.style.setProperty(
      "--x",
      isSingle
        ? `calc(50vw - ${size / 2}px)`
        : `${12 + (index / Math.max(total - 1, 1)) * 72}vw`
    );
    cookie.style.setProperty("--bottom", `${randomBetween(2, 12)}vh`);
    window.setTimeout(() => cookie.remove(), 2400);
  } else {
    cookie.addEventListener("animationend", () => cookie.remove(), { once: true });
  }

  return cookie;
}

function showerCookies(amount) {
  const fragment = document.createDocumentFragment();

  for (let index = 0; index < amount; index += 1) {
    fragment.append(makeCookie(index, amount, amount === 1));
  }

  elements.cookieLayer.append(fragment);
}

function cheerAnimals() {
  window.clearTimeout(cheerTimer);
  elements.animalCelebration.classList.remove("is-cheering");
  void elements.animalCelebration.offsetWidth;
  elements.animalCelebration.classList.add("is-cheering");

  cheerTimer = window.setTimeout(
    () => elements.animalCelebration.classList.remove("is-cheering"),
    prefersReducedMotion.matches ? 2050 : 3150
  );
}

function showResult(mode) {
  const acceptedAll = mode === "all";
  currentMode = mode;

  elements.questionView.hidden = true;
  elements.resultView.hidden = false;
  elements.card.removeAttribute("aria-describedby");

  if (acceptedAll) {
    elements.resultLabel.textContent = "ぜんぶ受け入れました";
    elements.resultTitle.innerHTML = "クッキーの準備が<br />できました！";
    elements.resultCopy.textContent = "みんなで、たっぷりお届けします。";
    elements.announcement.textContent = "すべて受け入れました。3匹の動物が喜び、たくさんのクッキーが降っています。";
    showerCookies(prefersReducedMotion.matches ? 7 : 58);
  } else {
    elements.resultLabel.textContent = "ひとつだけ";
    elements.resultTitle.innerHTML = "はい、どうぞ。";
    elements.resultCopy.textContent = "3匹で、大切に見守ります。";
    elements.announcement.textContent = "ひとつだけ選びました。3匹の動物が喜び、クッキーが1枚降っています。";
    showerCookies(1);
  }

  cheerAnimals();
  window.setTimeout(
    () => elements.shareImageButton.focus(),
    prefersReducedMotion.matches ? 2100 : 3200
  );
}

function getShareText(includeUrl = false) {
  let text = currentMode === "all"
    ? "私はすべてのクッキーを受け入れました。🍪\nすると、本当にクッキーが降ってきた。\n#クッキーシャワー"
    : "私はクッキーをひとつだけ受け入れました。🍪\nすると、本当に1枚だけ降ってきた。\n#クッキーシャワー";

  if (includeUrl) text += `\n\n${SHARE_URL}`;
  return text;
}

function getXShareUrl() {
  const text = getShareText();
  const query = new URLSearchParams({ text, url: SHARE_URL });
  return `https://twitter.com/intent/tweet?${query.toString()}`;
}

function shareOnX() {
  window.open(
    getXShareUrl(),
    "_blank",
    "noopener,noreferrer"
  );
}

function continueImageShareOnX() {
  window.location.assign(getXShareUrl());
}

function showShareStatus(message) {
  elements.shareStatus.textContent = message;
  elements.shareStatus.hidden = false;
}

function setImageShareButtonBusy(isBusy) {
  elements.shareImageButton.disabled = isBusy;
  elements.shareImageButton.setAttribute("aria-busy", String(isBusy));
}

async function getShareImageFile() {
  const response = await fetch(SHARE_IMAGE_SRC);
  if (!response.ok) throw new Error("Share image could not be loaded.");
  return new File([await response.blob()], "cookie-shower.png", { type: "image/png" });
}

function downloadShareImage(imageFile) {
  const downloadUrl = URL.createObjectURL(imageFile);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = imageFile.name;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
}

async function copyImageToClipboard(imageFile) {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") return false;

  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": imageFile })]);
    return true;
  } catch {
    return false;
  }
}

async function shareWithImage() {
  setImageShareButtonBusy(true);
  elements.shareStatus.hidden = true;

  try {
    const imageFile = await getShareImageFile();
    if (await copyImageToClipboard(imageFile)) {
      showShareStatus("画像をコピーしました。Xで貼り付けるだけです。");
      window.setTimeout(continueImageShareOnX, 650);
      return;
    }

    downloadShareImage(imageFile);
    showShareStatus("画像を保存しました。Xで添付してください。");
    window.setTimeout(continueImageShareOnX, 650);
  } catch {
    showShareStatus("共有画像を読み込めませんでした。もう一度お試しください。");
  } finally {
    setImageShareButtonBusy(false);
  }
}

function resetExperience() {
  window.clearTimeout(cheerTimer);
  elements.animalCelebration.classList.remove("is-cheering");
  elements.cookieLayer.replaceChildren();
  elements.resultView.hidden = true;
  elements.questionView.hidden = false;
  elements.shareStatus.hidden = true;
  elements.card.setAttribute("aria-describedby", "questionDescription");
  elements.announcement.textContent = "質問に戻りました。";
  elements.acceptButton.focus();
}

elements.acceptButton.addEventListener("click", () => showResult("all"));
elements.singleButton.addEventListener("click", () => showResult("single"));
elements.shareImageButton.addEventListener("click", shareWithImage);
elements.shareButton.addEventListener("click", shareOnX);
elements.replayButton.addEventListener("click", resetExperience);

(() => {
  "use strict";

  const STORAGE_KEY = "asobi:cat-catalog-profiles-v1";

  const crop = (x, y, w, h) => ({ x, y, w, h, sourceW: 1536, sourceH: 1024 });

  const cats = [
    {
      id: "stripe-gray",
      type: "core",
      label: "主力キャスト",
      currentName: "しまねこ",
      subtitle: "灰しま・半目・黄色い目",
      image: "../nekoris/assets/cat-pose-vertical.png",
      portrait: "#cad1cf",
      sightings: ["ねこもり", "ネコリス", "ねこタイプ", "moodboard"],
      likes: "",
      personality: "",
      role: "",
      hypothesis: "落ち着き／観察役／簡単には浮かれない。表情だけで場を締められる。",
    },
    {
      id: "round-orange",
      type: "core",
      label: "主力キャスト",
      currentName: "まるねこ",
      subtitle: "オレンジしま・まんまる目",
      image: "../nekoris/assets/cat-pose-square.png",
      portrait: "#f5c54b",
      sightings: ["ねこもり", "ネコリス", "ねこタイプ", "moodboard"],
      likes: "",
      personality: "",
      role: "",
      hypothesis: "好奇心／素直なリアクション／輪の中心。何かを最初に試す役が似合う。",
    },
    {
      id: "white-fluffy",
      type: "core",
      label: "主力キャスト",
      currentName: "しろふわ",
      subtitle: "白・長毛・小さな黒目",
      image: "../nekoris/assets/cat-pose-plus.png",
      portrait: "#f1dfbd",
      sightings: ["ねこもり", "ネコリス", "clear card", "moodboard"],
      likes: "",
      personality: "",
      role: "",
      hypothesis: "おおらか／安心感／やわらかい天然。場の緊張をほどく役。",
    },
    {
      id: "calico",
      type: "core",
      label: "主力キャスト",
      currentName: "みけねこ",
      subtitle: "三毛・白い胸・丸い目",
      image: "../nekoris/assets/cat-pose-choko.png",
      portrait: "#efb777",
      sightings: ["ねこもり", "ネコリス", "ねこタイプ", "clear card"],
      likes: "",
      personality: "",
      role: "",
      hypothesis: "まじめ／気配り／ちょっと心配性。段取りや説明を担当できそう。",
    },
    {
      id: "brown-tabby",
      type: "core",
      label: "主力キャスト",
      currentName: "のびねこ",
      subtitle: "茶しま・大きな琥珀目",
      image: "../nekoris/assets/cat-pose-stair.png",
      portrait: "#c5a16b",
      sightings: ["ねこもり", "ネコリス", "clear card", "moodboard"],
      likes: "",
      personality: "",
      role: "",
      hypothesis: "俊敏／集中すると一直線／遊びの発明家。動きのある企画に強い。",
    },
    {
      id: "big-charcoal",
      type: "core",
      label: "主力キャスト",
      currentName: "デカネコ",
      subtitle: "濃い灰・大きい・半目",
      crop: crop(1020, 506, 466, 470),
      portrait: "#bbb7ad",
      sightings: ["ねこもり", "cat source"],
      likes: "",
      personality: "",
      role: "",
      hypothesis: "貫禄／マイペース／最終到達点。しゃべらなくても全員が一目置く。",
    },
    {
      id: "tuxedo",
      type: "new",
      label: "ネコリス追加",
      currentName: "くねくね（仮）",
      subtitle: "黒白ハチワレ・緑の目",
      image: "../nekoris/assets/cat-pose-zig.png",
      portrait: "#b7c8ac",
      sightings: ["ネコリス"],
      likes: "",
      personality: "",
      role: "",
      hypothesis: "しなやか／要領がいい／視線が軽やか。主力6匹へ加えるか検討。",
    },
    {
      id: "blue-tabby",
      type: "new",
      label: "ネコリス追加",
      currentName: "すっぽり（仮）",
      subtitle: "青灰しま・茶色い目",
      image: "../nekoris/assets/cat-pose-cup.png",
      portrait: "#bed1d7",
      sightings: ["ネコリス"],
      likes: "",
      personality: "",
      role: "",
      hypothesis: "上品／柔軟／少し不思議。しまねことは顔つきが違うので別個体扱い。",
    },
    {
      id: "office-cat",
      type: "new",
      label: "作品専属",
      currentName: "退勤ねこ（仮）",
      subtitle: "白＋灰・ネクタイ・ふっくら",
      image: "../taikin/assets/cat-character.png",
      portrait: "#c8d6d8",
      sightings: ["退勤ボタン"],
      likes: "",
      personality: "",
      role: "",
      hypothesis: "儀式好き／仕事はきっちり／終業後は切り替えが早い。独立した看板役。",
    },
    {
      id: "click-cat",
      type: "new",
      label: "作品専属",
      currentName: "クリックねこ（仮）",
      subtitle: "オレンジしま・片手を上げる",
      image: "../clicker/assets/cat-character.png",
      portrait: "#f3ca72",
      sightings: ["無意味クリッカー"],
      likes: "",
      personality: "",
      role: "",
      hypothesis: "テンション高め／反復が好き／応援役。まるねこと統合する余地あり。",
    },
    {
      id: "dash-calico",
      type: "new",
      label: "作品専属",
      currentName: "ダッシュねこ（仮）",
      subtitle: "三毛・長い手足・走る",
      image: "../pinpondash/assets/cat-character.png",
      portrait: "#efc6a3",
      sightings: ["ピンポンダッシュ"],
      likes: "",
      personality: "",
      role: "",
      hypothesis: "いたずら好き／瞬発力／逃げ足が速い。みけねこの別モードにもできる。",
    },
    {
      id: "cookie-cat",
      type: "new",
      label: "作品専属",
      currentName: "クッキーねこ（仮）",
      subtitle: "オレンジしま・白いお腹・ばんざい",
      image: "../cookie-rain/assets/animal-cheer.png",
      portrait: "#e6c787",
      imageClass: "group-image",
      sightings: ["Cookie shower"],
      likes: "",
      personality: "",
      role: "",
      hypothesis: "お祭り好き／人なつこい／喜び担当。犬・レッサーパンダとの3人組でも成立。",
    },
    {
      id: "space-cat",
      type: "new",
      label: "3D専属",
      currentName: "宇宙ねこ（仮）",
      subtitle: "黒＋白・ピンク差し色・3D",
      model: true,
      portrait: "#20243d",
      sightings: ["ネコスペース", "cats.glb"],
      likes: "",
      personality: "",
      role: "",
      hypothesis: "無重力／無口／触ると反応する。2D組とは別世界線の住人として置く。",
    },
  ];

  const assets = [
    { project: "moodboard", title: "asobi moodboard", path: "../asobi-moodboard.png", wide: true },
    { project: "moodboard", title: "asobi UI moodboard", path: "../asobi-ui-moodboard.png", wide: true },
    { project: "moodboard", title: "asobi zoo moodboard（猫のカメオあり）", path: "../asobi-zoo-moodboard.png", wide: true },

    { project: "ねこもり", title: "6匹の元シート", path: "../nekomori/assets/cat-source.png", note: "ネコリスのcat-source.pngと同一" },
    { project: "ねこもり", title: "OG画像", path: "../nekomori/og-image.png", wide: true },

    ...["square", "long", "choko", "nobi", "vertical", "corner", "tee", "zig", "ell", "plus", "cup", "stair"].map((pose) => ({
      project: "ネコリス", title: `pose / ${pose}`, path: `../nekoris/assets/cat-pose-${pose}.png`,
    })),
    { project: "ネコリス", title: "ステージクリア絵", path: "../nekoris/clear-card.png", wide: true },
    { project: "ネコリス", title: "OG画像", path: "../nekoris/og.png", wide: true, note: "ogp-game.pngと同一" },

    { project: "ねこタイプ", title: "キーボードの3匹", path: "../nekotyping/assets/cats-keyboard.png", wide: true },
    { project: "ねこタイプ", title: "OGアート", path: "../nekotyping/og-art.png", wide: true },
    { project: "ねこタイプ", title: "OG画像", path: "../nekotyping/og-image.png", wide: true },

    { project: "退勤", title: "キャラクター単体", path: "../taikin/assets/cat-character.png" },
    { project: "退勤", title: "情景イラスト", path: "../taikin/assets/cat-widget.png", wide: true },
    { project: "退勤", title: "OG画像", path: "../taikin/og-image.png", wide: true },
    { project: "退勤", title: "before資料", path: "../images/taikin/taikin-before.jpg", wide: true },
    { project: "退勤", title: "after資料", path: "../images/taikin/taikin-after.jpg", wide: true },

    { project: "クリック", title: "キャラクター単体", path: "../clicker/assets/cat-character.png" },
    { project: "クリック", title: "情景イラスト", path: "../clicker/assets/cat-widget.png", wide: true },
    { project: "クリック", title: "OG画像 / 初期", path: "../clicker/og-image.png", wide: true },
    { project: "クリック", title: "OG画像 / v2", path: "../clicker/og-image-v2.png", wide: true },
    ...[1, 2, 3, 4, 5, 6, 7].map((number) => ({
      project: "クリック", title: `share ${String(number).padStart(2, "0")}`, path: `../clicker/assets/share/share-${String(number).padStart(2, "0")}.png`,
    })),

    { project: "ピンポン", title: "キャラクター単体", path: "../pinpondash/assets/cat-character.png", wide: true },
    { project: "ピンポン", title: "情景イラスト", path: "../pinpondash/assets/cat-widget.png", wide: true },
    { project: "ピンポン", title: "OG画像 / 初期", path: "../pinpondash/og-image.png", wide: true },
    { project: "ピンポン", title: "OG画像 / v2", path: "../pinpondash/og-image-v2.png", wide: true },
    ...[1, 2, 3, 4, 5, 6, 7].map((number) => ({
      project: "ピンポン", title: `share ${String(number).padStart(2, "0")}`, path: `../pinpondash/assets/share/share-${String(number).padStart(2, "0")}.png`,
    })),

    { project: "Cookie", title: "猫・犬・レッサーパンダ", path: "../cookie-rain/assets/animal-cheer.png", wide: true },
    { project: "Cookie", title: "OG画像", path: "../cookie-rain/og-image.png", wide: true },
  ];

  const castGrid = document.querySelector("#castGrid");
  const assetGrid = document.querySelector("#assetGrid");
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    saved = {};
  }

  function sourceCropMarkup(cropInfo) {
    const width = (cropInfo.sourceW / cropInfo.w) * 100;
    const left = -(cropInfo.x / cropInfo.w) * 100;
    const top = -(cropInfo.y / cropInfo.h) * 100;
    return `<div class="source-crop" style="aspect-ratio:${cropInfo.w}/${cropInfo.h};--image-width:${width}%;--image-left:${left}%;--image-top:${top}%"><img src="../nekomori/assets/cat-source.png" alt="" /></div>`;
  }

  function profileValue(cat, field) {
    return saved[cat.id]?.[field] ?? cat[field] ?? "";
  }

  function renderCats() {
    castGrid.innerHTML = cats.map((cat, index) => {
      const visual = cat.crop
        ? sourceCropMarkup(cat.crop)
        : cat.model
          ? `<div class="profile-model"><strong>cats.glb</strong><small>3D model</small></div>`
          : `<img class="${cat.imageClass || ""}" src="${cat.image}" alt="${cat.currentName}の既存素材" loading="lazy" />`;
      return `
        <article class="cat-card" data-type="${cat.type}" data-id="${cat.id}">
          <div class="cat-portrait" style="--portrait:${cat.portrait}">
            <span class="cat-index">${String(index + 1).padStart(2, "0")}</span>
            <span class="cat-status">${cat.label}</span>
            ${visual}
          </div>
          <div class="cat-body">
            <div class="cat-heading">
              <div><h3>${cat.currentName}</h3><small>${cat.subtitle}</small></div>
            </div>
            <ul class="sighting-list">${cat.sightings.map((item) => `<li>${item}</li>`).join("")}</ul>
            <div class="profile-form">
              <label>名前<input data-field="name" value="${escapeHtml(profileValue(cat, "name"))}" placeholder="まだ未定" /></label>
              <label>好きなもの<input data-field="likes" value="${escapeHtml(profileValue(cat, "likes"))}" placeholder="まだ未定" /></label>
              <label class="wide">性格<textarea data-field="personality" placeholder="どんな子？">${escapeHtml(profileValue(cat, "personality"))}</textarea></label>
              <label class="wide">物語での役割<input data-field="role" value="${escapeHtml(profileValue(cat, "role"))}" placeholder="主人公、ツッコミ、案内役…" /></label>
            </div>
            <p class="hypothesis"><b>見た目からの仮説：</b>${cat.hypothesis}</p>
          </div>
        </article>`;
    }).join("");
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function renderAssets() {
    assetGrid.innerHTML = assets.map((asset) => `
      <article class="asset-card${asset.wide ? " is-wide" : ""}" data-project="${asset.project}">
        <img src="${asset.path}" alt="${asset.title}" loading="lazy" />
        <div class="asset-meta">
          <strong>${asset.project} / ${asset.title}</strong>
          <span>${asset.path.replace("../", "")}${asset.note ? `<br>${asset.note}` : ""}</span>
        </div>
      </article>`).join("");
  }

  function buildFilters(host, values, selector, attribute) {
    const labels = ["すべて", ...values];
    host.innerHTML = labels.map((label, index) => `<button class="filter-button${index === 0 ? " is-active" : ""}" type="button" data-filter="${index === 0 ? "all" : label}">${label}</button>`).join("");
    host.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      host.querySelectorAll("button").forEach((item) => item.classList.toggle("is-active", item === button));
      document.querySelectorAll(selector).forEach((card) => {
        card.classList.toggle("is-hidden", button.dataset.filter !== "all" && card.dataset[attribute] !== button.dataset.filter);
      });
    });
  }

  document.querySelectorAll(".view-button").forEach((button) => {
    button.addEventListener("click", () => {
      const showCast = button.dataset.view === "cast";
      document.querySelectorAll(".view-button").forEach((item) => {
        const active = item === button;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-selected", String(active));
      });
      document.querySelector("#castView").hidden = !showCast;
      document.querySelector("#assetsView").hidden = showCast;
      document.querySelector("#castView").classList.toggle("is-active", showCast);
      document.querySelector("#assetsView").classList.toggle("is-active", !showCast);
      document.querySelector("#saveProfiles").classList.toggle("is-hidden", !showCast);
    });
  });

  document.querySelector("#saveProfiles").addEventListener("click", () => {
    const profiles = {};
    document.querySelectorAll(".cat-card").forEach((card) => {
      profiles[card.dataset.id] = {};
      card.querySelectorAll("[data-field]").forEach((field) => {
        profiles[card.dataset.id][field.dataset.field] = field.value.trim();
      });
    });
    const toast = document.querySelector("#toast");
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
      toast.textContent = "保存しました";
    } catch {
      toast.textContent = "この表示方法では保存できません";
    }
    toast.classList.add("is-visible");
    window.setTimeout(() => toast.classList.remove("is-visible"), 1500);
  });

  renderCats();
  renderAssets();
  buildFilters(document.querySelector("#castFilters"), ["core", "new"], ".cat-card", "type");
  document.querySelectorAll("#castFilters .filter-button").forEach((button) => {
    if (button.dataset.filter === "core") button.textContent = "主力キャスト";
    if (button.dataset.filter === "new") button.textContent = "追加・作品専属";
  });
  buildFilters(
    document.querySelector("#assetFilters"),
    [...new Set(assets.map((asset) => asset.project))],
    ".asset-card",
    "project"
  );
})();

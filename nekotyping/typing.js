const NekoTyping = (() => {
  const SOUND_GROUPS = [
    ["sha", "sya"],
    ["shu", "syu"],
    ["sho", "syo"],
    ["cha", "tya", "cya"],
    ["chu", "tyu", "cyu"],
    ["cho", "tyo", "cyo"],
    ["ja", "zya", "jya"],
    ["ju", "zyu", "jyu"],
    ["jo", "zyo", "jyo"],
    ["shi", "si"],
    ["chi", "ti"],
    ["tsu", "tu"],
    ["fu", "hu"],
    ["ji", "zi"],
  ];

  function expandGroup(variants, group) {
    const expanded = new Set(variants);
    let changed = true;

    while (changed) {
      changed = false;
      [...expanded].forEach((variant) => {
        group.forEach((source) => {
          let index = variant.indexOf(source);
          while (index !== -1) {
            group.forEach((replacement) => {
              const next = variant.slice(0, index) + replacement + variant.slice(index + source.length);
              if (!expanded.has(next)) {
                expanded.add(next);
                changed = true;
              }
            });
            index = variant.indexOf(source, index + 1);
          }
        });
      });
    }

    return expanded;
  }

  function expandLongVowels(variants) {
    const expanded = new Set(variants);
    let changed = true;

    while (changed) {
      changed = false;
      [...expanded].forEach((variant) => {
        const index = variant.indexOf("-");
        if (index === -1) return;
        const vowel = variant[index - 1];
        const replacements = /[aeiou]/.test(vowel) ? ["", vowel] : [""];
        replacements.forEach((replacement) => {
          const next = variant.slice(0, index) + replacement + variant.slice(index + 1);
          if (!expanded.has(next)) {
            expanded.add(next);
            changed = true;
          }
        });
      });
    }

    return expanded;
  }

  function expandRomajiVariants(baseVariants) {
    let variants = new Set(baseVariants.map((value) => value.toLowerCase()));
    variants = expandLongVowels(variants);
    SOUND_GROUPS.forEach((group) => {
      variants = expandGroup(variants, group);
    });
    return [...variants];
  }

  function matchRomaji(candidates, typed, key) {
    const nextTyped = typed + key.toLowerCase();
    const remaining = candidates.filter((candidate) => candidate.startsWith(nextTyped));

    if (!remaining.length) {
      return { accepted: false, typed, candidates, complete: false, graceKeys: [] };
    }

    const complete = remaining.includes(nextTyped);
    const graceKeys = complete
      ? [...new Set(remaining.filter((candidate) => candidate.length > nextTyped.length).map((candidate) => candidate[nextTyped.length]))]
      : [];

    return {
      accepted: true,
      typed: nextTyped,
      candidates: remaining,
      complete,
      graceKeys,
    };
  }

  function chooseDisplayTarget(candidates, fallback = "") {
    if (!candidates.length) return fallback;
    return candidates.reduce((preferred, candidate) => {
      const preferredDashes = (preferred.match(/-/g) || []).length;
      const candidateDashes = (candidate.match(/-/g) || []).length;
      if (candidateDashes > preferredDashes) return candidate;
      if (candidateDashes < preferredDashes) return preferred;
      return candidate.length < preferred.length ? candidate : preferred;
    });
  }

  return { expandRomajiVariants, matchRomaji, chooseDisplayTarget };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = NekoTyping;
}

/* ============================================
   MONSTER AND MEMORIES - PARTY PLANNER
   script.js
   Loads spells.csv, powers index.html and library.html
   ============================================ */

// ============================================
// CONFIGURATION
// ============================================

// Image filename map (handles "Shadow Knight" -> "Shadow-Knight.jpg")
const CLASS_IMAGE_MAP = {
  "Elementalist":  "assets/Elementalist.jpg",
  "Necromancer":   "assets/Necromancer.jpg",
  "Wizard":        "assets/Wizard.jpg",
  "Archer":        "assets/Archer.jpg",
  "Ranger":        "assets/Ranger.jpg",
  "Beastmaster":   "assets/Beastmaster.jpg",
  "Monk":          "assets/Monk.jpg",
  "Rogue":         "assets/Rogue.jpg",
  "Spellblade":    "assets/Spellblade.jpg",
  "Cleric":        "assets/Cleric.jpg",
  "Druid":         "assets/Druid.jpg",
  "Shaman":        "assets/Shaman.jpg",
  "Enchanter":     "assets/Enchanter.jpg",
  "Bard":          "assets/Bard.jpg",
  "Fighter":       "assets/Fighter.jpg",
  "Inquisitor":    "assets/Inquisitor.jpg",
  "Paladin":       "assets/Paladin.jpg",
  "Shadow Knight": "assets/Shadow-Knight.jpg"
};

// Approved front page tags only — all others are ignored on index.html
const FRONT_PAGE_TAGS = new Set([
  // Crowd Control
  "Fear", "Mez", "Stun", "Charm", "Pacify", "Snare", "Root", "Blind", "Interrupt",
  // Debuffs
  "Slow", "Stat Debuff", "Spell Damage Vulnerability",
  "Physical Damage Vulnerability", "Reduced Healing", "Mana Burn", "Lower Resistance",
  // Healing
  "Heal Over Time", "Direct Heal", "Resurrection",
  // Buffs
  "+HP", "+AC", "+STR", "+STA", "+DEX", "+AGI", "+INT", "+CHA", "+WIS",
  "Increase Spell Damage", "Movement Speed",
  "Melee Haste", "Spell Haste", "Resist", "Invisibility", "Damage Shield",
  "Mana Regen", "Health Regen",
  // Utility (Pet folded in)
  "Pet", "Purge", "Cure", "Feign Death", "Taunt", "Aggro Gen",
  "Tracking", "Teleport", "Conjure Weapon", "Conjure Arrows", "Conjure Bandage",
  "Conjure Food & Water", "Summon Manastone", "Summon Lifestone"
]);

// Convert class name to CSS slug for color classes
function classSlug(cls) {
  return cls.toLowerCase().replace(/\s+/g, "");
}

// ============================================
// Splits by pipe, trims whitespace, strips
// parenthetical qualifiers like (self only)
// ============================================
function parseTags(rawTag) {
  if (!rawTag) return [];
  return rawTag
    .split("|")
    .map(t => t.replace(/\(.*?\)/g, "").trim())
    .filter(t => t.length > 0);
}

// ============================================
// SHARED: NORMALIZE A TAG FOR MATCHING
// ============================================
function normalizeFrontPageTags(tags) {
  const matched = new Set();
  for (const tag of tags) {
    if (FRONT_PAGE_TAGS.has(tag)) {
      matched.add(tag);
    }
  }
  return matched;
}

// ============================================
// LOAD CSV
// ============================================
let allSpells = [];

function loadCSV(callback) {
  Papa.parse("spells.csv", {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: function(results) {
      allSpells = results.data;
      callback(allSpells);
    },
    error: function(err) {
      console.error("Failed to load spells.csv:", err);
      document.body.innerHTML += `<div style="color:red;padding:20px;">
        Error loading spells.csv. Make sure it is in the same folder as index.html and you are viewing via GitHub Pages or a local server.
      </div>`;
    }
  });
}

// ============================================
// INDEX.HTML LOGIC
// ============================================

function initPartyPlanner(spells) {

  // Build TWO maps per class:
  // classTagMap      — all spells (includes self-only)
  // classTagMapParty — only spells that are NOT exclusively self-only
  //
  // A spell is "self only" if its tag string contains "(self only)"
  // A tag is "party-relevant" for a class if at least ONE spell
  // covering that tag does NOT have (self only).

  const classTagMap = {};       // includes self-only spells
  const classTagMapParty = {};  // excludes self-only spells

  for (const spell of spells) {
    const cls = (spell["Class"] || "").trim();
    if (!cls) continue;
    if (!classTagMap[cls]) classTagMap[cls] = new Set();
    if (!classTagMapParty[cls]) classTagMapParty[cls] = new Set();

    const rawTag = spell["Tag"] || "";
    const isSelfOnly = rawTag.includes("(self only)");
    const tags = parseTags(rawTag);
    const matched = normalizeFrontPageTags(tags);

    for (const t of matched) {
      classTagMap[cls].add(t);
      if (!isSelfOnly) {
        classTagMapParty[cls].add(t);
      }
    }
  }

  // State
  const MAX_PARTY_SIZE = 6;
  const selectedClasses = new Set();

  // DOM references
  const partyDisplay = document.getElementById("party-display");
  const partyCounter = document.getElementById("party-counter");
  const classButtons = document.querySelectorAll(".class-btn[data-class]");
  const tagPills = document.querySelectorAll(".tag-pill");

  // ---- Helper: always use party tag map (personal abilities excluded) ----
  function getTagMap() {
    return classTagMapParty;
  }

  // ---- Button click handler with party size cap ----
  classButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const cls = btn.getAttribute("data-class");
      if (!cls) return;
      if (selectedClasses.has(cls)) {
        selectedClasses.delete(cls);
        btn.classList.remove("active");
      } else {
        // Silently ignore if party is full
        if (selectedClasses.size >= MAX_PARTY_SIZE) return;
        selectedClasses.add(cls);
        btn.classList.add("active");
      }
      updateUI();
    });
  });

  // ---- Update everything ----
  function updateUI() {
    updatePartyDisplay();
    updateTagPills();
    updateCoverage();
    updateRedundancies();
  }

  // Category definitions for progress bars and pill colors
  const CATEGORIES = [
    {
      label: "Crowd Control", color: "#d4a800", colorMuted: "rgba(212,168,0,0.25)",
      tags: ["Fear","Mez","Stun","Charm","Pacify","Snare","Root","Blind","Interrupt"]
    },
    {
      label: "Debuffs", color: "#9966cc", colorMuted: "rgba(153,102,204,0.25)",
      tags: ["Slow","Stat Debuff","Spell Damage Vulnerability","Physical Damage Vulnerability","Reduced Healing","Mana Burn","Lower Resistance"]
    },
    {
      label: "Healing", color: "#44bb66", colorMuted: "rgba(68,187,102,0.25)",
      tags: ["Heal Over Time","Direct Heal","Resurrection"]
    },
    {
      label: "Buffs", color: "#4488cc", colorMuted: "rgba(68,136,204,0.25)",
      tags: ["+HP","+AC","+STR","+STA","+DEX","+AGI","+INT","+CHA","+WIS","Increase Spell Damage","Movement Speed","Melee Haste","Spell Haste","Resist","Invisibility","Damage Shield","Mana Regen","Health Regen"]
    },
    {
      label: "Utility", color: "#e0e0e0", colorMuted: "rgba(224,224,224,0.2)",
      tags: ["Pet","Purge","Cure","Feign Death","Taunt","Aggro Gen","Tracking","Teleport","Conjure Weapon","Conjure Arrows","Conjure Bandage","Conjure Food & Water","Summon Manastone","Summon Lifestone"]
    },
  ];

  // Build a tag -> category lookup for pill coloring
  const TAG_CATEGORY = {};
  for (const cat of CATEGORIES) {
    for (const tag of cat.tags) {
      TAG_CATEGORY[tag] = cat;
    }
  }

  const coverageEl = document.getElementById("coverage-progress");

  // ---- Party counter ----
  function updatePartyCounter() {
    if (partyCounter) {
      partyCounter.textContent = selectedClasses.size > 0
        ? `Party: ${selectedClasses.size} / ${MAX_PARTY_SIZE}`
        : "";
    }
  }

  // ---- Coverage progress bars ----
  function updateCoverage() {
    const coveredTags = new Set();
    for (const cls of selectedClasses) {
      const tags = getTagMap()[cls] || new Set();
      for (const t of tags) coveredTags.add(t);
    }

    coverageEl.innerHTML = "";

    for (const cat of CATEGORIES) {
      const total = cat.tags.length;
      const covered = cat.tags.filter(t => coveredTags.has(t)).length;
      const pct = total === 0 ? 0 : Math.round((covered / total) * 100);

      const row = document.createElement("div");
      row.className = "progress-row";
      row.innerHTML = `
        <div class="progress-label">
          <span class="progress-cat-name" style="color:${cat.color}">${cat.label}</span>
          <span class="progress-fraction">${covered}/${total}</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width:${pct}%; background:${cat.color};"></div>
        </div>
      `;
      coverageEl.appendChild(row);
    }
  }

  // ---- Redundancies (category-grouped) ----

  // Derive icon path from tag name: lowercase, spaces→hyphens, special chars stripped
  function tagIconPath(tag) {
    const overrides = {
      "+STR": "stat-str", "+STA": "stat-sta", "+DEX": "stat-dex",
      "+AGI": "stat-agi", "+INT": "stat-int", "+CHA": "stat-cha",
      "+WIS": "stat-wis", "+HP": "stat-hp", "+AC": "stat-ac",
      "Conjure Food & Water": "conjure-food-water",
    };
    const slug = overrides[tag] || tag.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    return `assets/icons/${slug}.svg`;
  }

  function updateRedundancies() {
    const grid = document.getElementById("redundancy-grid");
    const emptyMsg = document.getElementById("redundancy-empty");
    if (!grid) return;

    [...grid.querySelectorAll(".redundancy-cat-block")].forEach(el => el.remove());

    if (selectedClasses.size < 2) {
      if (emptyMsg) emptyMsg.style.display = "inline";
      return;
    }
    if (emptyMsg) emptyMsg.style.display = "none";

    const catCssMap = {
      "Crowd Control": "cat-cc",
      "Debuffs":       "cat-debuff",
      "Healing":       "cat-healing",
      "Buffs":         "cat-buff",
      "Utility":       "cat-utility",
    };

    let anyRedundancy = false;

    for (const cat of CATEGORIES) {
      const redundantRows = [];

      for (const tag of cat.tags) {
        const overlapping = [];
        for (const cls of selectedClasses) {
          const tags = getTagMap()[cls] || new Set();
          if (tags.has(tag)) overlapping.push(cls);
        }
        if (overlapping.length > 1) {
          redundantRows.push({ tag, classes: overlapping });
        }
      }

      if (redundantRows.length === 0) continue;
      anyRedundancy = true;

      const block = document.createElement("div");
      block.className = "redundancy-cat-block";

      const title = document.createElement("div");
      title.className = `redundancy-cat-title ${catCssMap[cat.label] || ""}`;
      title.textContent = cat.label;
      block.appendChild(title);

      const rows = document.createElement("div");
      rows.className = "redundancy-rows";

      redundantRows.forEach(({ tag, classes }, i) => {
        if (i > 0) {
          const divider = document.createElement("div");
          divider.className = "redundancy-divider";
          rows.appendChild(divider);
        }

        const row = document.createElement("div");
        row.className = "redundancy-row";

        const classesHtml = classes
          .map(c => `<span class="cls-text-${classSlug(c)}">${c}</span>`)
          .join('<span class="redundancy-dot"> · </span>');

        row.innerHTML = `
          <div class="redundancy-tag-left">
            <img class="redundancy-icon" src="${tagIconPath(tag)}" alt="" onerror="this.style.display='none'">
            <span class="redundancy-tag-name">${tag}</span>
          </div>
          <div class="redundancy-class-list">${classesHtml}</div>
        `;

        rows.appendChild(row);
      });

      block.appendChild(rows);
      grid.appendChild(block);
    }

    if (!anyRedundancy && emptyMsg) {
      emptyMsg.textContent = "No overlapping capabilities in current party.";
      emptyMsg.style.display = "inline";
    }
  }

  // ---- Party display ----
  function updatePartyDisplay() {
    updatePartyCounter();
    partyDisplay.innerHTML = "";
    if (selectedClasses.size === 0) {
      partyDisplay.innerHTML = '<div class="empty-message">Select classes below to build your party</div>';
      return;
    }
    for (const cls of selectedClasses) {
      if (!cls || !CLASS_IMAGE_MAP[cls]) continue;
      const member = document.createElement("div");
      member.className = "party-member";
      member.title = `Click to remove ${cls}`;
      member.innerHTML = `
        <img src="${CLASS_IMAGE_MAP[cls] || ''}" alt="${cls}" onerror="this.style.display='none'" />
        <div class="member-name">${cls}</div>
      `;
      member.addEventListener("click", () => {
        selectedClasses.delete(cls);
        classButtons.forEach(btn => {
          if (btn.getAttribute("data-class") === cls) btn.classList.remove("active");
        });
        updateUI();
      });
      partyDisplay.appendChild(member);
    }
  }

  // ---- Tag pills (covered / uncovered with category colors) ----
  function updateTagPills() {
    const coveredTags = new Set();
    for (const cls of selectedClasses) {
      const tags = getTagMap()[cls] || new Set();
      for (const t of tags) coveredTags.add(t);
    }

    tagPills.forEach(pill => {
      const tag = pill.getAttribute("data-tag");
      const cat = TAG_CATEGORY[tag];
      if (coveredTags.has(tag)) {
        pill.classList.add("covered");
        pill.classList.remove("uncovered");
        if (cat) {
          pill.style.background = cat.color;
          pill.style.borderColor = cat.color;
          pill.style.color = "#111";
        }
      } else {
        pill.classList.add("uncovered");
        pill.classList.remove("covered");
        if (cat) {
          pill.style.background = cat.colorMuted;
          pill.style.borderColor = cat.color;
          pill.style.color = cat.color;
        }
      }
    });
  }

  // Initialize with default state
  updateUI();
}

// ============================================
// TAG COLOR MAP — used in library table pills
// ============================================

const TAG_COLOR_MAP = (() => {
  // Category definitions
  const CC      = { bg: "rgba(212,168,0,0.2)",    border: "#d4a800", text: "#d4a800" };
  const DEBUFF  = { bg: "rgba(153,102,204,0.2)",  border: "#9966cc", text: "#cc88ff" };
  const HEAL    = { bg: "rgba(68,187,102,0.2)",   border: "#44bb66", text: "#44bb66" };
  const BUFF    = { bg: "rgba(68,136,204,0.2)",   border: "#4488cc", text: "#66aaee" };
  const UTILITY = { bg: "rgba(224,224,224,0.1)",  border: "#888",    text: "#cccccc" };
  const DAMAGE  = { bg: "rgba(220,80,60,0.2)",    border: "#cc4433", text: "#ff7755" };
  const SIT     = { bg: "rgba(220,80,160,0.15)",  border: "#cc44aa", text: "#ff88dd" };

  const map = {};

  for (const t of ["Direct Damage","Damage Over Time","Lifesteal","Lifetap"]) map[t] = DAMAGE;
  for (const t of ["Fear","Mez","Stun","Charm","Pacify","Snare","Root","Blind","Interrupt"]) map[t] = CC;
  for (const t of ["Slow","Stat Debuff","Spell Damage Vulnerability","Physical Damage Vulnerability",
    "Reduced Healing","Mana Burn","Lower Resistance"]) map[t] = DEBUFF;
  for (const t of ["Heal Over Time","Direct Heal","Resurrection","Transfer Health"]) map[t] = HEAL;
  for (const t of ["+HP","+AC","+STR","+STA","+DEX","+AGI","+INT","+CHA","+WIS",
    "Increase Physical Damage","Increase Spell Damage","Movement Speed","Melee Haste","Spell Haste",
    "Resist","Invisibility","Damage Shield","Absorb Damage Shield","Mana Regen","Health Regen",
    "Transfer Mana","Damage Reduction"]) map[t] = BUFF;
  for (const t of ["Pet","Purge","Cure","Feign Death","Taunt","Aggro Gen","Trap","Enduring Breath",
    "Stealth / Hide","Aggro Reduction","Tracking","Bind","Teleport","Gate","Conjure Weapon",
    "Conjure Arrows","Conjure Bandage","Conjure Food & Water","Summon Manastone","Summon Lifestone",
    "Shapeshift","Misc."]) map[t] = UTILITY;
  for (const t of ["AoE","AURA","(pet only)","(undead only)","(elementals only)","(animals only)",
    "(self only)","Physical","Fire","Cold","Electricity","Poison","Disease","Corruption","Magic","Holy"]) map[t] = SIT;

  return map;
})();

// Tags grouped by category — used for category-level filtering in the dropdown
const CATEGORY_TAGS = {
  "DAMAGE":        ["Direct Damage","Damage Over Time","Lifesteal","Lifetap"],
  "CROWD CONTROL": ["Fear","Mez","Stun","Charm","Pacify","Snare","Root","Blind","Interrupt"],
  "DEBUFFS":       ["Slow","Stat Debuff","Spell Damage Vulnerability","Physical Damage Vulnerability","Reduced Healing","Mana Burn","Lower Resistance"],
  "HEALING":       ["Heal Over Time","Direct Heal","Resurrection","Transfer Health","Lifesteal","Lifetap"],
  "BUFF":          ["+HP","+AC","+STR","+STA","+DEX","+AGI","+INT","+CHA","+WIS","Increase Physical Damage","Increase Spell Damage","Movement Speed","Melee Haste","Spell Haste","Resist","Invisibility","Damage Shield","Absorb Damage Shield","Mana Regen","Health Regen","Transfer Mana","Damage Reduction"],
  "UTILITY":       ["Pet","Purge","Cure","Feign Death","Taunt","Aggro Gen","Trap","Enduring Breath","Stealth / Hide","Aggro Reduction","Tracking","Bind","Teleport","Gate","Conjure Weapon","Conjure Arrows","Conjure Bandage","Conjure Food & Water","Summon Manastone","Summon Lifestone","Shapeshift","Misc."],
  "SITUATIONAL":   ["AoE","AURA","(pet only)","(undead only)","(elementals only)","(animals only)","(self only)","Physical","Fire","Cold","Electricity","Poison","Disease","Corruption","Magic","Holy"],
};

// ============================================
// LIBRARY.HTML LOGIC
// ============================================

function initLibrary(spells) {
  const tbody = document.getElementById("spell-tbody");
  const searchInput = document.getElementById("search-input");
  const filterSkill = document.getElementById("filter-skill");
  const filterTag = document.getElementById("filter-tag");
  const levelMin = document.getElementById("level-min");
  const levelMax = document.getElementById("level-max");
  const clearBtn = document.getElementById("clear-filters");
  const resultCount = document.getElementById("result-count");
  const selectAllBtn = document.getElementById("btn-select-all");
  const clearAllBtn = document.getElementById("btn-clear-all");
  const libClassBtns = document.querySelectorAll(".lib-class-btn");

  // All classes selected by default
  const selectedClasses = new Set(
    [...libClassBtns].map(b => b.getAttribute("data-class"))
  );

  // Populate skill dropdown dynamically from CSV
  const skills = [...new Set(spells.map(s => (s["Skill"] || "").trim()).filter(Boolean))].sort();
  skills.forEach(sk => {
    const opt = document.createElement("option");
    opt.value = sk; opt.textContent = sk;
    filterSkill.appendChild(opt);
  });

  // Class button toggles
  libClassBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const cls = btn.getAttribute("data-class");
      if (selectedClasses.has(cls)) {
        selectedClasses.delete(cls);
        btn.classList.remove("active");
      } else {
        selectedClasses.add(cls);
        btn.classList.add("active");
      }
      renderTable();
    });
  });

  selectAllBtn.addEventListener("click", () => {
    libClassBtns.forEach(btn => {
      selectedClasses.add(btn.getAttribute("data-class"));
      btn.classList.add("active");
    });
    renderTable();
  });

  clearAllBtn.addEventListener("click", () => {
    libClassBtns.forEach(btn => {
      selectedClasses.delete(btn.getAttribute("data-class"));
      btn.classList.remove("active");
    });
    renderTable();
  });

  // Sorting state
  let sortCol = "Level";
  let sortAsc = true;

  document.querySelectorAll("#spell-table th").forEach(th => {
    th.addEventListener("click", () => {
      const col = th.getAttribute("data-col");
      if (sortCol === col) {
        sortAsc = !sortAsc;
      } else {
        sortCol = col;
        sortAsc = true;
      }
      renderTable();
    });
  });

  function getFiltered() {
    const search = searchInput.value.toLowerCase().trim();
    const skill = filterSkill.value;
    const tagValue = filterTag.value.trim();
    const minLv = levelMin.value !== "" ? parseInt(levelMin.value) : null;
    const maxLv = levelMax.value !== "" ? parseInt(levelMax.value) : null;

    // Determine if filtering by a whole category or a single tag
    let filterTagSet = null;  // Set of tags to match (any) — used for category filter
    let filterSingleTag = ""; // Exact single tag match

    if (tagValue.startsWith("__cat__")) {
      const catName = tagValue.replace("__cat__", "");
      filterTagSet = new Set(CATEGORY_TAGS[catName] || []);
    } else {
      filterSingleTag = tagValue.toLowerCase();
    }

    return spells.filter(spell => {
      const cls = (spell["Class"] || "").trim();
      if (!selectedClasses.has(cls)) return false;

      if (skill && (spell["Skill"] || "").trim() !== skill) return false;

      const spellLevel = parseInt((spell["Level"] || "").trim());
      if (minLv !== null && spellLevel < minLv) return false;
      if (maxLv !== null && spellLevel > maxLv) return false;

      if (search) {
        const name = (spell["Spell Name"] || "").toLowerCase();
        const desc = (spell["Spell Description"] || "").toLowerCase();
        if (!name.includes(search) && !desc.includes(search)) return false;
      }

      if (filterTagSet) {
        const spellTags = parseTags(spell["Tag"]);
        if (!spellTags.some(t => filterTagSet.has(t))) return false;
      } else if (filterSingleTag) {
        const spellTags = parseTags(spell["Tag"]);
        if (!spellTags.some(t => t.toLowerCase() === filterSingleTag)) return false;
      }

      return true;
    });
  }

  function getSorted(data) {
    return [...data].sort((a, b) => {
      let va = (a[sortCol] || "").toString().trim();
      let vb = (b[sortCol] || "").toString().trim();
      if (sortCol === "Level" || sortCol === "Mana") {
        va = parseFloat(va) || 0;
        vb = parseFloat(vb) || 0;
        return sortAsc ? va - vb : vb - va;
      }
      return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }

  function renderTable() {
    const filtered = getFiltered();
    const sorted = getSorted(filtered);

    resultCount.textContent = `Showing ${sorted.length} of ${spells.length} spells`;
    tbody.innerHTML = "";

    if (sorted.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="no-results">No spells match your filters.</td></tr>';
      return;
    }

    for (const spell of sorted) {
      const tr = document.createElement("tr");
      const slug = classSlug(spell["Class"] || "");
      tr.className = `cls-${slug}`;

      // Build colored tag pills
      const rawTags = (spell["Tag"] || "").trim();
      const tagPillsHtml = rawTags
        ? rawTags.split("|").map(t => {
            const trimmed = t.trim();
            // Strip parentheticals to look up the base tag color, keep original text
            const baseTag = trimmed.replace(/\(.*?\)/g, "").trim();
            const color = TAG_COLOR_MAP[trimmed] || TAG_COLOR_MAP[baseTag] || null;
            if (color) {
              return `<span class="lib-tag-pill" style="background:${color.bg};border-color:${color.border};color:${color.text}">${trimmed}</span>`;
            }
            return `<span class="lib-tag-pill lib-tag-pill-default">${trimmed}</span>`;
          }).join("")
        : "";

      tr.innerHTML = `
        <td>${spell["Level"] || ""}</td>
        <td>${spell["Spell Name"] || ""}</td>
        <td class="spell-desc">${spell["Spell Description"] || ""}</td>
        <td>${spell["Skill"] || ""}</td>
        <td>${spell["Mana"] || ""}</td>
        <td class="spell-tags-cell"><div class="spell-tags">${tagPillsHtml}</div></td>
        <td class="spell-class cls-text-${slug}">${spell["Class"] || ""}</td>
      `;
      tbody.appendChild(tr);
    }
  }

  // Event listeners
  searchInput.addEventListener("input", renderTable);
  filterSkill.addEventListener("change", renderTable);
  filterTag.addEventListener("change", renderTable);
  levelMin.addEventListener("input", renderTable);
  levelMax.addEventListener("input", renderTable);

  clearBtn.addEventListener("click", () => {
    searchInput.value = "";
    filterSkill.value = "";
    filterTag.value = "";
    levelMin.value = "";
    levelMax.value = "";
    libClassBtns.forEach(btn => {
      selectedClasses.add(btn.getAttribute("data-class"));
      btn.classList.add("active");
    });
    renderTable();
  });

  renderTable();
}

// ============================================
// DISCLAIMER NOTICE POPUP
// Shows once per day, shared across both pages
// via localStorage. Edit notice.json to update.
// ============================================

function initNotice() {
  const overlay = document.getElementById("notice-overlay");
  if (!overlay) return;

  const STORAGE_KEY = "mnm_notice_seen_date";
  const today = new Date().toISOString().slice(0, 10);
  const lastSeen = localStorage.getItem(STORAGE_KEY);

  if (lastSeen === today) return;

  fetch("notice.json")
    .then(r => r.json())
    .then(data => {
      document.getElementById("notice-title").textContent = data.title || "Notice";

      const bodyEl = document.getElementById("notice-body");
      const paragraphs = (data.message || "").split("\n\n");
      bodyEl.innerHTML = paragraphs
        .map(p => `<p>${p.replace(/\n/g, "<br>")}</p>`)
        .join("");

      document.getElementById("notice-date").textContent = data.lastUpdated || "";

      const linkEl = document.getElementById("notice-link");
      if (data.linkText && data.linkUrl) {
        linkEl.textContent = data.linkText;
        linkEl.href = data.linkUrl;
        linkEl.style.display = "inline-block";
      } else {
        linkEl.style.display = "none";
      }

      overlay.style.display = "flex";
    })
    .catch(() => {});

  document.getElementById("notice-close").addEventListener("click", closeNotice);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeNotice();
  });

  function closeNotice() {
    overlay.style.display = "none";
    localStorage.setItem(STORAGE_KEY, today);
  }
}

// ============================================
// SCROLL TO TOP BUTTON — runs immediately on DOM ready
// ============================================

(function initScrollTopBtn() {
  const btn = document.getElementById("scroll-top-btn");
  if (!btn) return;

  window.addEventListener("scroll", () => {
    if (window.scrollY > 300) {
      btn.classList.add("visible");
    } else {
      btn.classList.remove("visible");
    }
  }, { passive: true });

  btn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
})();

// ============================================
// ROUTER — detect which page we're on
// ============================================

(function loadPapaParse() {
  const script = document.createElement("script");
  script.src = "https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js";
  script.onload = function() {
    loadCSV(function(spells) {
      initNotice();
      if (document.getElementById("party-display")) {
        initPartyPlanner(spells);
      } else if (document.getElementById("spell-tbody")) {
        initLibrary(spells);
      }
    });
  };
  document.head.appendChild(script);
})();

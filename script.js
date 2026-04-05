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
  "Fear", "Mez / Stun", "Charm", "Lull / Pacify", "Snare", "Root", "Blind",
  // Debuffs
  "Slow", "Stat Debuff / Steal", "Spell Damage Vulnerability",
  "Physical Damage Vulnerability", "Reduced Healing", "Mana Burn", "Lower Resistance",
  // Healing
  "Heal Over Time", "Direct Heal", "Resurrection",
  // Buffs
  "+HP", "+AC", "+STR", "+STA", "+DEX", "+AGI", "+INT", "+CHA", "+WIS",
  "Increase Physical Damage", "Increase Spell Damage", "Movement Speed",
  "Melee Haste", "Spell Haste", "Resist", "Invisibility", "Damage Shield",
  "Mana Regen", "Health Regen",
  // Pet
  "Pet",
  // Utility
  "Purge", "Cure", "Feign Death", "Interrupt", "Taunt / Aggro Gen",
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
// Handles "Resist | Cold" -> "Resist"
// The first meaningful token is used for
// front page matching when needed
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
  // classTagMap     — all spells (includes self-only)
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
  const selectedClasses = new Set();
  let hideSelfOnly = false;

  // DOM references
  const partyDisplay = document.getElementById("party-display");
  const classButtons = document.querySelectorAll(".class-btn[data-class]");
  const tagPills = document.querySelectorAll(".tag-pill");
  const missingList = document.getElementById("missing-list");
  const redundancyList = document.getElementById("redundancy-list");
  const toggleSelfOnlyBtn = document.getElementById("toggle-self-only");

  // ---- Self-only toggle button ----
  if (toggleSelfOnlyBtn) {
    toggleSelfOnlyBtn.addEventListener("click", () => {
      hideSelfOnly = !hideSelfOnly;
      toggleSelfOnlyBtn.textContent = hideSelfOnly
        ? "Include Personal Abilities"
        : "Hide Personal Abilities";
      toggleSelfOnlyBtn.classList.toggle("active", hideSelfOnly);
      updateUI();
    });
  }

  // ---- Helper: get active tag map based on toggle ----
  function getTagMap() {
    return hideSelfOnly ? classTagMapParty : classTagMap;
  }

  // ---- Button click handler ----
  classButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const cls = btn.getAttribute("data-class");
      if (!cls) return;
      if (selectedClasses.has(cls)) {
        selectedClasses.delete(cls);
        btn.classList.remove("active");
      } else {
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
    updateMissing();
    updateRedundancies();
  }

  // ---- Party display (class images) ----
  function updatePartyDisplay() {
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
        // Un-toggle corresponding button
        classButtons.forEach(btn => {
          if (btn.getAttribute("data-class") === cls) btn.classList.remove("active");
        });
        updateUI();
      });
      partyDisplay.appendChild(member);
    }
  }

  // ---- Tag pills (covered / uncovered) ----
  function updateTagPills() {
    const coveredTags = new Set();
    for (const cls of selectedClasses) {
      const tags = getTagMap()[cls] || new Set();
      for (const t of tags) coveredTags.add(t);
    }

    tagPills.forEach(pill => {
      const tag = pill.getAttribute("data-tag");
      if (coveredTags.has(tag)) {
        pill.classList.add("covered");
        pill.classList.remove("uncovered");
      } else {
        pill.classList.add("uncovered");
        pill.classList.remove("covered");
      }
    });
  }

  // ---- Missing tags ----
  function updateMissing() {
    const coveredTags = new Set();
    for (const cls of selectedClasses) {
      const tags = getTagMap()[cls] || new Set();
      for (const t of tags) coveredTags.add(t);
    }

    missingList.innerHTML = "";
    const missing = [...FRONT_PAGE_TAGS].filter(t => !coveredTags.has(t));

    if (missing.length === 0) {
      missingList.innerHTML = '<span class="panel-empty">All tags covered!</span>';
      return;
    }

    for (const tag of missing) {
      const el = document.createElement("span");
      el.className = "missing-tag";
      el.textContent = tag;
      missingList.appendChild(el);
    }
  }

  // ---- Redundancies ----
  function updateRedundancies() {
    redundancyList.innerHTML = "";

    if (selectedClasses.size < 2) {
      redundancyList.innerHTML = '<span class="panel-empty">Select two or more classes to see overlaps.</span>';
      return;
    }

    const tagCoverage = {};
    for (const tag of FRONT_PAGE_TAGS) {
      tagCoverage[tag] = [];
      for (const cls of selectedClasses) {
        const tags = getTagMap()[cls] || new Set();
        if (tags.has(tag)) tagCoverage[tag].push(cls);
      }
    }

    const redundant = Object.entries(tagCoverage).filter(([, classes]) => classes.length > 1);

    if (redundant.length === 0) {
      redundancyList.innerHTML = '<span class="panel-empty">No overlapping tags in current party.</span>';
      return;
    }

    for (const [tag, classes] of redundant) {
      const item = document.createElement("div");
      item.className = "redundancy-item";
      const classesHtml = classes
        .map(c => `<span class="cls-text-${classSlug(c)}">${c}</span>`)
        .join('<span style="color:var(--text-muted);">, </span>');
      item.innerHTML = `
        <span class="redundancy-tag">${tag}</span>
        <span class="redundancy-classes">${classesHtml}</span>
      `;
      redundancyList.appendChild(item);
    }
  }

  // Initialize with empty state
  updateUI();
}

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
    const tag = filterTag.value.trim();
    const minLv = levelMin.value !== "" ? parseInt(levelMin.value) : null;
    const maxLv = levelMax.value !== "" ? parseInt(levelMax.value) : null;

    return spells.filter(spell => {
      // Class filter — must be in selected set
      const cls = (spell["Class"] || "").trim();
      if (!selectedClasses.has(cls)) return false;

      // Skill filter
      if (skill && (spell["Skill"] || "").trim() !== skill) return false;

      // Level range filter
      const spellLevel = parseInt((spell["Level"] || "").trim());
      if (minLv !== null && spellLevel < minLv) return false;
      if (maxLv !== null && spellLevel > maxLv) return false;

      // Text search
      if (search) {
        const name = (spell["Spell Name"] || "").toLowerCase();
        const desc = (spell["Spell Description"] || "").toLowerCase();
        if (!name.includes(search) && !desc.includes(search)) return false;
      }

      // Tag filter — exact match against parsed tags
      if (tag) {
        const spellTags = parseTags(spell["Tag"]);
        const tagLower = tag.toLowerCase();
        if (!spellTags.some(t => t.toLowerCase() === tagLower)) return false;
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
      tr.innerHTML = `
        <td>${spell["Level"] || ""}</td>
        <td>${spell["Spell Name"] || ""}</td>
        <td class="spell-desc">${spell["Spell Description"] || ""}</td>
        <td>${spell["Skill"] || ""}</td>
        <td>${spell["Mana"] || ""}</td>
        <td class="spell-tags">${(spell["Tag"] || "").trim()}</td>
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
    // Reset class buttons to all selected
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
  const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  const lastSeen = localStorage.getItem(STORAGE_KEY);

  // Already seen today — don't show
  if (lastSeen === today) return;

  // Fetch notice.json from repo
  fetch("notice.json")
    .then(r => r.json())
    .then(data => {
      // Populate content
      document.getElementById("notice-title").textContent = data.title || "Notice";

      // Support \n line breaks in message
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

      // Show overlay
      overlay.style.display = "flex";
    })
    .catch(() => {
      // If notice.json can't load, silently skip
    });

  // Close button
  document.getElementById("notice-close").addEventListener("click", closeNotice);

  // Click outside card to close
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeNotice();
  });

  function closeNotice() {
    overlay.style.display = "none";
    localStorage.setItem(STORAGE_KEY, today);
  }
}

// ============================================
// ROUTER — detect which page we're on
// ============================================

// Load PapaParse from CDN then kick off
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

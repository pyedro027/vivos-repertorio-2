(function app() {
  const MEMBERS = ["Pastor Aluísio", "Rafaela", "Lucas", "Gustavo", "Luísa", "Dayane"];
  const KEY_OPTIONS = ["", "C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
  const CHUNK_SIZE = 50;

  const state = {
    songs: [],
    filteredSongs: [],
    selectedSong: null,
    selectedKeys: [],
    keysCache: {},
    detailTab: "keys",
    lastFocusEl: null
  };

  const el = {
    searchInput:    document.getElementById("searchInput"),
    songsList:      document.getElementById("songsList"),
    songCount:      document.getElementById("songCount"),
    emptyState:     document.getElementById("emptyState"),
    toast:          document.getElementById("toast"),
    addSongBtn:     document.getElementById("addSongBtn"),
    bulkImportBtn:  document.getElementById("bulkImportBtn"),
    songModal:      document.getElementById("songModal"),
    importModal:    document.getElementById("importModal"),
    detailModal:    document.getElementById("detailModal"),
    confirmModal:   document.getElementById("confirmModal"),
    confirmMessage: document.getElementById("confirmMessage"),
    confirmYes:     document.getElementById("confirmYes"),
    confirmNo:      document.getElementById("confirmNo"),
    newSongTitle:   document.getElementById("newSongTitle"),
    confirmAddSong: document.getElementById("confirmAddSong"),
    bulkText:       document.getElementById("bulkText"),
    stripNumbers:   document.getElementById("stripNumbers"),
    confirmImport:  document.getElementById("confirmImport"),
    importSummary:  document.getElementById("importSummary"),
    detailTitle:    document.getElementById("detailTitle"),
    keyFields:      document.getElementById("keyFields"),
    lyricsField:    document.getElementById("lyricsField"),
    saveAllKeys:    document.getElementById("saveAllKeys"),
    saveLyrics:     document.getElementById("saveLyrics"),
    deleteSongBtn:  document.getElementById("deleteSongBtn"),
    tabKeys:        document.getElementById("tabKeys"),
    tabLyrics:      document.getElementById("tabLyrics"),
    paneKeys:       document.getElementById("paneKeys"),
    paneLyrics:     document.getElementById("paneLyrics"),
    brandLogo:      document.getElementById("brandLogo"),
    brandFallback:  document.getElementById("brandFallback"),
    navRepertorio:  document.getElementById("navRepertorio"),
    cifraUrlField:  document.getElementById("cifraUrlField"),
    openCifraBtn:   document.getElementById("openCifraBtn"),
    saveCifraBtn:   document.getElementById("saveCifraBtn"),
  };

  // ===================== UTILS =====================

  function normalizeTitle(title, stripNumberPrefix = false) {
    let value = (title || "").trim();
    if (stripNumberPrefix) value = value.replace(/^\s*\d+[\.\-\)]\s*/, "");
    value = value.replace(/\s+/g, " ").trim();
    return { title: value, norm: value.toLocaleLowerCase("pt-BR") };
  }

  function showToast(message, type = "default") {
    el.toast.textContent = message;
    el.toast.dataset.type = type;
    el.toast.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => el.toast.classList.remove("show"), 2000);
  }

  function debounce(fn, delay = 300) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
  }

  function openModal(modal, focusTarget = null) {
    state.lastFocusEl = document.activeElement;
    modal.classList.remove("hidden");
    setTimeout(() => {
      const t = focusTarget || modal.querySelector("input, textarea, button");
      if (t) t.focus();
    }, 50);
  }

  function closeModal(modal) {
    modal.classList.add("hidden");
    if (state.lastFocusEl?.focus) state.lastFocusEl.focus();
  }

  function showConfirm(message) {
    return new Promise((resolve) => {
      el.confirmMessage.textContent = message;
      openModal(el.confirmModal, el.confirmNo);
      function onYes() { cleanup(); resolve(true); }
      function onNo()  { cleanup(); resolve(false); }
      function cleanup() {
        el.confirmYes.removeEventListener("click", onYes);
        el.confirmNo.removeEventListener("click", onNo);
        closeModal(el.confirmModal);
      }
      el.confirmYes.addEventListener("click", onYes);
      el.confirmNo.addEventListener("click", onNo);
    });
  }

  function getDefaultCifraSearchUrl(title) {
    const q = encodeURIComponent(title || "");
    return `https://www.bananacifras.com/search?q=${q}`;
  }

  function openCifra() {
    if (!state.selectedSong) return;
    const url = (el.cifraUrlField?.value || "").trim() || getDefaultCifraSearchUrl(state.selectedSong.title);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function saveCifraUrl() {
    if (!state.selectedSong) return;
    const raw = (el.cifraUrlField?.value || "").trim();
    const url = raw || getDefaultCifraSearchUrl(state.selectedSong.title);
    const { error } = await window.supabaseClient
      .from("songs")
      .update({ cifra_url: url })
      .eq("id", state.selectedSong.id);
    if (error) { console.error(error); showToast("Erro ao salvar link da cifra."); return; }
    el.cifraUrlField.value = url;
    showToast("✓ Link da cifra salvo!", "success");
  }

  // ===================== REPERTÓRIO =====================

  function renderSongs() {
    el.songsList.innerHTML = "";
    el.songCount.textContent = String(state.filteredSongs.length);
    el.emptyState.style.display = state.filteredSongs.length > 0 ? "none" : "block";

    state.filteredSongs.forEach((song) => {
      const li  = document.createElement("li");
      const btn = document.createElement("button");
      btn.type  = "button";

      const row = document.createElement("div");
      row.className = "song-card-row";

      const titleEl = document.createElement("span");
      titleEl.className = "song-title";
      titleEl.textContent = song.title;

      row.append(titleEl);

      const keysRow = document.createElement("span");
      keysRow.className = "song-keys-preview";
      const cached = state.keysCache[song.id] || [];
      cached.forEach(({ member_name, key }) => {
        if (!key) return;
        const chip = document.createElement("span");
        chip.className = "key-chip";
        chip.textContent = `${member_name.split(" ")[0]}: ${key}`;
        keysRow.appendChild(chip);
      });

      btn.append(row, keysRow);
      btn.addEventListener("click", () => openDetail(song.id));
      li.appendChild(btn);
      el.songsList.appendChild(li);
    });
  }

  function applyFilter(query = "") {
    const q = query.trim().toLocaleLowerCase("pt-BR");
    state.filteredSongs = state.songs.filter(s => s.title_norm.includes(q));
    renderSongs();
  }

  // ===================== SUPABASE — MÚSICAS =====================

  async function loadSongs() {
    if (!window.supabaseClient) { showToast("Supabase não configurado."); return; }
    const { data, error } = await window.supabaseClient
      .from("songs").select("id, title, title_norm").order("title", { ascending: true });
    if (error) { console.error(error); showToast("Erro ao carregar músicas."); return; }
    state.songs = data || [];
    await loadAllKeys();
    applyFilter(el.searchInput.value);
  }

  async function loadAllKeys() {
    if (!state.songs.length) return;
    const ids = state.songs.map(s => s.id);
    const { data, error } = await window.supabaseClient
      .from("song_keys").select("song_id, member_name, key").in("song_id", ids);
    if (error) { console.error(error); return; }
    state.keysCache = {};
    (data || []).forEach(row => {
      if (!state.keysCache[row.song_id]) state.keysCache[row.song_id] = [];
      state.keysCache[row.song_id].push({ member_name: row.member_name, key: row.key });
    });
  }

  async function addSong(title) {
    const parsed = normalizeTitle(title);
    if (!parsed.title) { showToast("Informe um título válido."); return; }
    const { error } = await window.supabaseClient
      .from("songs").insert({ title: parsed.title, title_norm: parsed.norm });
    if (error) {
      showToast(error.code === "23505" ? "Essa música já existe." : "Erro ao salvar música.");
      return;
    }
    closeModal(el.songModal);
    el.newSongTitle.value = "";
    await loadSongs();
    showToast("✓ Música adicionada!", "success");
  }

  // ===================== DETALHES =====================

  async function openDetail(songId) {
    state.selectedSong = state.songs.find(s => s.id === songId);
    if (!state.selectedSong) return;

    const { data: keysData, error: keysErr } = await window.supabaseClient
      .from("song_keys").select("id, member_name, key")
      .eq("song_id", songId).order("member_name", { ascending: true });
    if (keysErr) { console.error(keysErr); showToast("Erro ao carregar tons."); return; }

    const mapByMember = new Map((keysData || []).map(k => [k.member_name, k]));
    state.selectedKeys = MEMBERS.map(name => {
      const ex = mapByMember.get(name);
      return { id: ex?.id || null, member_name: name, key: ex?.key || "" };
    });

    const { data: songData } = await window.supabaseClient
      .from("songs").select("lyrics, cifra_url").eq("id", songId).single();

    el.lyricsField.value = songData?.lyrics || "";
    if (el.cifraUrlField) el.cifraUrlField.value = songData?.cifra_url || "";

    el.detailTitle.textContent = state.selectedSong.title;
    switchDetailTab("keys");
    renderKeyFields();
    openModal(el.detailModal);
  }

  function switchDetailTab(tab) {
    state.detailTab = tab;
    el.tabKeys.classList.toggle("tab-active", tab === "keys");
    el.tabLyrics.classList.toggle("tab-active", tab === "lyrics");
    el.paneKeys.classList.toggle("hidden", tab !== "keys");
    el.paneLyrics.classList.toggle("hidden", tab !== "lyrics");
  }

  function renderKeyFields() {
    el.keyFields.innerHTML = "";
    state.selectedKeys.forEach((item, index) => {
      const wrap = document.createElement("div");
      wrap.className = "key-field";

      const label = document.createElement("label");
      label.textContent = item.member_name;

      const keySelector = document.createElement("div");
      keySelector.className = "key-selector";

      const btnPrev = document.createElement("button");
      btnPrev.type = "button";
      btnPrev.className = "key-nav-btn";
      btnPrev.innerHTML = "&#8249;";

      const keyDisplay = document.createElement("span");
      keyDisplay.className = "key-display";

      const btnNext = document.createElement("button");
      btnNext.type = "button";
      btnNext.className = "key-nav-btn";
      btnNext.innerHTML = "&#8250;";

      function getIdx() {
        const i = KEY_OPTIONS.indexOf(state.selectedKeys[index].key);
        return i === -1 ? 0 : i;
      }
      function updateDisplay() {
        const k = state.selectedKeys[index].key;
        keyDisplay.textContent = k || "—";
        keyDisplay.classList.toggle("has-key", !!k);
      }

      btnPrev.addEventListener("click", () => {
        let i = getIdx() - 1;
        if (i < 0) i = KEY_OPTIONS.length - 1;
        state.selectedKeys[index].key = KEY_OPTIONS[i];
        updateDisplay();
      });
      btnNext.addEventListener("click", () => {
        let i = getIdx() + 1;
        if (i >= KEY_OPTIONS.length) i = 0;
        state.selectedKeys[index].key = KEY_OPTIONS[i];
        updateDisplay();
      });
      keyDisplay.addEventListener("click", () => {
        state.selectedKeys[index].key = "";
        updateDisplay();
      });
      keyDisplay.title = "Toque para limpar";
      updateDisplay();

      keySelector.append(btnPrev, keyDisplay, btnNext);
      wrap.append(label, keySelector);
      el.keyFields.appendChild(wrap);
    });
  }

  async function saveAllKeys() {
    if (!state.selectedSong) return;
    const payload = state.selectedKeys.map(item => ({
      song_id: state.selectedSong.id,
      member_name: item.member_name,
      key: item.key || null
    }));
    const { error } = await window.supabaseClient
      .from("song_keys").upsert(payload, { onConflict: "song_id,member_name" });
    if (error) { console.error(error); showToast("Erro ao salvar tons."); return; }
    state.keysCache[state.selectedSong.id] = state.selectedKeys
      .filter(k => k.key).map(k => ({ member_name: k.member_name, key: k.key }));
    closeModal(el.detailModal);
    renderSongs();
    showToast("✓ Tons salvos!", "success");
  }

  async function saveLyrics() {
    if (!state.selectedSong) return;
    const lyrics = el.lyricsField.value.trim();
    const { error } = await window.supabaseClient
      .from("songs").update({ lyrics: lyrics || null }).eq("id", state.selectedSong.id);
    if (error) { console.error(error); showToast("Erro ao salvar letra."); return; }
    closeModal(el.detailModal);
    showToast("✓ Letra salva!", "success");
  }

  async function deleteSong() {
    if (!state.selectedSong) return;
    const ok = await showConfirm(`Excluir "${state.selectedSong.title}"?`);
    if (!ok) return;
    const { error } = await window.supabaseClient
      .from("songs").delete().eq("id", state.selectedSong.id);
    if (error) { console.error(error); showToast("Erro ao excluir música."); return; }
    closeModal(el.detailModal);
    await loadSongs();
    showToast("Música excluída.");
  }

  // ===================== IMPORTAÇÃO =====================

  async function bulkImport() {
    const raw = el.bulkText.value || "";
    const strip = el.stripNumbers.checked;
    const rows = raw.split(/\r?\n/);
    const processed = [], seen = new Set();
    for (const row of rows) {
      const n = normalizeTitle(row, strip);
      if (!n.title || seen.has(n.norm)) continue;
      seen.add(n.norm);
      processed.push(n);
    }
    if (!processed.length) { el.importSummary.textContent = "Nenhum título válido encontrado."; return; }
    const { data: existing } = await window.supabaseClient
      .from("songs").select("title_norm").in("title_norm", processed.map(i => i.norm));
    const existingSet = new Set((existing || []).map(i => i.title_norm));
    const toInsert = processed.filter(i => !existingSet.has(i.norm));
    let inserted = 0;
    for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
      const chunk = toInsert.slice(i, i + CHUNK_SIZE).map(item => ({ title: item.title, title_norm: item.norm }));
      const { error } = await window.supabaseClient.from("songs").insert(chunk);
      if (error) { showToast("Erro durante importação."); return; }
      inserted += chunk.length;
    }
    el.importSummary.textContent = [
      `Total processado: ${processed.length}`,
      `Novas inseridas: ${inserted}`,
      `Ignoradas (duplicadas): ${processed.length - inserted}`
    ].join("\n");
    await loadSongs();
    showToast(`✓ ${inserted} músicas importadas!`, "success");
  }

  // ===================== EVENTOS =====================

  function bindEvents() {
    el.brandLogo.addEventListener("error", () => {
      el.brandLogo.style.display = "none";
      el.brandFallback.style.display = "grid";
    });
    el.searchInput.addEventListener("input", debounce(e => applyFilter(e.target.value), 300));
    el.addSongBtn.addEventListener("click",    () => openModal(el.songModal, el.newSongTitle));
    el.bulkImportBtn.addEventListener("click", () => openModal(el.importModal, el.bulkText));
    el.confirmAddSong.addEventListener("click", () => addSong(el.newSongTitle.value));
    el.newSongTitle.addEventListener("keydown", e => { if (e.key === "Enter") addSong(el.newSongTitle.value); });
    el.confirmImport.addEventListener("click", bulkImport);
    el.tabKeys.addEventListener("click",       () => switchDetailTab("keys"));
    el.tabLyrics.addEventListener("click",     () => switchDetailTab("lyrics"));
    el.saveAllKeys.addEventListener("click",   saveAllKeys);
    el.saveLyrics.addEventListener("click",    saveLyrics);
    el.deleteSongBtn.addEventListener("click", deleteSong);

    if (el.openCifraBtn) el.openCifraBtn.addEventListener("click", openCifra);
    if (el.saveCifraBtn) el.saveCifraBtn.addEventListener("click", saveCifraUrl);

    document.querySelectorAll("[data-close]").forEach(btn => {
      btn.addEventListener("click", () => closeModal(document.getElementById(btn.dataset.close)));
    });
    [el.songModal, el.importModal, el.detailModal].forEach(modal => {
      modal.addEventListener("click", e => { if (e.target === modal) closeModal(modal); });
    });
    document.addEventListener("keydown", e => {
      if (e.key !== "Escape") return;
      [el.songModal, el.importModal, el.detailModal, el.confirmModal].forEach(modal => {
        if (!modal.classList.contains("hidden")) closeModal(modal);
      });
    });
  }

  async function init() {
    bindEvents();
    await loadSongs();
  }

  init();
})();

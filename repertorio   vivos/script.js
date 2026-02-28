(function app() {
  const MEMBERS = ["Pastor Aluísio", "Rafaela", "Lucas", "Gustavo", "Luísa", "Dayane"];

  // Todas as tonalidades em ordem cromática
  const KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
                "Db", "Eb", "Gb", "Ab", "Bb"];

  // Tonalidades exibidas no seletor (ordem musical amigável)
  const KEY_OPTIONS = ["", "C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

  const CHUNK_SIZE = 50;

  const state = {
    songs: [],
    filteredSongs: [],
    selectedSong: null,
    selectedKeys: [],
    lastFocusEl: null
  };

  const el = {
    searchInput: document.getElementById("searchInput"),
    songsList: document.getElementById("songsList"),
    songCount: document.getElementById("songCount"),
    emptyState: document.getElementById("emptyState"),
    toast: document.getElementById("toast"),
    addSongBtn: document.getElementById("addSongBtn"),
    bulkImportBtn: document.getElementById("bulkImportBtn"),
    songModal: document.getElementById("songModal"),
    importModal: document.getElementById("importModal"),
    detailModal: document.getElementById("detailModal"),
    confirmModal: document.getElementById("confirmModal"),
    confirmMessage: document.getElementById("confirmMessage"),
    confirmYes: document.getElementById("confirmYes"),
    confirmNo: document.getElementById("confirmNo"),
    newSongTitle: document.getElementById("newSongTitle"),
    confirmAddSong: document.getElementById("confirmAddSong"),
    bulkText: document.getElementById("bulkText"),
    stripNumbers: document.getElementById("stripNumbers"),
    confirmImport: document.getElementById("confirmImport"),
    importSummary: document.getElementById("importSummary"),
    detailTitle: document.getElementById("detailTitle"),
    keyFields: document.getElementById("keyFields"),
    saveAllKeys: document.getElementById("saveAllKeys"),
    deleteSongBtn: document.getElementById("deleteSongBtn"),
    brandLogo: document.getElementById("brandLogo"),
    brandFallback: document.getElementById("brandFallback")
  };

  // ===================== UTILS =====================

  function normalizeTitle(title, stripNumberPrefix = false) {
    let value = (title || "").trim();
    if (stripNumberPrefix) value = value.replace(/^\s*\d+[\.\-\)]\s*/, "");
    value = value.replace(/\s+/g, " ").trim();
    const norm = value.toLocaleLowerCase("pt-BR");
    return { title: value, norm };
  }

  function showToast(message, type = "default") {
    el.toast.textContent = message;
    el.toast.dataset.type = type;
    el.toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => el.toast.classList.remove("show"), 2000);
  }

  function debounce(fn, delay = 300) {
    let timeout;
    return (...args) => { clearTimeout(timeout); timeout = setTimeout(() => fn(...args), delay); };
  }

  function getFocusable(modal) {
    return modal.querySelector("input, textarea, button, [tabindex]:not([tabindex='-1'])");
  }

  function openModal(modal, focusTarget = null) {
    state.lastFocusEl = document.activeElement;
    modal.classList.remove("hidden");
    window.setTimeout(() => { const t = focusTarget || getFocusable(modal); if (t) t.focus(); }, 50);
  }

  function closeModal(modal) {
    modal.classList.add("hidden");
    if (state.lastFocusEl?.focus) state.lastFocusEl.focus();
  }

  // Modal de confirmação customizado (substitui window.confirm)
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

  // ===================== RENDER LISTA =====================

  function getMemberKeysForSong(songId) {
    // Para mostrar tons no card, usamos cache simples no state
    return state.keysCache?.[songId] || [];
  }

  function renderSongs() {
    el.songsList.innerHTML = "";
    el.songCount.textContent = String(state.filteredSongs.length);
    el.emptyState.style.display = state.filteredSongs.length > 0 ? "none" : "block";

    state.filteredSongs.forEach((song) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";

      const titleEl = document.createElement("span");
      titleEl.className = "song-title";
      titleEl.textContent = song.title;

      // Linha de tons dos membros
      const keysRow = document.createElement("span");
      keysRow.className = "song-keys-preview";
      const cached = getMemberKeysForSong(song.id);
      if (cached.length > 0) {
        cached.forEach(({ member_name, key }) => {
          if (!key) return;
          const chip = document.createElement("span");
          chip.className = "key-chip";
          // Abreviação do nome
          const short = member_name.split(" ")[0];
          chip.textContent = `${short}: ${key}`;
          keysRow.appendChild(chip);
        });
      }

      btn.appendChild(titleEl);
      btn.appendChild(keysRow);
      btn.addEventListener("click", () => openDetail(song.id));
      li.appendChild(btn);
      el.songsList.appendChild(li);
    });
  }

  function applyFilter(query = "") {
    const q = query.trim().toLocaleLowerCase("pt-BR");
    state.filteredSongs = state.songs.filter((s) => s.title_norm.includes(q));
    renderSongs();
  }

  // ===================== SUPABASE =====================

  async function loadSongs() {
    if (!window.supabaseClient) { showToast("Supabase não configurado."); return; }

    const { data, error } = await window.supabaseClient
      .from("songs").select("id, title, title_norm").order("title", { ascending: true });

    if (error) { console.error(error); showToast("Erro ao carregar músicas."); return; }

    state.songs = data || [];

    // Carrega tons de todos para o preview nos cards
    await loadAllKeys();
    applyFilter(el.searchInput.value);
  }

  async function loadAllKeys() {
    if (!window.supabaseClient || !state.songs.length) return;
    const ids = state.songs.map((s) => s.id);

    const { data, error } = await window.supabaseClient
      .from("song_keys").select("song_id, member_name, key").in("song_id", ids);

    if (error) { console.error(error); return; }

    // Agrupa por song_id
    state.keysCache = {};
    (data || []).forEach((row) => {
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

  async function openDetail(songId) {
    state.selectedSong = state.songs.find((s) => s.id === songId);
    if (!state.selectedSong) return;

    const { data, error } = await window.supabaseClient
      .from("song_keys").select("id, member_name, key")
      .eq("song_id", songId).order("member_name", { ascending: true });

    if (error) { console.error(error); showToast("Erro ao carregar tons."); return; }

    const mapByMember = new Map((data || []).map((k) => [k.member_name, k]));
    state.selectedKeys = MEMBERS.map((name) => {
      const existing = mapByMember.get(name);
      return { id: existing?.id || null, member_name: name, key: existing?.key || "" };
    });

    renderDetail();
    openModal(el.detailModal);
  }

  function renderDetail() {
    el.detailTitle.textContent = state.selectedSong?.title || "Detalhes";
    el.keyFields.innerHTML = "";

    state.selectedKeys.forEach((item, index) => {
      const wrap = document.createElement("div");
      wrap.className = "key-field";

      const label = document.createElement("label");
      label.textContent = item.member_name;

      // Seletor visual de tom
      const keySelector = document.createElement("div");
      keySelector.className = "key-selector";

      const btnPrev = document.createElement("button");
      btnPrev.type = "button";
      btnPrev.className = "key-nav-btn";
      btnPrev.setAttribute("aria-label", "Tom anterior");
      btnPrev.innerHTML = "&#8249;"; // ‹

      const keyDisplay = document.createElement("span");
      keyDisplay.className = "key-display";
      keyDisplay.textContent = item.key || "—";

      const btnNext = document.createElement("button");
      btnNext.type = "button";
      btnNext.className = "key-nav-btn";
      btnNext.setAttribute("aria-label", "Próximo tom");
      btnNext.innerHTML = "&#8250;"; // ›

      function getCurrentIndex() {
        const k = state.selectedKeys[index].key;
        const idx = KEY_OPTIONS.indexOf(k);
        return idx === -1 ? 0 : idx;
      }

      function updateDisplay() {
        const k = state.selectedKeys[index].key;
        keyDisplay.textContent = k || "—";
        keyDisplay.classList.toggle("has-key", !!k);
      }

      btnPrev.addEventListener("click", () => {
        let i = getCurrentIndex() - 1;
        if (i < 0) i = KEY_OPTIONS.length - 1;
        state.selectedKeys[index].key = KEY_OPTIONS[i];
        updateDisplay();
      });

      btnNext.addEventListener("click", () => {
        let i = getCurrentIndex() + 1;
        if (i >= KEY_OPTIONS.length) i = 0;
        state.selectedKeys[index].key = KEY_OPTIONS[i];
        updateDisplay();
      });

      // Tap no display limpa o tom
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

    const payload = state.selectedKeys.map((item) => ({
      song_id: state.selectedSong.id,
      member_name: item.member_name,
      key: item.key || null
    }));

    const { error } = await window.supabaseClient
      .from("song_keys").upsert(payload, { onConflict: "song_id,member_name" });

    if (error) { console.error(error); showToast("Erro ao salvar tons."); return; }

    // Atualiza cache local
    state.keysCache[state.selectedSong.id] = state.selectedKeys
      .filter((k) => k.key)
      .map((k) => ({ member_name: k.member_name, key: k.key }));

    closeModal(el.detailModal);
    renderSongs(); // atualiza preview nos cards
    showToast("✓ Tons salvos!", "success");
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

  async function bulkImport() {
    const raw = el.bulkText.value || "";
    const strip = el.stripNumbers.checked;
    const rows = raw.split(/\r?\n/);
    const processed = [];
    const seenPaste = new Set();

    for (const row of rows) {
      const normalized = normalizeTitle(row, strip);
      if (!normalized.title || seenPaste.has(normalized.norm)) continue;
      seenPaste.add(normalized.norm);
      processed.push(normalized);
    }

    if (!processed.length) {
      el.importSummary.textContent = "Nenhum título válido encontrado.";
      return;
    }

    const norms = processed.map((i) => i.norm);
    const { data: existing, error: checkError } = await window.supabaseClient
      .from("songs").select("title_norm").in("title_norm", norms);

    if (checkError) { console.error(checkError); showToast("Erro ao validar músicas."); return; }

    const existingSet = new Set((existing || []).map((i) => i.title_norm));
    const toInsert = processed.filter((i) => !existingSet.has(i.norm));

    let inserted = 0;
    for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
      const chunk = toInsert.slice(i, i + CHUNK_SIZE).map((item) => ({
        title: item.title, title_norm: item.norm
      }));
      const { error } = await window.supabaseClient.from("songs").insert(chunk);
      if (error) { console.error(error); showToast("Erro durante importação."); return; }
      inserted += chunk.length;
    }

    const ignored = processed.length - inserted;
    el.importSummary.textContent = [
      `Total processado: ${processed.length}`,
      `Novas inseridas: ${inserted}`,
      `Ignoradas (duplicadas): ${ignored}`
    ].join("\n");

    await loadSongs();
    showToast(`✓ ${inserted} músicas importadas!`, "success");
  }

  // ===================== EVENTOS =====================

  function setupLogoFallback() {
    el.brandLogo.addEventListener("error", () => {
      el.brandLogo.style.display = "none";
      el.brandFallback.style.display = "grid";
    });
  }

  function bindEvents() {
    el.searchInput.addEventListener("input", debounce((e) => applyFilter(e.target.value), 300));

    el.addSongBtn.addEventListener("click", () => openModal(el.songModal, el.newSongTitle));
    el.bulkImportBtn.addEventListener("click", () => openModal(el.importModal, el.bulkText));

    el.confirmAddSong.addEventListener("click", () => addSong(el.newSongTitle.value));
    el.newSongTitle.addEventListener("keydown", (e) => { if (e.key === "Enter") addSong(el.newSongTitle.value); });

    el.confirmImport.addEventListener("click", bulkImport);
    el.saveAllKeys.addEventListener("click", saveAllKeys);
    el.deleteSongBtn.addEventListener("click", deleteSong);

    document.querySelectorAll("[data-close]").forEach((btn) => {
      btn.addEventListener("click", () => closeModal(document.getElementById(btn.dataset.close)));
    });

    [el.songModal, el.importModal, el.detailModal].forEach((modal) => {
      modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(modal); });
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      [el.songModal, el.importModal, el.detailModal, el.confirmModal].forEach((modal) => {
        if (!modal.classList.contains("hidden")) closeModal(modal);
      });
    });
  }

  async function init() {
    setupLogoFallback();
    bindEvents();
    await loadSongs();
  }

  init();
})();
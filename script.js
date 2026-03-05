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
    setlist: [],
    lastFocusEl: null
  };

  const el = {
    searchInput:     document.getElementById("searchInput"),
    songsList:       document.getElementById("songsList"),
    songCount:       document.getElementById("songCount"),
    emptyState:      document.getElementById("emptyState"),
    toast:           document.getElementById("toast"),
    addSongBtn:      document.getElementById("addSongBtn"),
    bulkImportBtn:   document.getElementById("bulkImportBtn"),
    songModal:       document.getElementById("songModal"),
    importModal:     document.getElementById("importModal"),
    detailModal:     document.getElementById("detailModal"),
    confirmModal:    document.getElementById("confirmModal"),
    confirmMessage:  document.getElementById("confirmMessage"),
    confirmYes:      document.getElementById("confirmYes"),
    confirmNo:       document.getElementById("confirmNo"),
    newSongTitle:    document.getElementById("newSongTitle"),
    confirmAddSong:  document.getElementById("confirmAddSong"),
    bulkText:        document.getElementById("bulkText"),
    stripNumbers:    document.getElementById("stripNumbers"),
    confirmImport:   document.getElementById("confirmImport"),
    importSummary:   document.getElementById("importSummary"),
    detailTitle:     document.getElementById("detailTitle"),
    keyFields:       document.getElementById("keyFields"),
    lyricsField:     document.getElementById("lyricsField"),
    saveAllKeys:     document.getElementById("saveAllKeys"),
    saveLyrics:      document.getElementById("saveLyrics"),
    deleteSongBtn:   document.getElementById("deleteSongBtn"),
    tabKeys:         document.getElementById("tabKeys"),
    tabLyrics:       document.getElementById("tabLyrics"),
    paneKeys:        document.getElementById("paneKeys"),
    paneLyrics:      document.getElementById("paneLyrics"),
    brandLogo:       document.getElementById("brandLogo"),
    brandFallback:   document.getElementById("brandFallback"),
    navRepertorio:   document.getElementById("navRepertorio"),
    navSetlist:      document.getElementById("navSetlist"),
    pageRepertorio:  document.getElementById("pageRepertorio"),
    pageSetlist:     document.getElementById("pageSetlist"),
    setlistEl:       document.getElementById("setlistEl"),
    setlistEmpty:    document.getElementById("setlistEmpty"),
    clearSetlistBtn: document.getElementById("clearSetlistBtn"),
    setlistCount:    document.getElementById("setlistCount"),

    // ✅ NOVO: Cifra
    cifraUrlField:   document.getElementById("cifraUrlField"),
    openCifraBtn:    document.getElementById("openCifraBtn"),
    saveCifraBtn:    document.getElementById("saveCifraBtn"),
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

  // ✅ NOVO: gera link padrão de busca no Cifra Club
  function getDefaultCifraSearchUrl(title) {
    const q = encodeURIComponent(title || "");
    return `https://www.cifraclub.com.br/?q=${q}`;
  }

  // ✅ NOVO: abrir cifra
  function openCifra() {
    if (!state.selectedSong) return;
    const url = (el.cifraUrlField?.value || "").trim() || getDefaultCifraSearchUrl(state.selectedSong.title);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  // ✅ NOVO: salvar cifra no Supabase
  async function saveCifraUrl() {
    if (!state.selectedSong) return;

    const raw = (el.cifraUrlField?.value || "").trim();
    const url = raw || getDefaultCifraSearchUrl(state.selectedSong.title);

    const { error } = await window.supabaseClient
      .from("songs")
      .update({ cifra_url: url })
      .eq("id", state.selectedSong.id);

    if (error) {
      console.error(error);
      showToast("Erro ao salvar link da cifra.");
      return;
    }

    el.cifraUrlField.value = url;
    showToast("✓ Link da cifra salvo!", "success");
  }

  // ===================== NAVEGAÇÃO =====================

  function showPage(page) {
    const isSetlist = page === "setlist";
    el.pageRepertorio.classList.toggle("hidden", isSetlist);
    el.pageSetlist.classList.toggle("hidden", !isSetlist);
    el.navRepertorio.classList.toggle("nav-active", !isSetlist);
    el.navSetlist.classList.toggle("nav-active", isSetlist);
    if (isSetlist) renderSetlist();
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

      const inSetlist = state.setlist.some(s => s.song_id === song.id);
      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "btn-add-setlist" + (inSetlist ? " in-setlist" : "");
      addBtn.innerHTML = inSetlist ? "✓" : "+";
      addBtn.title = inSetlist ? "Já está no setlist" : "Adicionar ao setlist";
      addBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!inSetlist) addToSetlist(song);
      });

      row.append(titleEl, addBtn);

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

    // ✅ ALTERAÇÃO: agora traz lyrics e cifra_url
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

  // ===================== SETLIST =====================

  async function loadSetlist() {
    const { data, error } = await window.supabaseClient
      .from("setlist")
      .select("id, song_id, position, songs(title)")
      .order("position", { ascending: true });
    if (error) { console.error(error); return; }
    state.setlist = (data || []).map(row => ({
      id: row.id,
      song_id: row.song_id,
      position: row.position,
      title: row.songs?.title || "?"
    }));
  }

  async function addToSetlist(song) {
    const maxPos = state.setlist.length > 0
      ? Math.max(...state.setlist.map(s => s.position)) : 0;
    const { data, error } = await window.supabaseClient
      .from("setlist").insert({ song_id: song.id, position: maxPos + 1 }).select().single();
    if (error) { console.error(error); showToast("Erro ao adicionar ao setlist."); return; }
    state.setlist.push({ id: data.id, song_id: song.id, position: data.position, title: song.title });
    renderSongs();
    showToast(`✓ "${song.title}" adicionada!`, "success");
  }

  async function removeFromSetlist(setlistId) {
    const { error } = await window.supabaseClient
      .from("setlist").delete().eq("id", setlistId);
    if (error) { console.error(error); showToast("Erro ao remover."); return; }
    state.setlist = state.setlist.filter(s => s.id !== setlistId);
    renderSongs();
    renderSetlist();
    showToast("Removido do setlist.");
  }

  async function moveSetlistItem(setlistId, direction) {
    const idx = state.setlist.findIndex(s => s.id === setlistId);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= state.setlist.length) return;
    const a = state.setlist[idx];
    const b = state.setlist[swapIdx];
    [a.position, b.position] = [b.position, a.position];
    state.setlist.sort((x, y) => x.position - y.position);
    await window.supabaseClient.from("setlist").upsert([
      { id: a.id, song_id: a.song_id, position: a.position },
      { id: b.id, song_id: b.song_id, position: b.position }
    ]);
    renderSetlist();
  }

  async function clearSetlist() {
    const ok = await showConfirm("Limpar o setlist do culto?");
    if (!ok) return;
    const { error } = await window.supabaseClient
      .from("setlist").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) { console.error(error); showToast("Erro ao limpar setlist."); return; }
    state.setlist = [];
    renderSongs();
    renderSetlist();
    showToast("Setlist limpo.");
  }

  function renderSetlist() {
    el.setlistEl.innerHTML = "";
    el.setlistCount.textContent = String(state.setlist.length);
    el.setlistEmpty.style.display = state.setlist.length > 0 ? "none" : "block";
    el.clearSetlistBtn.style.display = state.setlist.length > 0 ? "inline-flex" : "none";

    state.setlist.forEach((item, idx) => {
      const keys = state.keysCache[item.song_id] || [];
      const li = document.createElement("li");
      li.className = "setlist-item";

      const num = document.createElement("span");
      num.className = "setlist-num";
      num.textContent = idx + 1;

      const info = document.createElement("div");
      info.className = "setlist-info";
      info.style.cursor = "pointer";

      const title = document.createElement("span");
      title.className = "setlist-title";
      title.textContent = item.title;

      const keysRow = document.createElement("span");
      keysRow.className = "song-keys-preview";
      keys.forEach(({ member_name, key }) => {
        if (!key) return;
        const chip = document.createElement("span");
        chip.className = "key-chip";
        chip.textContent = `${member_name.split(" ")[0]}: ${key}`;
        keysRow.appendChild(chip);
      });

      info.append(title, keysRow);
      info.addEventListener("click", () => openDetail(item.song_id));

      const controls = document.createElement("div");
      controls.className = "setlist-controls";

      const upBtn = document.createElement("button");
      upBtn.className = "setlist-move-btn";
      upBtn.innerHTML = "↑";
      upBtn.disabled = idx === 0;
      upBtn.addEventListener("click", () => moveSetlistItem(item.id, -1));

      const downBtn = document.createElement("button");
      downBtn.className = "setlist-move-btn";
      downBtn.innerHTML = "↓";
      downBtn.disabled = idx === state.setlist.length - 1;
      downBtn.addEventListener("click", () => moveSetlistItem(item.id, 1));

      const removeBtn = document.createElement("button");
      removeBtn.className = "setlist-remove-btn";
      removeBtn.innerHTML = "×";
      removeBtn.addEventListener("click", () => removeFromSetlist(item.id));

      controls.append(upBtn, downBtn, removeBtn);
      li.append(num, info, controls);
      el.setlistEl.appendChild(li);
    });
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
    el.navRepertorio.addEventListener("click", () => showPage("repertorio"));
    el.navSetlist.addEventListener("click",    () => showPage("setlist"));
    el.addSongBtn.addEventListener("click",    () => openModal(el.songModal, el.newSongTitle));
    el.bulkImportBtn.addEventListener("click", () => openModal(el.importModal, el.bulkText));
    el.confirmAddSong.addEventListener("click",() => addSong(el.newSongTitle.value));
    el.newSongTitle.addEventListener("keydown", e => { if (e.key === "Enter") addSong(el.newSongTitle.value); });
    el.confirmImport.addEventListener("click", bulkImport);
    el.tabKeys.addEventListener("click",       () => switchDetailTab("keys"));
    el.tabLyrics.addEventListener("click",     () => switchDetailTab("lyrics"));
    el.saveAllKeys.addEventListener("click",   saveAllKeys);
    el.saveLyrics.addEventListener("click",    saveLyrics);
    el.deleteSongBtn.addEventListener("click", deleteSong);
    el.clearSetlistBtn.addEventListener("click", clearSetlist);

    // ✅ NOVO: eventos cifra
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
    await loadSetlist();
  }

  init();
})();

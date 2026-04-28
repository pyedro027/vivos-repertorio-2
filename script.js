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
    
    // NAVEGAÇÃO
    navRepertorio:  document.getElementById("navRepertorio"),
    navCulto:       document.getElementById("navCulto"),
    navEnsaio:      document.getElementById("navEnsaio"),
    pageRepertorio: document.getElementById("pageRepertorio"),
    pageCulto:      document.getElementById("pageCulto"),
    pageEnsaio:     document.getElementById("pageEnsaio"),
    
    // LISTAS
    cultoSongsList: document.getElementById("cultoSongsList"),
    cultoEmptyState:document.getElementById("cultoEmptyState"),
    ensaioSongsList:document.getElementById("ensaioSongsList"),
    ensaioEmptyState:document.getElementById("ensaioEmptyState"),
    
    // BOTÕES DE AÇÃO
    clearSetlistBtn:document.getElementById("clearSetlistBtn"),
    shareSetlistBtn:document.getElementById("shareSetlistBtn"),
    clearEnsaioBtn: document.getElementById("clearEnsaioBtn"),
    shareEnsaioBtn: document.getElementById("shareEnsaioBtn"),
    
    cifraUrlField:  document.getElementById("cifraUrlField"),
    openCifraBtn:   document.getElementById("openCifraBtn"),
    saveCifraBtn:   document.getElementById("saveCifraBtn"),
    youtubeUrlField:document.getElementById("youtubeUrlField"),
    openYoutubeBtn: document.getElementById("openYoutubeBtn"),
    saveYoutubeBtn: document.getElementById("saveYoutubeBtn")
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
    showToast._t = setTimeout(() => el.toast.classList.remove("show"), 2500);
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
    const url = (el.cifraUrlField?.value || "").trim() || getDefaultCifraSearchUrl(state.selectedSong.title);
    const { error } = await window.supabaseClient.from("songs").update({ cifra_url: url }).eq("id", state.selectedSong.id);
    if (error) { showToast("Erro ao salvar cifra."); return; }
    el.cifraUrlField.value = url;
    showToast("Link salvo!", "success");
  }

  function openYoutube() {
    if (!state.selectedSong) return;
    const raw = (el.youtubeUrlField?.value || "").trim();
    const url = raw || `https://www.youtube.com/results?search_query=${encodeURIComponent(state.selectedSong.title + " oficial")}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function saveYoutubeUrl() {
    if (!state.selectedSong) return;
    const url = (el.youtubeUrlField?.value || "").trim();
    const { error } = await window.supabaseClient.from("songs").update({ youtube_url: url }).eq("id", state.selectedSong.id);
    if (error) { showToast("Erro ao salvar YouTube."); return; }
    el.youtubeUrlField.value = url;
    showToast("YouTube salvo!", "success");
  }

  // ===================== RENDERIZAÇÃO =====================
  function createSongCard(song) {
    const card = document.createElement("div");
    card.className = "song-card";

    const cached = state.keysCache[song.id] || [];
    let mainKey = "♪";
    const pastorKey = cached.find(k => k.member_name.includes("Pastor") && k.key);
    const anyKey = cached.find(k => k.key);
    if (pastorKey) mainKey = pastorKey.key;
    else if (anyKey) mainKey = anyKey.key;

    const badge = document.createElement("div");
    badge.className = "key-badge";
    badge.textContent = mainKey;

    const info = document.createElement("div");
    info.className = "song-info";
    
    const title = document.createElement("span");
    title.className = "song-title";
    title.textContent = song.title;

    const membersInfo = document.createElement("span");
    membersInfo.className = "song-members";
    const keysText = cached.filter(k => k.key).map(k => `${k.member_name.split(" ")[0]}: ${k.key}`).join(" • ");
    membersInfo.textContent = keysText || "Sem tons salvos";

    info.append(title, membersInfo);

    // Container para os dois botões (Ensaios e Culto)
    const actionsBlock = document.createElement("div");
    actionsBlock.style.display = "flex";
    actionsBlock.style.gap = "4px";

    // Botão ENSAIO (Fone)
    const ensaioBtn = document.createElement("button");
    ensaioBtn.className = `star-btn ${song.on_rehearsal ? "active" : ""}`;
    ensaioBtn.innerHTML = `<span class="material-symbols-outlined">${song.on_rehearsal ? "headphones" : "headset_off"}</span>`;
    if(song.on_rehearsal) ensaioBtn.style.color = "#6B6B66"; // Cor diferenciada
    
    ensaioBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const newVal = !song.on_rehearsal;
      ensaioBtn.classList.toggle("active", newVal);
      ensaioBtn.innerHTML = `<span class="material-symbols-outlined">${newVal ? "headphones" : "headset_off"}</span>`;
      ensaioBtn.style.color = newVal ? "#6B6B66" : "";
      song.on_rehearsal = newVal;
      
      await window.supabaseClient.from("songs").update({ on_rehearsal: newVal }).eq("id", song.id);
      if(!el.pageEnsaio.classList.contains("hidden")) renderEnsaioSongs();
    });

    // Botão CULTO (Estrela)
    const starBtn = document.createElement("button");
    starBtn.className = `star-btn ${song.on_setlist ? "active" : ""}`;
    starBtn.innerHTML = `<span class="material-symbols-outlined">${song.on_setlist ? "star" : "star_border"}</span>`;
    
    starBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const newVal = !song.on_setlist;
      starBtn.classList.toggle("active", newVal);
      starBtn.innerHTML = `<span class="material-symbols-outlined">${newVal ? "star" : "star_border"}</span>`;
      song.on_setlist = newVal;
      
      await window.supabaseClient.from("songs").update({ on_setlist: newVal }).eq("id", song.id);
      if(!el.pageCulto.classList.contains("hidden")) renderCultoSongs();
    });

    actionsBlock.append(ensaioBtn, starBtn);
    card.append(badge, info, actionsBlock);
    
    card.addEventListener("click", () => openDetail(song.id));
    
    const li = document.createElement("li");
    li.appendChild(card);
    return li;
  }

  function renderSongs() {
    el.songsList.innerHTML = "";
    el.emptyState.style.display = state.filteredSongs.length > 0 ? "none" : "block";
    state.filteredSongs.forEach((song) => {
      el.songsList.appendChild(createSongCard(song));
    });
  }

  function renderCultoSongs() {
    el.cultoSongsList.innerHTML = "";
    const cultoSongs = state.songs.filter(s => s.on_setlist === true);
    el.cultoEmptyState.style.display = cultoSongs.length > 0 ? "none" : "block";
    cultoSongs.forEach((song) => { el.cultoSongsList.appendChild(createSongCard(song)); });
  }

  function renderEnsaioSongs() {
    el.ensaioSongsList.innerHTML = "";
    const ensaioSongs = state.songs.filter(s => s.on_rehearsal === true);
    el.ensaioEmptyState.style.display = ensaioSongs.length > 0 ? "none" : "block";
    ensaioSongs.forEach((song) => { el.ensaioSongsList.appendChild(createSongCard(song)); });
  }

  function applyFilter(query = "") {
    const q = query.trim().toLocaleLowerCase("pt-BR");
    state.filteredSongs = state.songs.filter(s => s.title_norm.includes(q));
    renderSongs();
  }

  function switchPage(page) {
    el.navRepertorio.classList.remove("nav-active");
    el.navCulto.classList.remove("nav-active");
    el.navEnsaio.classList.remove("nav-active");
    
    el.pageRepertorio.classList.add("hidden");
    el.pageCulto.classList.add("hidden");
    el.pageEnsaio.classList.add("hidden");

    if (page === "repertorio") {
      el.navRepertorio.classList.add("nav-active");
      el.pageRepertorio.classList.remove("hidden");
    } else if (page === "culto") {
      el.navCulto.classList.add("nav-active");
      el.pageCulto.classList.remove("hidden");
      renderCultoSongs();
    } else if (page === "ensaio") {
      el.navEnsaio.classList.add("nav-active");
      el.pageEnsaio.classList.remove("hidden");
      renderEnsaioSongs();
    }
  }

  // ===================== SUPABASE =====================
  async function loadSongs() {
    if (!window.supabaseClient) return;
    const { data, error } = await window.supabaseClient
      .from("songs").select("id, title, title_norm, on_setlist, on_rehearsal, cifra_url, youtube_url").order("title", { ascending: true });
    if (error) return;
    state.songs = data || [];
    await loadAllKeys();
    applyFilter(el.searchInput.value);
  }

  async function loadAllKeys() {
    if (!state.songs.length) return;
    const ids = state.songs.map(s => s.id);
    const { data } = await window.supabaseClient.from("song_keys").select("song_id, member_name, key").in("song_id", ids);
    state.keysCache = {};
    (data || []).forEach(row => {
      if (!state.keysCache[row.song_id]) state.keysCache[row.song_id] = [];
      state.keysCache[row.song_id].push({ member_name: row.member_name, key: row.key });
    });
  }

  async function addSong(title) {
    const parsed = normalizeTitle(title);
    if (!parsed.title) return;
    const { error } = await window.supabaseClient.from("songs").insert({ title: parsed.title, title_norm: parsed.norm });
    if (error) { showToast("Erro. Música já existe?"); return; }
    closeModal(el.songModal);
    el.newSongTitle.value = "";
    await loadSongs();
    showToast("Música adicionada!", "success");
  }

  // ===================== DETALHES =====================
  async function openDetail(songId) {
    state.selectedSong = state.songs.find(s => s.id === songId);
    if (!state.selectedSong) return;

    const { data: keysData } = await window.supabaseClient.from("song_keys").select("id, member_name, key").eq("song_id", songId).order("member_name", { ascending: true });
    const mapByMember = new Map((keysData || []).map(k => [k.member_name, k]));
    state.selectedKeys = MEMBERS.map(name => {
      const ex = mapByMember.get(name);
      return { id: ex?.id || null, member_name: name, key: ex?.key || "" };
    });

    const { data: songData } = await window.supabaseClient.from("songs").select("lyrics, cifra_url, youtube_url").eq("id", songId).single();
    el.lyricsField.value = songData?.lyrics || "";
    if (el.cifraUrlField) el.cifraUrlField.value = songData?.cifra_url || "";
    if (el.youtubeUrlField) el.youtubeUrlField.value = songData?.youtube_url || "";

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
      const wrap = document.createElement("div"); wrap.className = "key-field";
      const label = document.createElement("label"); label.textContent = item.member_name;
      const selector = document.createElement("div"); selector.className = "key-selector";
      const btnPrev = document.createElement("button"); btnPrev.className = "key-nav-btn"; btnPrev.innerHTML = "−";
      const display = document.createElement("span"); display.className = "key-display";
      const btnNext = document.createElement("button"); btnNext.className = "key-nav-btn"; btnNext.innerHTML = "+";

      const updateDisplay = () => {
        const k = state.selectedKeys[index].key;
        display.textContent = k || "—";
        display.classList.toggle("has-key", !!k);
      };

      btnPrev.onclick = () => { let i = KEY_OPTIONS.indexOf(state.selectedKeys[index].key) - 1; if (i < 0) i = KEY_OPTIONS.length - 1; state.selectedKeys[index].key = KEY_OPTIONS[i]; updateDisplay(); };
      btnNext.onclick = () => { let i = KEY_OPTIONS.indexOf(state.selectedKeys[index].key) + 1; if (i >= KEY_OPTIONS.length) i = 0; state.selectedKeys[index].key = KEY_OPTIONS[i]; updateDisplay(); };
      display.onclick = () => { state.selectedKeys[index].key = ""; updateDisplay(); };
      
      updateDisplay();
      selector.append(btnPrev, display, btnNext);
      wrap.append(label, selector);
      el.keyFields.appendChild(wrap);
    });
  }

  async function saveAllKeys() {
    const payload = state.selectedKeys.map(i => ({ song_id: state.selectedSong.id, member_name: i.member_name, key: i.key || null }));
    await window.supabaseClient.from("song_keys").upsert(payload, { onConflict: "song_id,member_name" });
    state.keysCache[state.selectedSong.id] = state.selectedKeys.filter(k => k.key).map(k => ({ member_name: k.member_name, key: k.key }));
    closeModal(el.detailModal);
    renderSongs();
    if(!el.pageCulto.classList.contains("hidden")) renderCultoSongs();
    if(!el.pageEnsaio.classList.contains("hidden")) renderEnsaioSongs();
    showToast("Tons salvos!", "success");
  }

  async function saveLyrics() {
    await window.supabaseClient.from("songs").update({ lyrics: el.lyricsField.value.trim() || null }).eq("id", state.selectedSong.id);
    closeModal(el.detailModal);
    showToast("Letra salva!", "success");
  }

  async function deleteSong() {
    const ok = await showConfirm(`Excluir "${state.selectedSong.title}"?`);
    if (!ok) return;
    await window.supabaseClient.from("songs").delete().eq("id", state.selectedSong.id);
    closeModal(el.detailModal);
    await loadSongs();
    showToast("Música excluída.");
  }

  async function bulkImport() {
    const rows = (el.bulkText.value || "").split(/\r?\n/);
    const processed = [], seen = new Set();
    for (const row of rows) {
      const n = normalizeTitle(row, el.stripNumbers.checked);
      if (!n.title || seen.has(n.norm)) continue;
      seen.add(n.norm); processed.push(n);
    }
    if (!processed.length) return;
    const { data: existing } = await window.supabaseClient.from("songs").select("title_norm").in("title_norm", processed.map(i => i.norm));
    const existingSet = new Set((existing || []).map(i => i.title_norm));
    const toInsert = processed.filter(i => !existingSet.has(i.norm));
    for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
      await window.supabaseClient.from("songs").insert(toInsert.slice(i, i + CHUNK_SIZE).map(item => ({ title: item.title, title_norm: item.norm })));
    }
    await loadSongs();
    closeModal(el.importModal);
    showToast("Músicas importadas!", "success");
  }

  // ===================== EVENTOS =====================
  function bindEvents() {
    el.searchInput.addEventListener("input", debounce(e => applyFilter(e.target.value), 300));
    el.addSongBtn.addEventListener("click",    () => openModal(el.songModal, el.newSongTitle));
    el.bulkImportBtn.addEventListener("click", () => openModal(el.importModal, el.bulkText));
    el.confirmAddSong.addEventListener("click", () => addSong(el.newSongTitle.value));
    el.confirmImport.addEventListener("click", bulkImport);
    el.tabKeys.addEventListener("click",       () => switchDetailTab("keys"));
    el.tabLyrics.addEventListener("click",     () => switchDetailTab("lyrics"));
    el.saveAllKeys.addEventListener("click",   saveAllKeys);
    el.saveLyrics.addEventListener("click",    saveLyrics);
    el.deleteSongBtn.addEventListener("click", deleteSong);
    
    // NAVEGAÇÃO
    el.navRepertorio.addEventListener("click", () => switchPage("repertorio"));
    el.navCulto.addEventListener("click", () => switchPage("culto"));
    el.navEnsaio.addEventListener("click", () => switchPage("ensaio"));
    
    // ================== CULTO ACTIONS ==================
    el.clearSetlistBtn.addEventListener("click", async () => {
      const ok = await showConfirm("Remover todas as músicas do culto?");
      if (!ok) return;
      await window.supabaseClient.from("songs").update({ on_setlist: false }).eq("on_setlist", true);
      state.songs.forEach(s => s.on_setlist = false);
      renderCultoSongs();
      applyFilter(el.searchInput.value);
      showToast("Lista limpa!", "success");
    });

    el.shareSetlistBtn.addEventListener("click", () => {
      const cultoSongs = state.songs.filter(s => s.on_setlist === true);
      if (cultoSongs.length === 0) { showToast("O setlist está vazio!"); return; }
      let text = "🔥 *Setlist do Culto:*\n\n";
      cultoSongs.forEach((song, index) => {
        const cached = state.keysCache[song.id] || [];
        let mainKey = "";
        const pastorKey = cached.find(k => k.member_name.includes("Pastor") && k.key);
        const anyKey = cached.find(k => k.key);
        if (pastorKey) mainKey = ` (${pastorKey.key})`; else if (anyKey) mainKey = ` (${anyKey.key})`;
        const cifraLink = song.cifra_url || getDefaultCifraSearchUrl(song.title);
        
        text += `${index + 1}. *${song.title}*${mainKey}\n🎸 Cifra: ${cifraLink}\n`;
        if (song.youtube_url) text += `▶️ Ouvir: ${song.youtube_url}\n`;
        text += `\n`;
      });
      const appUrl = window.location.origin + window.location.pathname + "?tab=culto";
      text += `📱 *Ver direto no App:*\n${appUrl}`;
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
    });

    // ================== ENSAIO ACTIONS ==================
    el.clearEnsaioBtn.addEventListener("click", async () => {
      const ok = await showConfirm("Remover todas as músicas da lista de ensaio?");
      if (!ok) return;
      await window.supabaseClient.from("songs").update({ on_rehearsal: false }).eq("on_rehearsal", true);
      state.songs.forEach(s => s.on_rehearsal = false);
      renderEnsaioSongs();
      applyFilter(el.searchInput.value);
      showToast("Lista de ensaio limpa!", "success");
    });

    el.shareEnsaioBtn.addEventListener("click", () => {
      const ensaioSongs = state.songs.filter(s => s.on_rehearsal === true);
      if (ensaioSongs.length === 0) { showToast("A lista de ensaio está vazia!"); return; }
      let text = "🎧 *Músicas para o Ensaio:*\n\n";
      ensaioSongs.forEach((song, index) => {
        const cached = state.keysCache[song.id] || [];
        let mainKey = "";
        const pastorKey = cached.find(k => k.member_name.includes("Pastor") && k.key);
        const anyKey = cached.find(k => k.key);
        if (pastorKey) mainKey = ` (${pastorKey.key})`; else if (anyKey) mainKey = ` (${anyKey.key})`;
        const cifraLink = song.cifra_url || getDefaultCifraSearchUrl(song.title);
        
        text += `${index + 1}. *${song.title}*${mainKey}\n🎸 Cifra: ${cifraLink}\n`;
        if (song.youtube_url) text += `▶️ Referência: ${song.youtube_url}\n`;
        text += `\n`;
      });
      const appUrl = window.location.origin + window.location.pathname + "?tab=ensaio";
      text += `📱 *Ver direto no App:*\n${appUrl}`;
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
    });

    if (el.openCifraBtn) el.openCifraBtn.addEventListener("click", openCifra);
    if (el.saveCifraBtn) el.saveCifraBtn.addEventListener("click", saveCifraUrl);
    if (el.openYoutubeBtn) el.openYoutubeBtn.addEventListener("click", openYoutube);
    if (el.saveYoutubeBtn) el.saveYoutubeBtn.addEventListener("click", saveYoutubeUrl);

    document.querySelectorAll("[data-close]").forEach(btn => btn.addEventListener("click", () => closeModal(document.getElementById(btn.dataset.close))));
    [el.songModal, el.importModal, el.detailModal].forEach(m => m.addEventListener("click", e => { if (e.target === m) closeModal(m); }));
  }

  async function init() { 
    bindEvents(); 
    await loadSongs(); 
    
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("tab") === "culto") {
      switchPage("culto");
    } else if (urlParams.get("tab") === "ensaio") {
      switchPage("ensaio");
    }
  }

  init();
})();

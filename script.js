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
    lastFocusEl: null,
    signInMounted: false,
    userButtonMounted: false,
    initialTabApplied: false,
    installScreenChecked: false
  };

  const el = {
    signInScreen:   document.getElementById("signInScreen"),
    clerkSignIn:    document.getElementById("clerkSignIn"),
    signInError:    document.getElementById("signInError"),
    appRoot:        document.getElementById("appRoot"),
    userButtonMount:document.getElementById("userButtonMount"),

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
    notesField:     document.getElementById("notesField"),
    saveAllKeys:    document.getElementById("saveAllKeys"),
    saveLyrics:     document.getElementById("saveLyrics"),
    deleteSongBtn:  document.getElementById("deleteSongBtn"),
    tabKeys:        document.getElementById("tabKeys"),
    tabLyrics:      document.getElementById("tabLyrics"),
    tabShare:       document.getElementById("tabShare"),
    paneKeys:       document.getElementById("paneKeys"),
    paneLyrics:     document.getElementById("paneLyrics"),
    paneShare:      document.getElementById("paneShare"),

    shareEmailField:document.getElementById("shareEmailField"),
    shareCanEdit:   document.getElementById("shareCanEdit"),
    addShareBtn:    document.getElementById("addShareBtn"),
    shareList:      document.getElementById("shareList"),
    shareEmptyState:document.getElementById("shareEmptyState"),

    navRepertorio:  document.getElementById("navRepertorio"),
    navCulto:       document.getElementById("navCulto"),
    navEnsaio:      document.getElementById("navEnsaio"),
    pageRepertorio: document.getElementById("pageRepertorio"),
    pageCulto:      document.getElementById("pageCulto"),
    pageEnsaio:     document.getElementById("pageEnsaio"),

    cultoSongsList: document.getElementById("cultoSongsList"),
    cultoEmptyState:document.getElementById("cultoEmptyState"),
    ensaioSongsList:document.getElementById("ensaioSongsList"),
    ensaioEmptyState:document.getElementById("ensaioEmptyState"),

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

  const emptyStateDefaultText = el.emptyState.textContent;

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

    const { error } = await window.supabaseClient.from('songs').update({ cifra_url: url }).eq('id', state.selectedSong.id);
    if (error) {
      console.error("Erro ao salvar link da cifra:", error);
      showToast("Erro ao salvar link: " + error.message, "error");
      return;
    }

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

    const { error } = await window.supabaseClient.from('songs').update({ youtube_url: url }).eq('id', state.selectedSong.id);
    if (error) {
      console.error("Erro ao salvar YouTube:", error);
      showToast("Erro ao salvar YouTube: " + error.message, "error");
      return;
    }

    el.youtubeUrlField.value = url;
    showToast("YouTube salvo!", "success");
  }

  // Tom "principal" exibido no card/badge e nos textos de compartilhamento:
  // prioriza o tom do Pastor, senão o primeiro tom preenchido que encontrar.
  function getMainKey(cached) {
    const pastorKey = cached.find(k => k.member_name.includes("Pastor") && k.key);
    if (pastorKey) return pastorKey.key;
    const anyKey = cached.find(k => k.key);
    return anyKey ? anyKey.key : "";
  }

  // ===================== AUTENTICAÇÃO (Clerk) =====================
  function getCurrentUserId() {
    return window.Clerk?.user?.id || null;
  }

  function renderAuthState() {
    const signedIn = !!(window.Clerk && window.Clerk.user);
    el.signInScreen.classList.toggle("hidden", signedIn);
    el.appRoot.classList.toggle("hidden", !signedIn);

    if (signedIn) {
      if (!state.userButtonMounted) {
        window.Clerk.mountUserButton(el.userButtonMount);
        state.userButtonMounted = true;
      }
      loadSongs().catch(err => {
        console.error("Erro ao carregar músicas:", err);
        showToast("Erro ao carregar músicas. Verifique sua conexão.", "error");
      });
      applyInitialTabFromUrl();

      // Só oferece instalar o app depois do login (ver comentário em
      // index.html: mostrar antes conflita visualmente com a tela de login).
      if (!state.installScreenChecked) {
        state.installScreenChecked = true;
        window.maybeShowInstallScreen?.();
      }
    } else if (!state.signInMounted) {
      window.Clerk.mountSignIn(el.clerkSignIn);
      state.signInMounted = true;
    }
  }

  function applyInitialTabFromUrl() {
    if (state.initialTabApplied) return;
    state.initialTabApplied = true;
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("tab") === "culto") switchPage("culto");
    else if (urlParams.get("tab") === "ensaio") switchPage("ensaio");
  }

  // ===================== RENDERIZAÇÃO =====================
  function renderEnsaioBtnState(btn, active) {
    btn.classList.toggle("active", active);
    btn.innerHTML = `<span class="material-symbols-outlined">${active ? "headphones" : "headset_off"}</span>`;
    btn.setAttribute("aria-label", active ? "Remover do ensaio" : "Adicionar ao ensaio");
    btn.style.color = active ? "#6B6B66" : "";
  }

  function renderStarBtnState(btn, active) {
    btn.classList.toggle("active", active);
    btn.innerHTML = `<span class="material-symbols-outlined">${active ? "star" : "star_border"}</span>`;
    btn.setAttribute("aria-label", active ? "Remover do culto" : "Adicionar ao culto");
  }

  function createSongCard(song) {
    const card = document.createElement("div");
    card.className = "song-card";

    const cached = state.keysCache[song.id] || [];
    const mainKey = getMainKey(cached) || "♪";

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

    const actionsBlock = document.createElement("div");
    actionsBlock.style.display = "flex";
    actionsBlock.style.gap = "4px";

    const ensaioBtn = document.createElement("button");
    ensaioBtn.className = "star-btn";
    renderEnsaioBtnState(ensaioBtn, song.on_rehearsal);

    ensaioBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const newVal = !song.on_rehearsal;
      renderEnsaioBtnState(ensaioBtn, newVal);
      song.on_rehearsal = newVal;

      const { error } = await window.supabaseClient.from('songs').update({ on_rehearsal: newVal }).eq('id', song.id);
      if (error) {
        console.error("Erro ao salvar:", error);
        showToast("Erro ao salvar: " + error.message, "error");
        song.on_rehearsal = !newVal;
        renderEnsaioBtnState(ensaioBtn, !newVal);
        return;
      }

      if (!el.pageEnsaio.classList.contains("hidden")) renderEnsaioSongs();
    });

    const starBtn = document.createElement("button");
    starBtn.className = "star-btn";
    renderStarBtnState(starBtn, song.on_setlist);

    starBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const newVal = !song.on_setlist;
      renderStarBtnState(starBtn, newVal);
      song.on_setlist = newVal;

      const { error } = await window.supabaseClient.from('songs').update({ on_setlist: newVal }).eq('id', song.id);
      if (error) {
        console.error("Erro ao salvar:", error);
        showToast("Erro ao salvar: " + error.message, "error");
        song.on_setlist = !newVal;
        renderStarBtnState(starBtn, !newVal);
        return;
      }

      if (!el.pageCulto.classList.contains("hidden")) renderCultoSongs();
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
    state.filteredSongs.forEach((song) => { el.songsList.appendChild(createSongCard(song)); });
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
    el.songsList.innerHTML = "";
    el.emptyState.textContent = "Carregando músicas...";
    el.emptyState.style.display = "block";

    const { data, error } = await window.supabaseClient.from('songs').select('*').order('title');
    if (error) {
      console.error("Erro ao carregar músicas:", error);
      showToast("Erro ao carregar músicas: " + error.message, "error");
      el.emptyState.textContent = "Erro ao carregar músicas.";
      return;
    }

    state.songs = data || [];
    el.emptyState.textContent = emptyStateDefaultText;
    await loadAllKeys();
    applyFilter(el.searchInput.value);
  }

  async function loadAllKeys() {
    if (!state.songs.length) { state.keysCache = {}; return; }

    const { data, error } = await window.supabaseClient.from('song_keys').select('*');
    if (error) {
      console.error("Erro ao carregar tons:", error);
      showToast("Erro ao carregar tons: " + error.message, "error");
      return;
    }

    state.keysCache = {};
    (data || []).forEach(row => {
      if (!state.keysCache[row.song_id]) state.keysCache[row.song_id] = [];
      state.keysCache[row.song_id].push({ member_name: row.member_name, key: row.key });
    });
  }

  async function addSong(title) {
    const parsed = normalizeTitle(title);
    if (!parsed.title) return;

    const { data: existing, error: checkErr } = await window.supabaseClient
      .from('songs').select('id').eq('title_norm', parsed.norm).maybeSingle();
    if (checkErr) {
      console.error("Erro ao verificar duplicidade:", checkErr);
      showToast("Erro ao verificar duplicidade: " + checkErr.message, "error");
      return;
    }
    if (existing) { showToast("Música já existe!"); return; }

    const { error } = await window.supabaseClient
      .from('songs').insert({ title: parsed.title, title_norm: parsed.norm, on_setlist: false, on_rehearsal: false });
    if (error) {
      console.error("Erro ao adicionar música:", error);
      showToast("Erro ao adicionar música: " + error.message, "error");
      return;
    }

    closeModal(el.songModal);
    el.newSongTitle.value = "";
    await loadSongs();
    showToast("Música adicionada!", "success");
  }

  // ===================== DETALHES =====================
  async function openDetail(songId) {
    state.selectedSong = state.songs.find(s => s.id === songId);
    if (!state.selectedSong) return;

    const { data: keysData, error } = await window.supabaseClient.from('song_keys').select('*').eq('song_id', songId);
    if (error) {
      console.error("Erro ao carregar tons:", error);
      showToast("Erro ao carregar tons: " + error.message, "error");
    }
    const mapByMember = new Map((keysData || []).map(k => [k.member_name, k]));

    state.selectedKeys = MEMBERS.map(name => {
      const ex = mapByMember.get(name);
      return { id: ex?.id || crypto.randomUUID(), member_name: name, key: ex?.key || "" };
    });

    el.lyricsField.value = state.selectedSong.lyrics || "";
    el.cifraUrlField.value = state.selectedSong.cifra_url || "";
    el.youtubeUrlField.value = state.selectedSong.youtube_url || "";
    el.notesField.value = state.selectedSong.notes || "";

    el.detailTitle.textContent = state.selectedSong.title;

    // Compartilhamento é só para o dono da música — RLS já protege os dados,
    // isso aqui é só pra não mostrar a aba pra quem não pode usá-la.
    const isOwner = !!(state.selectedSong.owner_id && state.selectedSong.owner_id === getCurrentUserId());
    el.tabShare.classList.toggle("hidden", !isOwner);
    if (isOwner) renderShareList();

    switchDetailTab("keys");
    renderKeyFields();
    openModal(el.detailModal);
  }

  function switchDetailTab(tab) {
    state.detailTab = tab;
    el.tabKeys.classList.toggle("tab-active", tab === "keys");
    el.tabLyrics.classList.toggle("tab-active", tab === "lyrics");
    el.tabShare.classList.toggle("tab-active", tab === "share");
    el.paneKeys.classList.toggle("hidden", tab !== "keys");
    el.paneLyrics.classList.toggle("hidden", tab !== "lyrics");
    el.paneShare.classList.toggle("hidden", tab !== "share");
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
    const payloads = state.selectedKeys.map(i => ({
      id: i.id,
      song_id: state.selectedSong.id,
      member_name: i.member_name,
      key: i.key || null
    }));

    const { error } = await window.supabaseClient.from('song_keys').upsert(payloads);
    if (error) {
      console.error("Erro ao salvar tons:", error);
      showToast("Erro ao salvar tons: " + error.message, "error");
      return;
    }

    state.keysCache[state.selectedSong.id] = state.selectedKeys.filter(k => k.key).map(k => ({ member_name: k.member_name, key: k.key }));
    closeModal(el.detailModal);
    renderSongs();
    if(!el.pageCulto.classList.contains("hidden")) renderCultoSongs();
    if(!el.pageEnsaio.classList.contains("hidden")) renderEnsaioSongs();
    showToast("Tons salvos!", "success");
  }

  async function saveLyrics() {
    const updatePayload = {
      lyrics: el.lyricsField.value.trim() || null,
      notes: el.notesField.value.trim() || null
    };

    const { error } = await window.supabaseClient.from('songs').update(updatePayload).eq('id', state.selectedSong.id);
    if (error) {
      console.error("Erro ao salvar dados:", error);
      showToast("Erro ao salvar dados: " + error.message, "error");
      return;
    }

    closeModal(el.detailModal);
    showToast("Dados salvos!", "success");
  }

  async function deleteSong() {
    const ok = await showConfirm(`Excluir "${state.selectedSong.title}"?`);
    if (!ok) return;

    const { error } = await window.supabaseClient.from('songs').delete().eq('id', state.selectedSong.id);
    if (error) {
      console.error("Erro ao excluir:", error);
      showToast("Erro ao excluir: " + error.message, "error");
      return;
    }

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

    const { data: existing, error: checkErr } = await window.supabaseClient
      .from('songs').select('title_norm').in('title_norm', processed.map(p => p.norm));
    if (checkErr) {
      console.error("Erro ao verificar duplicidade:", checkErr);
      showToast("Erro ao verificar duplicidade: " + checkErr.message, "error");
      return;
    }
    const existingSet = new Set((existing || []).map(r => r.title_norm));

    const toInsert = processed.filter(p => !existingSet.has(p.norm));
    const skipped = processed.length - toInsert.length;

    if (!toInsert.length) {
      el.importSummary.textContent = `Nenhuma música nova — as ${processed.length} já existiam.`;
      el.importSummary.classList.remove("hidden");
      return;
    }

    const rowsToInsert = toInsert.map(item => ({
      title: item.title, title_norm: item.norm, on_setlist: false, on_rehearsal: false
    }));

    for (let i = 0; i < rowsToInsert.length; i += CHUNK_SIZE) {
      const chunk = rowsToInsert.slice(i, i + CHUNK_SIZE);
      const { error } = await window.supabaseClient.from('songs').insert(chunk);
      if (error) {
        console.error("Erro ao importar:", error);
        showToast("Erro ao importar: " + error.message, "error");
        return;
      }
    }

    await loadSongs();
    el.bulkText.value = "";
    el.importSummary.textContent = `${toInsert.length} música(s) importada(s)` +
      (skipped > 0 ? ` — ${skipped} já existente(s) ignorada(s).` : ".");
    el.importSummary.classList.remove("hidden");
    showToast("Músicas importadas!", "success");
  }

  // ===================== COMPARTILHAMENTO =====================
  async function renderShareList() {
    const { data, error } = await window.supabaseClient
      .from('song_shares').select('*').eq('song_id', state.selectedSong.id).order('created_at');
    if (error) {
      console.error("Erro ao carregar compartilhamentos:", error);
      showToast("Erro ao carregar compartilhamentos: " + error.message, "error");
      return;
    }

    el.shareList.innerHTML = "";
    const shares = data || [];
    el.shareEmptyState.style.display = shares.length ? "none" : "block";

    shares.forEach(share => {
      const li = document.createElement("li");
      li.className = "share-item";

      const info = document.createElement("div");
      const email = document.createElement("span");
      email.className = "share-item-email";
      email.textContent = share.shared_with_email;
      const perm = document.createElement("span");
      perm.className = "share-item-perm";
      perm.textContent = share.can_edit ? " · pode editar" : " · somente ver";
      info.append(email, perm);

      const removeBtn = document.createElement("button");
      removeBtn.className = "star-btn";
      removeBtn.innerHTML = `<span class="material-symbols-outlined">close</span>`;
      removeBtn.setAttribute("aria-label", `Remover compartilhamento com ${share.shared_with_email}`);
      removeBtn.addEventListener("click", () => removeShare(share.id));

      li.append(info, removeBtn);
      el.shareList.appendChild(li);
    });
  }

  async function addShare() {
    const email = (el.shareEmailField.value || "").trim().toLowerCase();
    if (!email) return;

    const { error } = await window.supabaseClient.from('song_shares').insert({
      song_id: state.selectedSong.id,
      shared_with_email: email,
      can_edit: el.shareCanEdit.checked
    });
    if (error) {
      console.error("Erro ao compartilhar:", error);
      showToast("Erro ao compartilhar: " + error.message, "error");
      return;
    }

    el.shareEmailField.value = "";
    el.shareCanEdit.checked = false;
    showToast("Compartilhado!", "success");
    renderShareList();
  }

  async function removeShare(shareId) {
    const { error } = await window.supabaseClient.from('song_shares').delete().eq('id', shareId);
    if (error) {
      console.error("Erro ao remover compartilhamento:", error);
      showToast("Erro ao remover: " + error.message, "error");
      return;
    }
    renderShareList();
  }

  // ===================== EVENTOS =====================
  function bindEvents() {
    el.searchInput.addEventListener("input", debounce(e => applyFilter(e.target.value), 300));
    el.addSongBtn.addEventListener("click",    () => openModal(el.songModal, el.newSongTitle));
    el.bulkImportBtn.addEventListener("click", () => {
      el.importSummary.classList.add("hidden");
      el.importSummary.textContent = "";
      openModal(el.importModal, el.bulkText);
    });
    el.confirmAddSong.addEventListener("click", () => addSong(el.newSongTitle.value));
    el.confirmImport.addEventListener("click", bulkImport);
    el.tabKeys.addEventListener("click",       () => switchDetailTab("keys"));
    el.tabLyrics.addEventListener("click",     () => switchDetailTab("lyrics"));
    el.tabShare.addEventListener("click",      () => switchDetailTab("share"));
    el.saveAllKeys.addEventListener("click",   saveAllKeys);
    el.saveLyrics.addEventListener("click",    saveLyrics);
    el.deleteSongBtn.addEventListener("click", deleteSong);
    el.addShareBtn.addEventListener("click",   addShare);

    el.navRepertorio.addEventListener("click", () => switchPage("repertorio"));
    el.navCulto.addEventListener("click", () => switchPage("culto"));
    el.navEnsaio.addEventListener("click", () => switchPage("ensaio"));

    // AÇÕES CULTO
    el.clearSetlistBtn.addEventListener("click", async () => {
      const ok = await showConfirm("Remover todas as músicas do culto?");
      if (!ok) return;

      const cultoSongs = state.songs.filter(s => s.on_setlist === true);
      if (!cultoSongs.length) return;

      const { error } = await window.supabaseClient
        .from('songs').update({ on_setlist: false }).in('id', cultoSongs.map(s => s.id));
      if (error) {
        console.error("Erro ao limpar lista:", error);
        showToast("Erro ao limpar lista: " + error.message, "error");
        return;
      }

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
        const key = getMainKey(cached);
        const mainKey = key ? ` (${key})` : "";
        const cifraLink = song.cifra_url || getDefaultCifraSearchUrl(song.title);

        text += `${index + 1}. *${song.title}*${mainKey}\n🎸 Cifra: ${cifraLink}\n`;
        if (song.youtube_url) text += `▶️ Ouvir: ${song.youtube_url}\n`;
        if (song.notes) text += `📝 Notas: ${song.notes}\n`;
        text += `\n`;
      });
      const appUrl = window.location.origin + window.location.pathname + "?tab=culto";
      text += `📱 *Ver direto no App:*\n${appUrl}`;
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
    });

    // AÇÕES ENSAIO
    el.clearEnsaioBtn.addEventListener("click", async () => {
      const ok = await showConfirm("Remover todas as músicas da lista de ensaio?");
      if (!ok) return;

      const ensaioSongs = state.songs.filter(s => s.on_rehearsal === true);
      if (!ensaioSongs.length) return;

      const { error } = await window.supabaseClient
        .from('songs').update({ on_rehearsal: false }).in('id', ensaioSongs.map(s => s.id));
      if (error) {
        console.error("Erro ao limpar lista de ensaio:", error);
        showToast("Erro ao limpar lista: " + error.message, "error");
        return;
      }

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
        const key = getMainKey(cached);
        const mainKey = key ? ` (${key})` : "";
        const cifraLink = song.cifra_url || getDefaultCifraSearchUrl(song.title);

        text += `${index + 1}. *${song.title}*${mainKey}\n🎸 Cifra: ${cifraLink}\n`;
        if (song.youtube_url) text += `▶️ Referência: ${song.youtube_url}\n`;
        if (song.notes) text += `📝 Notas: ${song.notes}\n`;
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

  // A altura do .top-bar varia entre aparelhos por causa do
  // env(safe-area-inset-top) (notch, Dynamic Island etc). Medimos o valor
  // real e expomos via --topbar-height para o body usar como padding-top,
  // em vez de um valor fixo "chutado" que pode sobrepor ou deixar vão.
  function syncTopBarHeight() {
    const topBar = document.querySelector(".top-bar");
    if (!topBar) return;
    const apply = () => {
      document.documentElement.style.setProperty("--topbar-height", `${topBar.offsetHeight}px`);
    };
    apply();
    if (window.ResizeObserver) {
      new ResizeObserver(apply).observe(topBar);
    } else {
      window.addEventListener("resize", apply);
    }
  }

  async function init() {
    bindEvents();
    syncTopBarHeight();

    try {
      await window.ClerkReady;
    } catch (err) {
      console.error("Falha ao carregar autenticação (Clerk):", err);
      el.signInScreen.classList.remove("hidden");
      el.signInError.textContent = "Não foi possível carregar o login. Verifique sua conexão ou tente novamente mais tarde.";
      el.signInError.classList.remove("hidden");
      return;
    }

    renderAuthState();
    window.Clerk.addListener(() => renderAuthState());
  }

  init();
})();

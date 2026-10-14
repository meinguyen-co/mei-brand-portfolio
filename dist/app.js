(() => {
  "use strict";
  const data = window.PORTFOLIO;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escape = value => String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const editKey = "mei-portfolio-v7-text";
  const defaults = new Map();
  let edits = {}, images = {}, editing = false, db, currentCase, opener, videoOpener, imageOpener, toastTimer;
  try { const saved = JSON.parse(localStorage.getItem(editKey) || "{}"); if (saved && typeof saved === "object" && !Array.isArray(saved)) edits = saved; } catch {}

  // Only simple editorial formatting is accepted; pasted or imported scripts and attributes never execute.
  function safeRich(html) {
    const tokens = String(html).split(/(<[^>]*>)/g);
    return tokens.map(token => {
      if (!token.startsWith("<")) return escape(token).replace(/&amp;((?:amp|lt|gt|quot|#39|nbsp);)/g, "&$1");
      const m = token.match(/^<\s*(\/?)\s*(em|strong|br)\s*\/?\s*>$/i);
      return m ? "<" + m[1] + m[2].toLowerCase() + ">" : "";
    }).join("");
  }
  function filteredIds(category) { return data.projects.filter(p => category === "all" || p.category === category).map(p => p.id); }
  function status(message) { $("#edit-status").textContent = message; }
  function toast(message) {
    const node = $("#toast"); node.textContent = message; node.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { node.hidden = true; }, 4000);
  }
  function saveText() {
    try { localStorage.setItem(editKey, JSON.stringify(edits)); status("Changes saved in this browser. Export a backup before moving to another device."); }
    catch { status("Browser storage is unavailable. Export your changes before closing."); }
  }
  function wireText(root = document) {
    $$("[data-edit]", root).forEach(node => {
      const key = node.dataset.edit;
      if (!defaults.has(key)) defaults.set(key, node.innerHTML);
      if (Object.hasOwn(edits, key) && typeof edits[key] === "string") node.innerHTML = safeRich(edits[key]);
      node.contentEditable = String(editing);
      node.spellcheck = editing;
      if (!node.dataset.editWired) {
        node.addEventListener("input", () => { edits[key] = safeRich(node.innerHTML); saveText(); });
        node.addEventListener("paste", event => {
          if (!editing) return;
          event.preventDefault();
          const text = event.clipboardData.getData("text/plain");
          const selection = window.getSelection();
          if (selection && selection.rangeCount) {
            const range = selection.getRangeAt(0); range.deleteContents();
            const fragment = document.createTextNode(text); range.insertNode(fragment);
            range.setStartAfter(fragment); range.collapse(true); selection.removeAllRanges(); selection.addRange(range);
          }
          edits[key] = safeRich(node.innerHTML); saveText();
        });
        node.dataset.editWired = "yes";
      }
    });
    cleanEmptyContent(root);
  }
  function cleanEmptyContent(root = document) {
    $$("[data-edit]", root).forEach(node => {
      const empty = !node.textContent.replace(/\u00a0/g, " ").trim();
      node.toggleAttribute("data-empty-content", empty && !editing);
    });
    $$(".thinking-flow article,.journey-strip > div,.delivery-tools dl > div,.case-stage-heading,.section-heading > div", root).forEach(block => {
      const fields = $$("[data-edit]", block);
      block.toggleAttribute("data-empty-content", !editing && fields.length > 0 && fields.every(node => !node.textContent.replace(/\u00a0/g, " ").trim()));
    });
  }
  function setEditing(value) {
    editing = value; document.body.classList.toggle("is-editing", value);
    $("#edit-toggle").setAttribute("aria-pressed", String(value));
    $("#edit-toggle").textContent = value ? "Finish editing" : "Edit text & images";
    wireText();
    if (value) $$("details.story-detail").forEach(node => { node.open = true; });
    if (value) $$("details.season-detail,details.case-profile-fold,details.case-methods").forEach(node => { node.open = true; });
    status(value ? "Click text to edit. Use Add or Replace image in any slot; open a project to edit its story." : "Changes saved in this browser. Export a backup for a shared site update.");
  }
  function slotMarkup(key, slot) {
    return '<div data-slot="' + escape(key) + '" data-fallback="' + escape(data.imageRenditions?.[slot.image] || slot.image || "") + '" data-original="' + escape(slot.original || slot.image || '') + '" data-alt="' + escape(slot.alt || slot.label || "Portfolio image") + '" data-label="' + escape(slot.label || "Add a project image") + '" data-help="' + escape(slot.help || "Add a high-resolution image and a caption explaining your contribution.") + '" data-caption="' + escape(slot.caption || "") + '"></div>';
  }
  const imageReady = new Promise(resolve => {
    try {
      if (!window.indexedDB) { resolve(); return; }
      const request = indexedDB.open("mei-portfolio-v7-images", 1);
      request.onupgradeneeded = () => { request.result.createObjectStore("images", {keyPath:"key"}); };
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
      request.onsuccess = () => {
        db = request.result;
        const tx = db.transaction("images");
        const query = tx.objectStore("images").getAll();
        query.onsuccess = () => { query.result.forEach(record => { if (validImage(record)) images[record.key] = record; }); resolve(); };
        query.onerror = () => resolve();
      };
    } catch { resolve(); }
  });
  function validImage(record) {
    return record && typeof record.key === "string" && /^[a-zA-Z0-9._-]{1,180}$/.test(record.key) && typeof record.data === "string" && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=\r\n]+$/.test(record.data) && typeof record.caption === "string";
  }
  async function persistImage(record, remove = false) {
    await imageReady;
    if (!db) return false;
    return new Promise(resolve => {
      try {
        const tx = db.transaction("images", "readwrite");
        const store = tx.objectStore("images");
        if (remove) store.delete(record.key); else store.put(record);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
        tx.onabort = () => resolve(false);
      } catch { resolve(false); }
    });
  }
  function drawSlot(node) {
    node.classList.add("asset-slot");
    const key = node.dataset.slot, record = images[key], fallback = node.dataset.fallback;
    const captionKey = "caption." + key;
    const caption = edits[captionKey] || (record ? escape(record.caption) : escape(node.dataset.caption || ""));
    let html = record || fallback
      ? '<img src="' + escape(record ? record.data : fallback) + '" alt="' + escape(record ? record.caption || node.dataset.alt : node.dataset.alt) + '" loading="' + (key === "hero.portrait" ? "eager" : "lazy") + '" decoding="async">'
      : '<div class="slot-placeholder"><span class="slot-plus" aria-hidden="true">＋</span><strong>' + escape(node.dataset.label || "Add a project image") + '</strong><p>' + escape(node.dataset.help || "Add a high-resolution image and explain your contribution.") + '</p><small>Image to add · High-resolution original</small></div>';
    if (caption || record) html += '<p class="slot-caption" data-edit="' + escape(captionKey) + '">' + safeRich(caption) + '</p>';
    if ((record || fallback) && (key.startsWith("case.") || key.startsWith("thinking."))) html += '<button type="button" class="asset-expand" data-view-image="' + escape(key) + '" aria-label="View ' + escape(node.dataset.alt || "project image") + ' at full size">View image ↗</button>';
    html += '<div class="slot-controls"><button type="button" data-upload="' + escape(key) + '">' + (record || fallback ? "Replace image" : "Add image") + '</button>';
    if (record) html += '<button type="button" data-remove-image="' + escape(key) + '">Restore original / placeholder</button>';
    html += '</div>'; node.innerHTML = html;
    wireText(node);
  }
  function wireSlots(root = document) { $$("[data-slot]", root).forEach(drawSlot); }
  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("The file could not be read. Please choose it again."));
      reader.readAsDataURL(file);
    });
  }
  async function uploadImage(key) {
    const input = document.createElement("input"); input.type = "file"; input.accept = "image/jpeg,image/png,image/webp";
    input.addEventListener("change", async () => {
      const file = input.files[0]; if (!file) return;
      try {
        if (!["image/jpeg","image/png","image/webp"].includes(file.type)) throw new Error("Choose a JPEG, PNG or WebP image.");
        if (file.size > 20 * 1024 * 1024) throw new Error("Choose an image smaller than 20 MB.");
        const record = {key, data:await readFile(file), caption:file.name.replace(/\.[^.]+$/, "")};
        if (!validImage(record)) throw new Error("This image format could not be read.");
        await imageReady; images[key] = record; delete edits["caption." + key]; saveText();
        const saved = await persistImage(record);
        $$("[data-slot]").filter(node => node.dataset.slot === key).forEach(drawSlot);
        status(saved ? "Original-quality image saved in this browser. Edit its caption, then export a backup." : "Image added for this session. Export your changes before closing.");
        toast("Image added. Click its caption to describe your contribution.");
      } catch (error) { status(error.message); toast(error.message); }
    });
    input.click();
  }
  async function removeImage(key) {
    delete images[key]; delete edits["caption." + key]; defaults.delete("caption." + key); saveText();
    await persistImage({key}, true); $$("[data-slot]").filter(node => node.dataset.slot === key).forEach(drawSlot);
    status("Original image or placeholder restored.");
  }

  $("#brand-wall").innerHTML = data.brands.map((brand,i) => '<button type="button" class="brand-tile" data-brand="' + i + '" aria-pressed="false" aria-label="Reveal ' + escape(brand.name) + ' logo"><img src="assets/' + escape(brand.file) + '" alt="' + escape(brand.name) + ' logo" style="--brand-width:' + (brand.width || 126) + 'px" loading="lazy" decoding="async"></button>').join('');
  $("#film-grid").innerHTML = data.films.map((film,i) => {
    const image = film.kind === 'image';
    const visual = image ? slotMarkup('platform.' + film.id + '.cover',{image:film.poster,original:film.original,alt:film.name + ' campaign-page screenshot'}) : '<img src="' + escape(film.poster) + '" alt="' + escape(film.name) + ' campaign preview" loading="lazy" decoding="async">';
    const action = image ? 'data-view-image="platform.' + film.id + '.cover"' : 'data-video="' + film.id + '"';
    return '<article class="film-card" aria-roledescription="slide" aria-label="' + (i+1) + ' of ' + data.films.length + ': ' + escape(film.name) + '"><div class="film-poster">' + visual + '<button type="button" class="watch-button" ' + action + ' aria-label="' + (image ? 'View ' : 'Watch ') + escape(film.name) + ' campaign example"><span>' + (image ? 'View campaign' : 'Watch preview') + '</span><span class="play-icon" aria-hidden="true">' + (image ? '↗' : '▶') + '</span></button></div><h3 data-edit="film.' + film.id + '.name">' + escape(film.name) + '</h3><p class="film-format" data-edit="film.' + film.id + '.format">' + escape(film.format) + '</p><p class="film-contribution" data-edit="film.' + film.id + '.contribution">' + escape(film.contribution) + '</p></article>';
  }).join('');
  const carousel = $("#film-grid");
  function carouselState() {
    const cards = $$(".film-card", carousel);
    const step = cards.length > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : carousel.clientWidth;
    const visible = Math.max(1, Math.min(cards.length, Math.round(carousel.clientWidth / (step || carousel.clientWidth || 1))));
    const max = Math.max(0, carousel.scrollWidth - carousel.clientWidth);
    const left = Math.max(0, Math.min(max, carousel.scrollLeft || 0));
    const first = Math.min(cards.length - visible, Math.max(0, Math.round(left / (step || 1))));
    return {step,visible,max,left,first};
  }
  function updateCarousel() {
    const state = carouselState();
    $('[data-carousel="-1"]').disabled = state.left < 2;
    $('[data-carousel="1"]').disabled = state.left >= state.max - 2;
    $("#carousel-status").textContent = (state.first+1) + (state.visible > 1 ? '–' + Math.min(data.films.length,state.first+state.visible) : '') + ' / ' + data.films.length;
  }
  function moveCarousel(direction, edge) {
    const state = carouselState();
    const left = edge === 'start' ? 0 : edge === 'end' ? state.max : Math.max(0, Math.min(state.max, state.left + direction * state.step));
    carousel.scrollTo({left,behavior:window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
  }
  carousel.addEventListener('scroll', updateCarousel, {passive:true});
  carousel.addEventListener('keydown', event => {
    if (event.target !== carousel || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault(); moveCarousel(event.key === 'ArrowLeft' ? -1 : 1, event.key === 'Home' ? 'start' : event.key === 'End' ? 'end' : undefined);
  });
  if ('ResizeObserver' in window) new ResizeObserver(updateCarousel).observe(carousel);
  if (window.requestAnimationFrame) window.requestAnimationFrame(updateCarousel);
  function projectCard(project) {
    const key = 'project.' + project.id;
    const visual = slotMarkup(key + '.cover',{image:project.image,alt:project.alt});
    return '<article class="project-card" data-project="' + project.id + '"><div class="project-visual ' + project.id + '"><span class="project-scope-tag" data-edit="' + key + '.scope-label">' + escape(project.scopeLabel) + '</span>' + visual + '<button type="button" class="project-image-open" data-case="' + project.id + '" aria-label="Open ' + escape(project.name) + ' case study"></button></div><button type="button" class="project-open" data-case="' + project.id + '" aria-label="Open ' + escape(project.name) + ' case study"><span><h3 data-edit="' + key + '.name">' + escape(project.name) + '</h3><p data-edit="' + key + '.subtitle">' + escape(project.subtitle) + '</p></span><span class="arrow" aria-hidden="true">↗</span></button><div class="project-summary"><p><span class="summary-label">My role</span><span data-edit="' + key + '.role">' + escape(project.role) + '</span></p><p><span class="summary-label">Scope</span><span data-edit="' + key + '.scope">' + escape(project.scopeSummary) + '</span></p><div class="project-skills">' + project.skills.slice(0,3).map((skill,i) => '<span data-edit="' + key + '.skill.' + i + '">' + escape(skill) + '</span>').join('') + '</div></div><div class="project-credit"><p data-edit="' + key + '.credit">' + escape(project.cardCredit) + '</p>' + (project.source ? '<a href="' + escape(project.source) + '" target="_blank" rel="noopener noreferrer" aria-label="Original ' + escape(project.name) + ' project and credits">Original project & credits ↗</a>' : '') + '</div></article>';
  }
  $("#project-grid").innerHTML = data.projectGroups.map((group,i) => '<div class="project-group-heading" data-project-group="' + group.id + '"><p class="eyebrow">0' + (i+1) + ' / Project scope</p><h3 data-edit="group.' + group.id + '.display-title-v2">' + escape(group.title) + '</h3></div>' + data.projects.filter(project => project.category === group.id).map(projectCard).join('')).join('');
  const strategy = document.createElement('section');
  strategy.className = 'commerce-strategy';
  strategy.innerHTML = '<p class="eyebrow">How I approach brand strategy on TikTok Shop</p><h3>Read the market.<br><em>Build the next move.</em></h3><p class="strategy-intro">A repeatable decision process—from category context to a campaign the team can deliver.</p><div class="strategy-steps">' + data.commerceStrategy.map((step,i) => '<details class="strategy-step"' + (i === 0 ? ' open' : '') + '><summary><span class="strategy-number">0' + (i+1) + '</span><span><strong>' + escape(step.title) + '</strong><small>' + escape(step.question) + '</small></span><span class="detail-toggle" aria-hidden="true">＋</span></summary><div class="strategy-detail"><p>' + escape(step.copy) + '</p><p class="strategy-output"><strong>Output</strong> ' + escape(step.output) + '</p></div></details>').join('') + '</div><p class="micro-copy">My approach: recommendations and delivery coordination. Brand teams approve product, pricing and budget decisions.</p>';
  document.querySelector('[data-project="commerce"]').after(strategy);
  function filterProjects(category) {
    const ids = filteredIds(category);
    strategy.hidden = category !== "all" && category !== "commerce";
    $$("[data-project]").forEach(node => { node.hidden = !ids.includes(node.dataset.project); if (!node.hidden && node.animate && !(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)) node.animate([{opacity:.5},{opacity:1}],{duration:160}); });
    $$("[data-project-group]").forEach(node => { node.hidden = category !== "all" && node.dataset.projectGroup !== category; });
    $$("[data-filter]").forEach(node => node.setAttribute("aria-pressed", String(node.dataset.filter === category)));
    $("#project-count").textContent = ids.length + (ids.length === 1 ? " story" : " stories");
  }

  function renderMethods() {
    if (!$("#method-tabs")) return;
    $("#method-tabs").innerHTML = data.methods.map((m,i) => '<button type="button" class="method-tab" role="tab" id="tab-' + m.id + '" data-method="' + i + '" aria-controls="method-panel" aria-selected="' + (i === 0) + '" tabindex="' + (i === 0 ? 0 : -1) + '"><span>0' + (i + 1) + '</span>' + m.label + '<span class="arrow" aria-hidden="true">→</span></button>').join("");
    selectMethod(0);
  }
  function selectMethod(index, focus = false) {
    const m = data.methods[index]; if (!m) return;
    $$("[data-method]").forEach((button,i) => { button.setAttribute("aria-selected", String(i === index)); button.tabIndex = i === index ? 0 : -1; if (i === index && focus) { button.focus(); button.scrollIntoView({block:"nearest",inline:"nearest",behavior:"instant"}); } });
    const panel = $("#method-panel"); if (!panel) return; panel.setAttribute("aria-labelledby","tab-" + m.id);
    panel.innerHTML = '<span class="eyebrow">0' + (index + 1) + ' / ' + m.label + '</span><h3 data-edit="method.' + m.id + '.title">' + escape(m.title) + '</h3><p data-edit="method.' + m.id + '.copy">' + escape(m.copy) + '</p><p class="method-output" data-edit="method.' + m.id + '.output">' + escape(m.output) + '</p>';
    wireText(panel);
    if (panel.animate && !(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)) panel.animate([{opacity:.5},{opacity:1}],{duration:160});
  }
  function tableMarkup(key, table) {
    return '<div class="table-wrap" role="region" tabindex="0" aria-label="' + escape(table.title) + '"><table class="case-table"><caption data-edit="' + key + '.title">' + escape(table.title) + '</caption><thead><tr>' + table.headers.map((h,i) => '<th scope="col" data-edit="' + key + '.header.' + i + '">' + escape(h) + '</th>').join("") + '</tr></thead><tbody>' + table.rows.map((row,i) => '<tr>' + row.map((cell,j) => '<' + (j === 0 ? 'th scope="row"' : 'td') + ' data-edit="' + key + '.row.' + i + '.' + j + '">' + escape(cell) + '</' + (j === 0 ? 'th' : 'td') + '>').join("") + '</tr>').join("") + '</tbody></table></div>';
  }
  function caseHTML(p) {
    const base = "case." + p.id;
    let html = '<div class="case-head"><p class="eyebrow">' + escape(p.name) + ' / ' + escape(p.scopeLabel) + '</p><h2 id="case-title" data-edit="' + base + '.title">' + escape(p.title) + '</h2><p class="case-deck" data-edit="' + base + '.deck">' + escape(p.deck) + '</p></div>';
    html += '<dl class="case-facts">' + p.facts.map((f,i) => '<div><dt>' + f[0] + '</dt><dd data-edit="' + base + '.fact.' + i + '">' + escape(f[1]) + '</dd></div>').join("") + '</dl>';
    html += '<details class="case-profile-fold"><summary>Skills & project scope <span aria-hidden="true">＋</span></summary><section class="case-profile" aria-label="Project skills and scope"><div><h3>Main skills</h3><ul class="skill-tags">' + p.skills.map((s,i) => '<li data-edit="' + base + '.skill.' + i + '">' + escape(s) + '</li>').join("") + '</ul></div><div><h3>Project scope</h3><ul class="scope-list">' + p.scope.map((s,i) => '<li data-edit="' + base + '.scope.' + i + '">' + escape(s) + '</li>').join("") + '</ul></div></section></details>';
    html += '<section class="case-work case-stage"><div class="case-stage-heading"><p class="eyebrow">Project story & delivery</p><h3>From the idea to the work.</h3><p>The team’s work, supported by clear briefs and coordinated delivery.</p></div>';
    if (p.planningTemplate) html += '<section class="planning-template"><p data-edit="' + base + '.template.intro">' + escape(p.planningTemplate.intro) + '</p>' + tableMarkup(base + '.template', p.planningTemplate) + '</section>';
    if (p.motion) html += '<section class="case-motion' + (p.motionLayout === 'landscape' ? ' landscape-motion' : '') + '" aria-labelledby="motion-' + p.id + '-title"><div class="motion-heading"><p class="eyebrow">' + escape(p.motionLabel || 'Campaign in motion') + '</p><h3 id="motion-' + p.id + '-title" data-edit="' + base + '.motion.title">' + escape(p.motionTitle) + '</h3><p data-edit="' + base + '.motion.intro">' + escape(p.motionIntro) + '</p></div><div class="motion-grid">' + p.motion.map(m => '<figure class="motion-card"><div class="motion-media"><video controls muted loop playsinline preload="none" poster="' + escape(m.poster) + '" aria-label="' + escape(m.title) + ' project animation"><source src="' + escape(m.src) + '" type="video/mp4">Your browser does not support video. <a href="' + escape(m.src) + '">Open this animation</a>.</video></div><figcaption><h4 data-edit="' + base + '.motion.' + m.id + '.title">' + escape(m.title) + '</h4><p data-edit="' + base + '.motion.' + m.id + '.caption">' + escape(m.caption) + '</p></figcaption><p class="motion-error" hidden>This animation could not play. <a href="' + escape(m.src) + '" target="_blank" rel="noopener">Open the motion file ↗</a></p></figure>').join("") + '</div><p class="motion-note">Press play to explore. Each silent animation can be paused or opened full screen.</p></section>';
    html += p.steps.map((s,i) => {
      let visual = "";
      if (s.visual) visual = '<div class="decision-visual">' + s.visual.map((v,j) => '<div><span>0' + (j + 1) + '</span><strong data-edit="' + base + '.' + s.id + '.visual.' + j + '.title">' + escape(v.title) + '</strong><p data-edit="' + base + '.' + s.id + '.visual.' + j + '.copy">' + escape(v.copy) + '</p></div>').join("") + '</div>';
      if (s.allocation) visual += '<div class="allocation"><p class="eyebrow">' + escape(s.allocation.label) + '</p><div class="allocation-labels"><span>' + s.allocation.mobile + '% Mobile</span><span>' + s.allocation.desktop + '% Desktop</span></div><div class="allocation-bar" role="img" aria-label="Proposed device allocation: 70 percent mobile, 30 percent desktop"><span style="width:' + s.allocation.mobile + '%"></span><span style="width:' + s.allocation.desktop + '%"></span></div></div>';
      if (s.table) visual += tableMarkup(base + '.' + s.id + '.table', s.table);
      return '<details class="story-detail" id="story-' + p.id + '-' + s.id + '"' + (s.slot || i === 0 || editing ? " open" : "") + '><summary><span class="step-number">0' + (i + 1) + '</span><h3 data-edit="' + base + '.' + s.id + '.title">' + escape(s.title) + '</h3><span class="detail-toggle" aria-hidden="true">＋</span></summary><section class="case-step' + (s.slot ? '' : ' text-only-step') + '"><div class="step-copy">' + s.paragraphs.map((text,j) => '<p data-edit="' + base + '.' + s.id + '.p.' + j + '">' + escape(text) + '</p>').join("") + visual + '</div>' + (s.slot ? slotMarkup(base + "." + s.id + ".image", s.slot) : '') + '</section></details>';
    }).join("");
    if (p.seasonal) html += '<section class="seasonal-showcase" aria-labelledby="seasonal-' + p.id + '-title"><p class="eyebrow">Other seasonal launches</p><h3 id="seasonal-' + p.id + '-title" data-edit="' + base + '.seasonal.title">' + escape(p.seasonalTitle) + '</h3><p class="seasonal-intro" data-edit="' + base + '.seasonal.intro">' + escape(p.seasonalIntro) + '</p><div class="seasonal-grid">' + p.seasonal.map(s => '<article class="season-card">' + slotMarkup(base + '.seasonal.' + s.id + '.image', s.slot) + '<h4 data-edit="' + base + '.seasonal.' + s.id + '.title">' + escape(s.title) + '</h4><p class="season-scope"><span>Scope</span><span data-edit="' + base + '.seasonal.' + s.id + '.scope">' + escape(s.scope) + '</span></p><details class="season-detail"' + (editing ? ' open' : '') + '><summary>Campaign & retail views <span aria-hidden="true">＋</span></summary><div class="season-extra">' + s.images.map((image,i) => slotMarkup(base + '.seasonal.' + s.id + '.extra.' + i, image)).join('') + '</div></details></article>').join('') + '</div></section>';
    if (p.gallery) html += '<section class="case-gallery"><p class="eyebrow">Selected project views</p><h3 data-edit="' + base + '.gallery.title">' + escape(p.galleryTitle) + '</h3><div class="case-gallery-grid">' + p.gallery.map((s,i) => slotMarkup(base + '.gallery.' + i, s)).join('') + '</div></section>';
    html += '</section><section class="case-result case-stage"><p class="eyebrow">Results</p><h3>The Outcome</h3><h4 data-edit="' + base + '.result.title">' + escape(p.result.title) + '</h4>' + (p.result.metrics.length ? '<div class="metric-row">' + p.result.metrics.map((m,i) => '<div class="metric"><strong data-edit="' + base + '.metric.' + i + '.value">' + escape(m[0]) + '</strong><span data-edit="' + base + '.metric.' + i + '.label">' + escape(m[1]) + '</span></div>').join("") + '</div>' : "") + '<p data-edit="' + base + '.result.copy">' + escape(p.result.copy) + '</p></section>';
    if (p.credit) html += '<p class="case-credit" data-edit="' + base + '.credit">' + escape(p.credit) + '</p>';
    if (p.source) html += '<a class="text-link case-source" href="' + escape(p.source) + '" target="_blank" rel="noopener noreferrer">' + escape(p.sourceLabel || "Original project material") + ' <span>↗</span></a>';
    const next = data.projects[(data.projects.indexOf(p) + 1) % data.projects.length];
    html += '<div class="case-next"><button type="button" class="button secondary" data-case="' + next.id + '">Next: ' + escape(next.name) + ' <span>→</span></button></div>';
    return html;
  }
  function pauseCaseMotion() { $$("#case-content video").forEach(video => video.pause()); }
  let motionObserver;
  function observeMedia(root, observerRoot = null) {
    if (!('IntersectionObserver' in window)) return;
    if (motionObserver) motionObserver.disconnect();
    motionObserver = new IntersectionObserver(entries => entries.forEach(entry => { if (!entry.isIntersecting) entry.target.pause(); }), {root:observerRoot,threshold:0.1});
    $$('video',root).forEach(video => motionObserver.observe(video));
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) $$('video').forEach(video => video.pause()); });
  function wireMotion(root) {
    $$(".motion-card", root).forEach(card => {
      const reportError = () => { $(".motion-error", card).hidden = false; };
      $("video", card).addEventListener("error", reportError);
      $("source", card).addEventListener("error", reportError);
    });
  }
  function openCase(id, source) {
    const p = data.projects.find(project => project.id === id); if (!p) return;
    currentCase = id;
    const dialog = $("#case-dialog"), root = $("#case-content");
    if (!dialog.open) opener = source || document.activeElement;
    pauseCaseMotion();
    root.innerHTML = caseHTML(p); renderMethods(); wireSlots(root); wireText(root); wireMotion(root);
    if (!dialog.open) { dialog.showModal(); document.body.style.overflow = "hidden"; }
    dialog.scrollTop = 0; $("#case-close").focus(); observeMedia(root, dialog);
  }
  function closeCase() { const d = $("#case-dialog"); if (d.open) d.close(); }
  function openVideo(id, source) {
    const f = data.films.find(film => film.id === id); if (!f || f.kind !== "video") return;
    videoOpener = source || document.activeElement;
    $("#video-content").innerHTML = '<div class="video-inner"><h2 id="video-title" data-edit="video.' + id + '.title">' + escape(f.name) + '</h2><p>' + escape(f.format) + '</p><video controls playsinline preload="metadata" poster="' + escape(f.poster) + '" aria-label="' + escape(f.name) + ' campaign preview"><source src="' + escape(f.src) + '" type="video/mp4">Your browser does not support video. <a href="' + escape(f.src) + '">Open the preview file</a>.</video><div class="video-error" hidden><p>The preview could not play in this browser.</p><a href="' + escape(f.src) + '" target="_blank" rel="noopener">Open the video file ↗</a></div><p data-edit="video.' + id + '.note">' + escape(f.note) + '</p><p class="micro-copy">Supplied campaign creative. The preview does not imply a campaign result or sole creative authorship.</p></div>';
    const video = $("#video-content video");
    const mediaError = () => { $(".video-error").hidden = false; };
    video.addEventListener("error", mediaError);
    $("source", video).addEventListener("error", mediaError);
    wireText($("#video-content")); $("#video-dialog").showModal(); document.body.style.overflow = "hidden"; $("#video-close").focus(); observeMedia($("#video-content"));
  }
  function closeVideo() { const d = $("#video-dialog"); if (d.open) d.close(); }
  function openImage(key, source) {
    const slot = $$("[data-slot]").find(node => node.dataset.slot === key);
    const img = slot && $("img", slot); if (!img) return;
    imageOpener = source || document.activeElement;
    const caption = $(".slot-caption", slot);
    $("#image-content").innerHTML = '<h2 id="image-title">' + escape(slot.dataset.alt || "Project image") + '</h2><img src="' + escape(images[key] ? img.getAttribute("src") : slot.dataset.original || img.getAttribute("src")) + '" alt="' + escape(img.getAttribute("alt") || slot.dataset.alt) + '">' + (caption ? '<p>' + safeRich(caption.innerHTML) + '</p>' : '');
    $("#image-dialog").showModal(); document.body.style.overflow = "hidden"; $("#image-close").focus();
  }
  function closeImage() { const d = $("#image-dialog"); if (d.open) d.close(); }
  $("#case-dialog").addEventListener("close", () => { pauseCaseMotion(); document.body.style.overflow = ""; if (opener && opener.isConnected) opener.focus(); });
  $("#video-dialog").addEventListener("close", () => { const video = $("#video-content video"); if (video) video.pause(); $("#video-content").innerHTML = ""; document.body.style.overflow = ""; if (videoOpener && videoOpener.isConnected) videoOpener.focus(); });
  $("#image-dialog").addEventListener("close", () => { $("#image-content").innerHTML = ""; if (!$("#case-dialog").open && !$("#video-dialog").open) document.body.style.overflow = ""; if (imageOpener && imageOpener.isConnected) imageOpener.focus(); });
  ["case-dialog","video-dialog","image-dialog"].forEach(id => {
    const dialog = $("#" + id);
    dialog.addEventListener("click", event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
  });
  $("#case-close").addEventListener("click", closeCase);
  $("#video-close").addEventListener("click", closeVideo);
  $("#image-close").addEventListener("click", closeImage);

  function setMenu(open) { $("#main-nav").classList.toggle("is-open", open); $("#menu-toggle").setAttribute("aria-expanded", String(open)); }
  $("#menu-toggle").addEventListener("click", () => setMenu($("#menu-toggle").getAttribute("aria-expanded") !== "true"));
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") setMenu(false);
    const tab = event.target.closest("[data-method]");
    if (!tab || !["ArrowRight","ArrowDown","ArrowLeft","ArrowUp","Home","End"].includes(event.key)) return;
    event.preventDefault(); const i = Number(tab.dataset.method), n = data.methods.length;
    selectMethod(event.key === "Home" ? 0 : event.key === "End" ? n - 1 : (i + (event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1) + n) % n, true);
  });
  document.addEventListener("click", event => {
    if (editing && event.target.closest("[data-edit]")) { event.preventDefault(); return; }
    const target = event.target.closest("button,a"); if (!target) return;
    if (target.dataset.brand !== undefined) {
      const show = target.getAttribute('aria-pressed') !== 'true';
      target.setAttribute('aria-pressed',String(show));
      target.setAttribute('aria-label',(show ? 'Hide ' : 'Reveal ') + data.brands[Number(target.dataset.brand)].name + ' logo');
    }
    if (target.dataset.carousel) moveCarousel(Number(target.dataset.carousel));
    if (target.dataset.case) openCase(target.dataset.case, target);
    if (target.dataset.video) openVideo(target.dataset.video, target);
    if (target.dataset.viewImage) openImage(target.dataset.viewImage, target);
    if (target.dataset.filter) filterProjects(target.dataset.filter);
    if (target.dataset.method !== undefined) selectMethod(Number(target.dataset.method));
    if (target.dataset.storyStep) {
      const detail = $("#" + target.dataset.storyStep);
      if (detail) { detail.open = true; detail.scrollIntoView({block:"start",behavior:window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth"}); $("summary", detail).focus(); }
    }
    if (target.dataset.upload) uploadImage(target.dataset.upload);
    if (target.dataset.removeImage) removeImage(target.dataset.removeImage);
    if (target.closest("#main-nav") && target.tagName === "A") setMenu(false);
  });
  if ("IntersectionObserver" in window) {
    const destinations = {home:'perspectives',perspectives:'perspectives',brands:'work',work:'work',platform:'work',about:'about',contact:'contact'};
    const observer = new IntersectionObserver(entries => {
      entries.filter(e => e.isIntersecting).forEach(e => {
        $$("#main-nav a").forEach(a => { if (a.getAttribute("href") === "#" + destinations[e.target.id]) a.setAttribute("aria-current","location"); else a.removeAttribute("aria-current"); });
      });
    }, {rootMargin:"-15% 0px -65% 0px"});
    Object.keys(destinations).forEach(id => observer.observe($("#" + id)));
    new IntersectionObserver(entries => entries.forEach(e => { $("#back-to-top").hidden = e.isIntersecting || e.boundingClientRect.bottom > 0; })).observe($("#home"));
    if (!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
      const reveal = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { if (e.target.animate) e.target.animate([{opacity:.4,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'}],{duration:260,easing:'ease-out'}); reveal.unobserve(e.target); } }),{threshold:0.2});
      $$('.lead-list li').forEach(node => reveal.observe(node));
    }
  }
  function editorPanel(open) {
    $("#editor-panel").hidden = !open; $("#edit-launch").setAttribute("aria-expanded", String(open));
    if (open) $("#edit-toggle").focus(); else { setEditing(false); $("#edit-launch").focus(); }
  }
  $("#edit-launch").addEventListener("click", () => editorPanel($("#editor-panel").hidden));
  $("#editor-close").addEventListener("click", () => editorPanel(false));
  $("#edit-toggle").addEventListener("click", () => setEditing(!editing));
  function validateImport(value) {
    if (!value || value.format !== "mei-portfolio-v7" || !value.edits || typeof value.edits !== "object" || Array.isArray(value.edits) || !value.images || typeof value.images !== "object" || Array.isArray(value.images)) throw new Error("Choose a portfolio backup exported from this version.");
    const clean = {edits:Object.create(null),images:Object.create(null)};
    const safeKey = key => /^[a-zA-Z0-9._-]{1,180}$/.test(key) && !["__proto__","constructor","prototype"].includes(key);
    Object.entries(value.edits).forEach(([key,text]) => { if (!safeKey(key) || typeof text !== "string" || text.length > 200000) throw new Error("The backup contains invalid text."); clean.edits[key] = safeRich(text); });
    Object.entries(value.images).forEach(([key,record]) => { if (!safeKey(key) || !validImage(record) || record.key !== key || record.data.length > 30 * 1024 * 1024) throw new Error("The backup contains an invalid image."); clean.images[key] = record; });
    return clean;
  }
  $("#export-edits").addEventListener("click", async () => {
    await imageReady;
    const backup = {format:"mei-portfolio-v7",exportedAt:new Date().toISOString(),edits,images};
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)],{type:"application/json"}));
    const a = document.createElement("a"); a.href = url; a.download = "MeiNguyen_Portfolio_Changes.json"; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    status("Backup exported. It includes your edited text, original-quality uploaded images and captions.");
  });
  $("#import-edits").addEventListener("click", () => $("#import-file").click());
  $("#import-file").addEventListener("change", async event => {
    const file = event.target.files[0]; if (!file) return;
    try {
      if (file.size > 150 * 1024 * 1024) throw new Error("Choose a backup smaller than 150 MB.");
      const clean = validateImport(JSON.parse(await file.text())); await imageReady;
      Object.assign(edits, clean.edits); Object.assign(images, clean.images);
      const saved = await Promise.all(Object.values(clean.images).map(record => persistImage(record)));
      saveText(); wireSlots(); wireText();
      status(saved.every(Boolean) ? "Backup imported. Your text, images and captions are restored in this browser." : "Backup imported for this session. Export before closing if browser storage is unavailable.");
      toast("Portfolio changes imported.");
    } catch (error) { status(error.message); toast(error.message); }
    event.target.value = "";
  });
  filterProjects("all"); renderMethods(); wireText(); wireSlots();
  imageReady.then(() => wireSlots());
  // Exposed pure logic supports non-browser verification and future source updates.
  window.PortfolioLogic = {safeRich,filteredIds,validateImport,caseHTML,filterProjects,selectMethod,openCase,openVideo,openImage,setMenu,setEditing,carouselState,moveCarousel,updateCarousel};
})();

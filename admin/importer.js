const DEFAULT_STATE = { animation: [], cad: [], prints: [], code: [] };

const $ = (sel) => document.querySelector(sel);
const catsEl = $("#cats");
const listEl = $("#list");
const addFilesEl = $("#addFiles");
const addFolderEl = $("#addFolder");
const addFolderWrap = $("#addFolderWrap");
const addEmptyBtn = $("#addEmpty");
const loadJsonEl = $("#loadJson");
const downloadBtn = $("#downloadJson");
const copyBtn = $("#copyJson");
const catTitleEl = $("#catTitle");
const catHintEl = $("#catHint");

let state = structuredClone(DEFAULT_STATE);
let currentCat = "animation";

function ensureKeys(obj) {
  const out = structuredClone(DEFAULT_STATE);
  for (const k of Object.keys(out)) out[k] = Array.isArray(obj?.[k]) ? obj[k] : [];
  return out;
}

function slugify(s) {
  return (s || "")
    .toLowerCase()
    .trim()
    .replace(/\.([a-z0-9]+)$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function titleize(s) {
  const clean = (s || "").replace(/[_-]+/g, " ").trim();
  return clean ? clean.replace(/\b\w/g, (c) => c.toUpperCase()) : "";
}

/**
 * Template:
 * slug__Title__tag1,tag2__2025__01
 * Returns: {slug,title,tags,year,seq}
 */
function parseTemplate(nameNoExt) {
  const parts = nameNoExt.split("__").map(p => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const slug = slugify(parts[0]);
    const title = parts[1] || titleize(parts[0]);
    const tags = (parts[2] || "")
      .split(",")
      .map(t => t.trim())
      .filter(Boolean);

    // try find 4-digit year anywhere after title
    const yearMatch = parts.slice(2).join(" ").match(/\b(19|20)\d{2}\b/);
    const year = yearMatch ? yearMatch[0] : "";

    // sequence (optional)
    const seqMatch = parts.slice(2).join(" ").match(/\b(\d{1,3})\b/);
    const seq = seqMatch ? seqMatch[1] : "";

    return { slug, title, tags, year, seq, hasTemplate: true };
  }

  // fallback: infer year at start like 2025-01-foo
  const yearStart = nameNoExt.match(/^(19|20)\d{2}/)?.[0] || "";
  const slug = slugify(nameNoExt.replace(/^(19|20)\d{2}[-_ ]*/, ""));
  return { slug: slug || slugify(nameNoExt), title: titleize(nameNoExt), tags: [], year: yearStart, seq: "", hasTemplate: false };
}

function mediaFromFile(file, category) {
  const name = file.name;
  const ext = name.split(".").pop().toLowerCase();

  if (["mp4", "webm", "mov"].includes(ext)) {
    return { type: "video", src: `../assets/${category}/${name}` };
  }
  if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) {
    return { type: "image", src: `../assets/${category}/${name}` };
  }
  if (["glb", "gltf", "stl"].includes(ext)) {
    return { type: "model", src: `../assets/${category}/${name}` };
  }
  // fallback: downloadable file
  return { type: "file", src: `../assets/${category}/${name}`, label: name };
}

function uniqueId(base, cat) {
  const existing = new Set(state[cat].map(p => p.id));
  let id = base || "project";
  let i = 2;
  while (existing.has(id)) {
    id = `${base}-${i++}`;
  }
  return id;
}

function addProjects(cat, projects) {
  state[cat].push(...projects);
  render();
}

function filesToProjects(cat, files) {
  const groups = new Map();

  for (const file of files) {
    const nameNoExt = file.name.replace(/\.[^/.]+$/, "");
    const t = parseTemplate(nameNoExt);
    const key = t.slug || slugify(nameNoExt);

    const entry = groups.get(key) || {
      idBase: key,
      title: t.title || titleize(key),
      tools: t.tags || [],
      year: t.year || "",
      items: [],
      previews: [],
      hasTemplate: t.hasTemplate
    };

    entry.items.push(mediaFromFile(file, cat));
    entry.previews.push(file);
    groups.set(key, entry);
  }

  const out = [];
  for (const [key, g] of groups.entries()) {
    const id = uniqueId(g.idBase, cat);

    const media = g.items.length === 1 ? g.items[0] : g.items;
    out.push({
      id,
      title: g.title || titleize(id),
      subtitle: "",
      year: g.year || "",
      tools: g.tools || [],
      description: "",
      links: [],
      media
    });
  }
  return out;
}

async function loadFromSiteIfPossible() {
  try {
    const res = await fetch("../data/projects.json", { cache: "no-store" });
    if (!res.ok) throw new Error("no projects.json");
    const json = await res.json();
    state = ensureKeys(json);
    render();
  } catch {
    // ignore; start empty
    render();
  }
}

function downloadJson() {
  const data = JSON.stringify(state, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "projects.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

async function copyJson() {
  const data = JSON.stringify(state, null, 2);
  await navigator.clipboard.writeText(data);
  copyBtn.textContent = "Copied!";
  setTimeout(() => (copyBtn.textContent = "Copy JSON"), 900);
}

function setCategory(cat) {
  currentCat = cat;
  catTitleEl.textContent = cat;
  const hints = {
    animation: "Recommended: MP4/WebM (pre-rendered).",
    cad: "GLB/GLTF preferred. STL supported.",
    prints: "PNG/JPG/WebP images (single or multiple; same slug groups into gallery).",
    code: "Upload a code folder to enable code viewer + embedded demo iframe."
  };
  catHintEl.textContent = hints[cat] || "";

  // File picker accept list depends on category
  const accepts = {
    animation: ".mp4,.webm,.mov",
    cad: ".glb,.gltf,.stl,.png,.jpg,.jpeg,.webp,.mp4,.webm",
    prints: ".png,.jpg,.jpeg,.webp,.gif",
    code: ".png,.jpg,.jpeg,.webp,.gif,.mp4,.webm,.glb,.gltf,.stl,.pdf"
  };
  addFilesEl.accept = accepts[cat] || "";

  // Folder import only for code
  addFolderWrap.style.display = cat === "code" ? "inline-flex" : "none";
  render();
}

function move(cat, idx, dir) {
  const arr = state[cat];
  const ni = idx + dir;
  if (ni < 0 || ni >= arr.length) return;
  [arr[idx], arr[ni]] = [arr[ni], arr[idx]];
  render();
}

function remove(cat, idx) {
  state[cat].splice(idx, 1);
  render();
}

function updateProject(cat, idx, patch) {
  state[cat][idx] = { ...state[cat][idx], ...patch };
  render(false);
}

function renderCats() {
  catsEl.innerHTML = "";
  for (const cat of Object.keys(DEFAULT_STATE)) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cat" + (cat === currentCat ? " active" : "");
    btn.innerHTML = `<span>${cat}</span><span class="badge">${state[cat].length}</span>`;
    btn.onclick = () => setCategory(cat);
    catsEl.appendChild(btn);
  }
}

function filePreviewEl(media, previewFile) {
  const box = document.createElement("div");
  box.className = "preview";

  if (media?.type === "image" && previewFile) {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(previewFile);
    img.onload = () => URL.revokeObjectURL(img.src);
    box.appendChild(img);
    return box;
  }

  if (media?.type === "video" && previewFile) {
    const v = document.createElement("video");
    v.src = URL.createObjectURL(previewFile);
    v.muted = true;
    v.loop = true;
    v.autoplay = true;
    v.playsInline = true;
    v.onloadeddata = () => URL.revokeObjectURL(v.src);
    box.appendChild(v);
    return box;
  }

  box.textContent = media?.type === "model" ? "3D model" : (media?.type || "preview");
  return box;
}

function renderList(full = true) {
  if (full) listEl.innerHTML = "";
  const arr = state[currentCat];

  if (!arr.length) {
    listEl.innerHTML = `<div class="muted" style="padding:18px;">No projects in <b>${currentCat}</b> yet. Use “Add files” or “Add empty project”.</div>`;
    return;
  }

  if (!full) return; // keeps focus stable when typing; we update state but not rebuild DOM

  arr.forEach((p, idx) => {
    const wrap = document.createElement("div");
    wrap.className = "item";

    const head = document.createElement("div");
    head.className = "item-head";

    const left = document.createElement("div");
    left.innerHTML = `
      <div class="item-title">${p.title || "(untitled)"}</div>
      <div class="item-sub">${p.id} · ${p.year || ""}</div>
    `;

    const actions = document.createElement("div");
    actions.className = "item-actions";
    actions.innerHTML = `
      <button class="btn ghost small" type="button" data-act="up">↑</button>
      <button class="btn ghost small" type="button" data-act="down">↓</button>
      <button class="btn ghost small" type="button" data-act="del">Delete</button>
    `;

    actions.querySelector('[data-act="up"]').onclick = () => move(currentCat, idx, -1);
    actions.querySelector('[data-act="down"]').onclick = () => move(currentCat, idx, +1);
    actions.querySelector('[data-act="del"]').onclick = () => remove(currentCat, idx);

    head.appendChild(left);
    head.appendChild(actions);

    const body = document.createElement("div");
    body.className = "item-body";

    const fields = document.createElement("div");
    fields.className = "fields";

    const toolsStr = Array.isArray(p.tools) ? p.tools.join(", ") : "";
    const media = Array.isArray(p.media) ? p.media[0] : (p.media || { type: "placeholder" });

    const isCodeDemo = (p.media && !Array.isArray(p.media) && p.media.type === "code-demo");

    fields.innerHTML = `
      <div class="field"><label>ID</label><input value="${p.id || ""}" data-k="id" /></div>
      <div class="field"><label>Title</label><input value="${p.title || ""}" data-k="title" /></div>
      <div class="field"><label>Subtitle</label><input value="${p.subtitle || ""}" data-k="subtitle" /></div>
      <div class="field"><label>Year</label><input value="${p.year || ""}" data-k="year" /></div>
      <div class="field"><label>Tools (comma separated)</label><input value="${toolsStr}" data-k="tools" /></div>
      <div class="field"><label>Description</label><textarea data-k="description">${p.description || ""}</textarea></div>
    `;

    // links editor (simple)
    const linksWrap = document.createElement("div");
    linksWrap.className = "field";
    linksWrap.innerHTML = `<label>Links</label><div class="links"></div><button class="btn ghost small" type="button">Add link</button>`;
    const linksList = linksWrap.querySelector(".links");
    const addLinkBtn = linksWrap.querySelector("button");

    function renderLinks() {
      linksList.innerHTML = "";
      (p.links || []).forEach((l, li) => {
        const row = document.createElement("div");
        row.className = "linkrow";
        row.innerHTML = `
          <input placeholder="Label" value="${l.label || ""}" />
          <input placeholder="URL" value="${l.url || ""}" />
          <button class="btn ghost small" type="button">✕</button>
        `;
        const [lab, url, del] = row.querySelectorAll("input,button");
        lab.oninput = () => { p.links[li].label = lab.value; };
        url.oninput = () => { p.links[li].url = url.value; };
        del.onclick = () => { p.links.splice(li, 1); render(); };
        linksList.appendChild(row);
      });
    }

    addLinkBtn.onclick = () => {
      p.links = p.links || [];
      p.links.push({ label: "", url: "" });
      render();
    };

    renderLinks();
    fields.appendChild(linksWrap);

    // Code demo extras
    if (isCodeDemo) {
      const cd = p.media;
      const extra = document.createElement("div");
      extra.className = "field";
      const htmlFiles = (cd.files || []).filter(f => f.toLowerCase().endsWith(".html"));
      extra.innerHTML = `
        <label>Code demo settings</label>
        <div class="muted" style="margin-bottom:8px;">Copy your folder to: <code>assets/code/${p.id}/</code></div>
        <div style="display:grid;gap:8px;">
          <div>
            <div class="muted" style="font-size:12px;margin-bottom:6px;">Demo entry (iframe)</div>
            <select data-k="demoEntry"></select>
          </div>
          <div class="muted" style="font-size:12px;">codeRoot: <code>${cd.codeRoot || ""}</code></div>
        </div>
      `;
      const sel = extra.querySelector("select");
      const current = (cd.demo || "").split("/").pop();
      const opts = htmlFiles.length ? htmlFiles : (current ? [current] : []);
      sel.innerHTML = opts.map(f => `<option ${f === current ? "selected": ""}>${f}</option>`).join("");
      sel.onchange = () => {
        const entry = sel.value;
        cd.demo = `${cd.codeRoot}${entry}`;
        render();
      };
      fields.appendChild(extra);
    }

    // Preview panel
    const preview = document.createElement("div");
    const previewFile = null; // not persisted after initial add; preview uses type label later
    preview.appendChild(filePreviewEl(media, previewFile));

    const kv = document.createElement("div");
    kv.className = "kv";
    kv.innerHTML = `
      <div><b>Media type:</b> ${Array.isArray(p.media) ? "gallery" : (p.media?.type || "placeholder")}</div>
      <div><b>Path:</b> <code>${Array.isArray(p.media) ? (p.media[0]?.src || "") : (p.media?.src || p.media?.demo || "")}</code></div>
    `;
    preview.appendChild(kv);

    // Bind inputs
    fields.querySelectorAll("input[data-k], textarea[data-k]").forEach((inp) => {
      inp.addEventListener("input", () => {
        const k = inp.dataset.k;
        if (k === "tools") {
          p.tools = inp.value.split(",").map(s => s.trim()).filter(Boolean);
        } else {
          p[k] = inp.value;
        }
        // keep state object stable; avoid full rerender while typing
      });
    });

    body.appendChild(fields);
    body.appendChild(preview);

    wrap.appendChild(head);
    wrap.appendChild(body);
    listEl.appendChild(wrap);
  });
}

function render(full = true) {
  renderCats();
  renderList(full);
}

addFilesEl.addEventListener("change", () => {
  const files = Array.from(addFilesEl.files || []);
  if (!files.length) return;

  const projects = filesToProjects(currentCat, files);
  addProjects(currentCat, projects);

  addFilesEl.value = "";
});

addFolderEl.addEventListener("change", () => {
  const files = Array.from(addFolderEl.files || []);
  if (!files.length) return;

  // determine root folder name from webkitRelativePath
  const first = files[0].webkitRelativePath || files[0].name;
  const root = first.split("/")[0] || "code-project";
  const idBase = slugify(root);
  const id = uniqueId(idBase, "code");

  // collect relative paths
  const rel = files.map(f => (f.webkitRelativePath || f.name).split("/").slice(1).join("/")).filter(Boolean);

  // choose entry
  const entry = rel.includes("index.html") ? "index.html" : (rel.find(p => p.toLowerCase().endsWith(".html")) || "");
  const codeFiles = rel.filter(p => /\.(js|ts|jsx|tsx|html|css|json|md|py|txt|glsl)$/i.test(p));

  addProjects("code", [{
    id,
    title: titleize(root),
    subtitle: "Code demo",
    year: "",
    tools: [],
    description: "",
    links: [],
    media: {
      type: "code-demo",
      codeRoot: `../assets/code/${id}/`,
      demo: entry ? `../assets/code/${id}/${entry}` : "",
      files: codeFiles
    }
  }]);

  addFolderEl.value = "";
});

addEmptyBtn.addEventListener("click", () => {
  const id = uniqueId("new-project", currentCat);
  addProjects(currentCat, [{
    id,
    title: "New project",
    subtitle: "",
    year: "",
    tools: [],
    description: "",
    links: [],
    media: { type: "placeholder" }
  }]);
});

loadJsonEl.addEventListener("change", async () => {
  const f = loadJsonEl.files?.[0];
  if (!f) return;
  const text = await f.text();
  const json = JSON.parse(text);
  state = ensureKeys(json);
  render();
  loadJsonEl.value = "";
});

downloadBtn.addEventListener("click", downloadJson);
copyBtn.addEventListener("click", copyJson);

// Init
setCategory(currentCat);
loadFromSiteIfPossible();
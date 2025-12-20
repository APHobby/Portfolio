/**
 * Renders project cards by category and opens a modal on click.
 * Written to be beginner-friendly with clear function responsibilities.
 */

const byId = (id) => document.getElementById(id);

const grids = {
  animation: byId("grid-animation"),
  modeling: byId("grid-modeling"),
  printing: byId("grid-printing"),
  coding: byId("grid-coding"),
};

const modal = byId("modal");
const modalMedia = byId("modal-media");
const modalTitle = byId("modal-title");
const modalDesc = byId("modal-desc");
const modalTags = byId("modal-tags");
const modalLinks = byId("modal-links");

/** Create an element with optional class + text */
function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text) n.textContent = text;
  return n;
}

/** Converts normal YouTube/Vimeo URLs to embed URLs */
function toEmbedUrl(type, url) {
  if (type === "youtube") {
    // Works with watch?v= or youtu.be links
    const idMatch = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
    const id = idMatch ? idMatch[1] : "";
    return id ? `https://www.youtube.com/embed/${id}` : url;
  }
  if (type === "vimeo") {
    const idMatch = url.match(/vimeo\.com\/(\d+)/);
    const id = idMatch ? idMatch[1] : "";
    return id ? `https://player.vimeo.com/video/${id}` : url;
  }
  return url;
}

/** Build a card thumbnail node (image or text) */
function buildThumb(thumb) {
  const t = el("div", "thumb");

  if (!thumb || thumb.type === "text") {
    t.textContent = thumb?.text || "PROJECT";
    return t;
  }

  if (thumb.type === "image") {
    const img = document.createElement("img");
    img.src = thumb.src;
    img.alt = "Project thumbnail";
    t.appendChild(img);
    return t;
  }

  t.textContent = "PROJECT";
  return t;
}

/** Render all cards into their category grids */
function renderAll() {
  // Clear grids
  Object.values(grids).forEach(g => g.innerHTML = "");

  for (const p of window.PROJECTS) {
    const card = el("article", "card");
    card.tabIndex = 0;

    const thumb = buildThumb(p.thumb);

    const body = el("div", "card-body");
    body.appendChild(el("h3", "card-title", p.title));
    body.appendChild(el("p", "card-desc", p.description));

    const chips = el("div", "chips");
    for (const tag of (p.tags || [])) chips.appendChild(el("span", "chip", tag));
    body.appendChild(chips);

    card.appendChild(thumb);
    card.appendChild(body);

    // Open modal on click or Enter key
    card.addEventListener("click", () => openModal(p));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter") openModal(p);
    });

    grids[p.category]?.appendChild(card);
  }
}

/** Build the modal media block based on project.media */
function renderModalMedia(media) {
  modalMedia.innerHTML = "";

  if (!media) return;

  if (media.type === "image") {
    const img = document.createElement("img");
    img.src = media.src;
    img.alt = "Project media";
    modalMedia.appendChild(img);
    return;
  }

  if (media.type === "video") {
    const video = document.createElement("video");
    video.src = media.src;
    video.controls = true;
    video.playsInline = true;
    modalMedia.appendChild(video);
    return;
  }

  if (media.type === "iframe") {
    const iframe = document.createElement("iframe");
    iframe.src = media.url;
    iframe.allow = "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture";
    iframe.referrerPolicy = "no-referrer";
    modalMedia.appendChild(iframe);
    return;
  }

  if (media.type === "youtube" || media.type === "vimeo") {
    const iframe = document.createElement("iframe");
    iframe.src = toEmbedUrl(media.type, media.url);
    iframe.allow = "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture";
    iframe.allowFullscreen = true;
    modalMedia.appendChild(iframe);
    return;
  }
}

/** Open modal and fill it with project info */
function openModal(project) {
  modalTitle.textContent = project.title;
  modalDesc.textContent = project.description;

  modalTags.innerHTML = "";
  for (const tag of (project.tags || [])) modalTags.appendChild(el("span", "chip", tag));

  modalLinks.innerHTML = "";
  for (const l of (project.links || [])) {
    const a = el("a", "pill-link", l.label);
    a.href = l.url;
    a.target = "_blank";
    a.rel = "noopener";
    modalLinks.appendChild(a);
  }

  renderModalMedia(project.media);

  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
}

/** Close modal */
function closeModal() {
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  modalMedia.innerHTML = "";
}

/** Close when clicking backdrop/close button */
modal.addEventListener("click", (e) => {
  const target = e.target;
  if (target && target.dataset && target.dataset.close === "true") closeModal();
});

/** Close on ESC */
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

/** Highlight active tab while scrolling (simple + clean) */
function setupActiveTabs() {
  const tabs = document.querySelectorAll(".tab");
  const sections = ["animation","modeling","printing","coding","about"].map(id => byId(id));

  const io = new IntersectionObserver((entries) => {
    // Find the most visible section in view
    const visible = entries
      .filter(e => e.isIntersecting)
      .sort((a,b) => b.intersectionRatio - a.intersectionRatio)[0];

    if (!visible) return;

    const id = visible.target.id;
    tabs.forEach(t => t.classList.toggle("is-active", t.dataset.tab === id));
  }, { rootMargin: "-30% 0px -60% 0px", threshold: [0.1, 0.2, 0.35, 0.5] });

  sections.forEach(s => s && io.observe(s));
}

byId("year").textContent = new Date().getFullYear();

renderAll();
setupActiveTabs();

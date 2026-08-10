// index.js
// Page-glue for public/index.html. Read-only: browsing only, no writes.
// Registration itself happens on event-details.html once that page exists.

import { getAllEvents } from "./events.js";
import { watchAuthState } from "./auth.js";

const catalogList = document.getElementById("catalog-list");
const searchInput = document.getElementById("search-input");
const categoryFilter = document.getElementById("category-filter");
const headerActions = document.getElementById("header-actions");

let allEvents = [];

function statusPill(status) {
  return `<span class="status ${status}"><span class="dot"></span>${status}</span>`;
}

function capacityInline(registered, capacity) {
  const pct = capacity > 0 ? Math.min(100, Math.round((registered / capacity) * 100)) : 0;
  const highClass = pct >= 90 ? " high" : "";
  return `
    <span class="progress-inline">
      <span class="capacity-bar"><span class="capacity-fill${highClass}" style="width:${pct}%"></span></span>
      <span class="mono">${registered}/${capacity}</span>
    </span>
  `;
}

function pagePathFor(path) {
  return window.location.pathname.includes("/public/") ? `../${path}` : path;
}

function renderCatalog(events) {
  if (events.length === 0) {
    catalogList.innerHTML = `<div class="empty-row"><span>No events match your search.</span></div>`;
    return;
  }

  catalogList.innerHTML = events.map((ev) => `
    <div class="event-card">
      <div class="event-thumb"></div>
      <div class="event-card-body">
        <div class="event-title">${ev.title}</div>
        <div class="event-card-meta">
          <span class="mono">${ev.category}</span>
          <span>${ev.startDate}</span>
          ${capacityInline(ev.registeredCount || 0, ev.capacity)}
          ${statusPill(ev.status)}
        </div>
        ${ev.description ? `<div class="note" style="margin-top:8px;">${ev.description}</div>` : ""}
      </div>
      <div class="event-card-actions">
        <a href="${pagePathFor("pages/event-details.html")}?id=${ev.id}"><button class="btn small primary">View details</button></a>
      </div>
    </div>
  `).join("");
}

function applyFilters() {
  const search = searchInput.value.trim().toLowerCase();
  const category = categoryFilter.value;

  const filtered = allEvents.filter((ev) => {
    const matchesSearch = ev.title.toLowerCase().includes(search);
    const matchesCategory = category === "all" || ev.category === category;
    return matchesSearch && matchesCategory;
  });

  renderCatalog(filtered);
}

async function loadCatalog() {
  const result = await getAllEvents();
  if (result.success) {
    allEvents = result.events;
    applyFilters();
  } else {
    catalogList.innerHTML = `<div class="empty-row"><span>Couldn't load events: ${result.error}</span></div>`;
  }
}

searchInput.addEventListener("input", applyFilters);
categoryFilter.addEventListener("change", applyFilters);

/**
 * Swap the header buttons depending on whether someone's logged in.
 * Anonymous visitors see Log in / Register; logged-in users see a
 * shortcut back to their own dashboard.
 */
function dashboardPathFor(role) {
  if (role === "admin") return pagePathFor("pages/admin-dashboard.html");
  if (role === "organizer") return pagePathFor("pages/organizer-dashboard.html");
  return pagePathFor("pages/participant-dashboard.html");
}

watchAuthState((user, role) => {
  const loginHref = pagePathFor("pages/login.html");
  const registerHref = pagePathFor("pages/register.html");

  if (user) {
    headerActions.innerHTML = `
      <span class="user-chip">${user.email}</span>
      <a href="${dashboardPathFor(role)}"><button class="btn primary">Go to dashboard</button></a>
    `;
  } else {
    headerActions.innerHTML = `
      <a href="${loginHref}"><button class="btn">Log in</button></a>
      <a href="${registerHref}"><button class="btn primary">Register</button></a>
    `;
  }
});

loadCatalog();
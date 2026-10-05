// Post-it notes in an auto-arranging grid. Stored only on this device (chrome.storage.local),
// one key per note so open tabs can't clobber each other.

import { icons } from './icons.js';
import { storage } from './storage.js';

export const PREFIX = 'note:';
export const GROUP_KEY = 'notesGroupByColor';
export const COLORS = ['yellow', 'green', 'pink'];
const COLOR_NAMES = { yellow: 'Yellow', green: 'Green', pink: 'Pink' };
// Colors from the earlier five-color palette.
const LEGACY_COLORS = { blue: 'green', purple: 'pink' };

export function createNote({ order = Date.now(), color = COLORS[0], id = crypto.randomUUID() } = {}) {
  return { id, text: '', color, order, createdAt: Date.now() };
}

/** Brings stored notes up to the current shape: three colors, and an `order` instead of x/y. */
export function normalizeNote(note) {
  const color = COLORS.includes(note.color) ? note.color : (LEGACY_COLORS[note.color] ?? COLORS[0]);
  const { x, y, z, ...rest } = note;
  return { ...rest, color, order: note.order ?? note.createdAt ?? 0 };
}

/** Display order: by `order` (creation time unless dragged), optionally grouped by color first. */
export function sortNotes(notes, groupByColor) {
  return [...notes].sort((a, b) => {
    if (groupByColor && a.color !== b.color) return COLORS.indexOf(a.color) - COLORS.indexOf(b.color);
    return a.order - b.order || a.createdAt - b.createdAt;
  });
}

/** An order value between two neighbours (either may be missing). */
export function orderBetween(before, after) {
  if (before == null && after == null) return Date.now();
  if (before == null) return after - 1000;
  if (after == null) return before + 1000;
  return (before + after) / 2;
}

// ---- Widget ---------------------------------------------------------------------------------

export async function mountNotes(root) {
  const notes = new Map((await storage.getAll(PREFIX)).filter(Boolean).map((n) => [n.id, normalizeNote(n)]));
  let groupByColor = Boolean(await storage.get(GROUP_KEY));

  root.innerHTML = `
    <header class="card-header notes-header">
      <h2>Notes</h2>
      <div class="notes-actions">
        <button type="button" class="pill-button notes-group-toggle" aria-pressed="false" title="Group by color">Group</button>
        <button type="button" class="pill-button" data-action="add">${icons.plus} New note</button>
      </div>
    </header>
    <div class="notes-board" aria-label="Notes"></div>
    <p class="notes-empty muted"><span>Click <strong>New note</strong> to add one.</span></p>
    <div class="toast" role="status" hidden><span></span><button type="button" class="pill-button" data-action="undo">Undo</button></div>
  `;

  const board = root.querySelector('.notes-board');
  const empty = root.querySelector('.notes-empty');
  const toast = root.querySelector('.toast');
  const groupToggle = root.querySelector('.notes-group-toggle');
  const elements = new Map();
  const labels = new Map(
    COLORS.map((color) => {
      const label = document.createElement('h3');
      label.className = 'notes-group-label';
      label.dataset.color = color;
      return [color, label];
    }),
  );
  const saveTimers = new Map();
  let dragging = null;

  function save(note) {
    notes.set(note.id, note);
    return storage.set(PREFIX + note.id, note);
  }

  function saveSoon(note) {
    clearTimeout(saveTimers.get(note.id));
    saveTimers.set(note.id, setTimeout(() => save(note), 300));
  }

  function elementFor(note) {
    let el = elements.get(note.id);
    if (!el) {
      el = document.createElement('article');
      el.className = 'note';
      el.dataset.id = note.id;
      el.innerHTML = `
        <div class="note-bar" title="Drag to move">
          <div class="note-colors">
            ${COLORS.map((c) => `<button type="button" class="note-color" data-color="${c}" aria-label="${COLOR_NAMES[c]}"></button>`).join('')}
          </div>
          <button type="button" class="note-delete" aria-label="Delete note">${icons.close}</button>
        </div>
        <textarea class="note-text" aria-label="Note text" placeholder="Write something…" spellcheck="true"></textarea>
      `;
      elements.set(note.id, el);
    }
    el.dataset.color = note.color;
    const textarea = el.querySelector('textarea');
    if (document.activeElement !== textarea && textarea.value !== note.text) textarea.value = note.text;
    return el;
  }

  /** Records positions, runs `change`, then animates every note from its old spot to its new one. */
  function flip(change) {
    const before = new Map([...elements].map(([id, el]) => [id, el.getBoundingClientRect()]));
    change();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    for (const [id, el] of elements) {
      const old = before.get(id);
      if (!old) continue;
      const now = el.getBoundingClientRect();
      const dx = old.left - now.left;
      const dy = old.top - now.top;
      if (dx || dy) el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 180, easing: 'ease-out' });
    }
  }

  /** Puts the board's children in display order, moving only what's out of place (so focus survives). */
  function layout({ animate = true } = {}) {
    const run = () => {
      const sorted = sortNotes(notes.values(), groupByColor);
      const desired = [];
      for (const note of sorted) {
        const label = labels.get(note.color);
        if (groupByColor && !desired.includes(label)) {
          label.textContent = `${COLOR_NAMES[note.color]} · ${sorted.filter((n) => n.color === note.color).length}`;
          desired.push(label);
        }
        desired.push(elementFor(note));
      }
      desired.forEach((node, i) => {
        if (board.children[i] !== node) board.insertBefore(node, board.children[i] ?? null);
      });
      while (board.children.length > desired.length) board.lastElementChild.remove();
      for (const [id, el] of elements) if (!notes.has(id)) elements.delete(id) && el.remove();
      empty.hidden = notes.size > 0;
      board.hidden = notes.size === 0;
      groupToggle.setAttribute('aria-pressed', String(groupByColor));
    };
    animate ? flip(run) : run();
  }

  function add() {
    const all = [...notes.values()];
    const order = all.length ? Math.max(...all.map((n) => n.order)) + 1000 : Date.now();
    const note = createNote({ order });
    save(note);
    layout();
    elements.get(note.id).querySelector('textarea').focus();
  }

  let undoNote = null;
  let toastTimer;

  function remove(note) {
    clearTimeout(saveTimers.get(note.id));
    notes.delete(note.id);
    storage.remove(PREFIX + note.id);
    layout();

    if (!note.text.trim()) return; // nothing worth undoing
    undoNote = note;
    toast.querySelector('span').textContent = 'Note deleted';
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast.hidden = true), 6000);
  }

  root.querySelector('[data-action="add"]').addEventListener('click', add);

  groupToggle.addEventListener('click', () => {
    groupByColor = !groupByColor;
    storage.set(GROUP_KEY, groupByColor);
    layout();
  });

  toast.querySelector('[data-action="undo"]').addEventListener('click', () => {
    if (!undoNote) return;
    save(undoNote);
    undoNote = null;
    toast.hidden = true;
    layout();
  });

  // Edit text
  board.addEventListener('input', (event) => {
    const note = notes.get(event.target.closest('.note')?.dataset.id);
    if (!note) return;
    note.text = event.target.value;
    saveSoon(note);
  });
  board.addEventListener('focusout', (event) => {
    const note = notes.get(event.target.closest('.note')?.dataset.id);
    if (note && event.target.matches('textarea')) {
      clearTimeout(saveTimers.get(note.id));
      save(note);
    }
  });

  // Color and delete
  board.addEventListener('click', (event) => {
    const note = notes.get(event.target.closest('.note')?.dataset.id);
    if (!note) return;
    const color = event.target.closest('.note-color')?.dataset.color;
    if (color && color !== note.color) {
      note.color = color;
      save(note);
      layout();
    } else if (event.target.closest('.note-delete')) {
      remove(note);
    }
  });

  // ---- Drag to rearrange ----------------------------------------------------------------------
  // The note itself stays in the grid as a faded "ghost" that moves to show where it will land,
  // while a lifted copy follows the pointer. The copy lives on <body>: the card's backdrop-filter
  // makes it the containing block for position: fixed, which would offset anything inside it.

  board.addEventListener('pointerdown', (event) => {
    const el = event.target.closest('.note');
    if (!el || !event.target.closest('.note-bar') || event.target.closest('button') || event.button !== 0) return;
    event.preventDefault();
    const start = { x: event.clientX, y: event.clientY };
    let started = false;

    const begin = () => {
      started = true;
      const rect = el.getBoundingClientRect();
      const preview = el.cloneNode(true);
      preview.querySelector('textarea').value = el.querySelector('textarea').value;
      preview.classList.add('note-drag-preview');
      preview.setAttribute('aria-hidden', 'true');
      Object.assign(preview.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
      document.body.append(preview);
      el.classList.add('is-ghost');
      dragging = { el, preview, offset: { x: start.x - rect.left, y: start.y - rect.top } };
    };

    // Moves the ghost to wherever the pointer is over the grid.
    const hitTest = ({ x, y }) => {
      const ghost = dragging.el;
      const target = document.elementFromPoint(x, y)?.closest('.note, .notes-group-label');
      if (!target || target === ghost || !board.contains(target)) return;
      if (target.matches('.notes-group-label')) {
        if (target.nextElementSibling !== ghost) flip(() => target.after(ghost));
        return;
      }
      const r = target.getBoundingClientRect();
      const ref = x > r.left + r.width / 2 ? target.nextElementSibling : target;
      if (ref !== ghost && ref?.previousElementSibling !== ghost) {
        flip(() => board.insertBefore(ghost, ref));
      }
    };

    // Scrolls the page while the pointer is near the top or bottom edge, so far-away slots are reachable.
    let pointer = start;
    let scrollFrame;
    const autoScroll = () => {
      const edge = 80;
      const speed = 20;
      let dy = 0;
      if (pointer.y > innerHeight - edge) dy = Math.ceil(((pointer.y - (innerHeight - edge)) / edge) * speed);
      else if (pointer.y < edge) dy = -Math.ceil(((edge - pointer.y) / edge) * speed);
      if (dy) {
        const before = scrollY;
        scrollBy(0, dy);
        if (scrollY !== before) hitTest(pointer);
      }
      scrollFrame = requestAnimationFrame(autoScroll);
    };

    const move = (e) => {
      if (!started) {
        if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < 4) return;
        begin();
        scrollFrame = requestAnimationFrame(autoScroll);
      }
      pointer = { x: e.clientX, y: e.clientY };
      dragging.preview.style.left = `${e.clientX - dragging.offset.x}px`;
      dragging.preview.style.top = `${e.clientY - dragging.offset.y}px`;
      hitTest(pointer);
    };

    const end = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', end);
      document.removeEventListener('pointercancel', end);
      cancelAnimationFrame(scrollFrame);
      if (!started) return;
      const { el: ghost, preview } = dragging;
      const note = notes.get(ghost.dataset.id);

      // Neighbours within the same section (labels separate color groups).
      const neighbour = (step) => {
        for (let n = ghost[step]; n; n = n[step]) {
          if (n.matches('.notes-group-label')) return null;
          if (n.matches('.note')) return notes.get(n.dataset.id);
        }
        return null;
      };
      note.order = orderBetween(neighbour('previousElementSibling')?.order, neighbour('nextElementSibling')?.order);

      // Dropping into another color's section recolors the note.
      if (groupByColor) {
        let section = null;
        for (let n = ghost.previousElementSibling; n && !section; n = n.previousElementSibling) {
          if (n.matches('.notes-group-label')) section = n.dataset.color;
        }
        if (section && section !== note.color) note.color = section;
      }

      dragging = null;
      save(note);
      layout();

      // Glide the lifted copy into the ghost's slot, then swap back to the real note.
      const from = preview.getBoundingClientRect();
      const to = ghost.getBoundingClientRect();
      preview.dataset.color = note.color;
      const settle = () => {
        preview.remove();
        ghost.classList.remove('is-ghost');
      };
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return settle();
      preview
        .animate(
          [
            { translate: '0 0', rotate: '-2deg' },
            { translate: `${to.left - from.left}px ${to.top - from.top}px`, rotate: '0deg' },
          ],
          { duration: 180, easing: 'ease-out', fill: 'forwards' },
        )
        .finished.then(settle, settle);
    };

    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', end);
    document.addEventListener('pointercancel', end);
  });

  // Changes made in other open tabs.
  storage.onChange((key, value) => {
    if (key === GROUP_KEY) {
      groupByColor = Boolean(value);
      if (!dragging) layout();
      return;
    }
    if (!key.startsWith(PREFIX)) return;
    const id = key.slice(PREFIX.length);
    if (value === undefined) notes.delete(id);
    else {
      const local = notes.get(id);
      const editing = local && elements.get(id)?.querySelector('textarea') === document.activeElement;
      notes.set(id, editing ? { ...normalizeNote(value), text: local.text } : normalizeNote(value));
    }
    if (!dragging) layout();
  });

  layout({ animate: false });
}

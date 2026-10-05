import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLocalBackend } from '../extension/src/storage.js';
import { COLORS, createNote, normalizeNote, orderBetween, sortNotes } from '../extension/src/notes.js';

const note = (id, color, order, createdAt = order) => ({ id, text: id, color, order, createdAt });

test('three colors', () => {
  assert.deepEqual(COLORS, ['yellow', 'green', 'pink']);
  assert.equal(createNote().color, 'yellow');
});

test('normalizes notes from the free-placement version', () => {
  const old = { id: 'a', text: 'hi', color: 'blue', x: 40, y: 80, z: 3, createdAt: 123 };
  assert.deepEqual(normalizeNote(old), { id: 'a', text: 'hi', color: 'green', order: 123, createdAt: 123 });
  assert.equal(normalizeNote({ ...old, color: 'purple' }).color, 'pink');
  assert.equal(normalizeNote({ ...old, color: 'mystery' }).color, 'yellow');
  assert.equal(normalizeNote({ ...old, color: 'pink', order: 5 }).order, 5);
});

test('ungrouped: creation order, overridden by dragged order', () => {
  const notes = [note('c', 'pink', 3), note('a', 'yellow', 1), note('b', 'green', 2)];
  assert.deepEqual(sortNotes(notes, false).map((n) => n.id), ['a', 'b', 'c']);
  const dragged = { ...notes[0], order: orderBetween(undefined, 1) }; // dragged to the front
  assert.deepEqual(sortNotes([dragged, notes[1], notes[2]], false).map((n) => n.id), ['c', 'a', 'b']);
});

test('grouped: yellow, green, pink; ordered within each group', () => {
  const notes = [note('p1', 'pink', 1), note('y2', 'yellow', 4), note('g1', 'green', 2), note('y1', 'yellow', 3), note('p2', 'pink', 5)];
  assert.deepEqual(sortNotes(notes, true).map((n) => n.id), ['y1', 'y2', 'g1', 'p1', 'p2']);
});

test('sort ties fall back to creation time', () => {
  const notes = [note('b', 'yellow', 1, 20), note('a', 'yellow', 1, 10)];
  assert.deepEqual(sortNotes(notes, false).map((n) => n.id), ['a', 'b']);
});

test('orderBetween', () => {
  assert.equal(orderBetween(10, 20), 15);
  assert.equal(orderBetween(10, undefined), 1010);
  assert.equal(orderBetween(undefined, 10), -990);
  assert.equal(typeof orderBetween(undefined, undefined), 'number');
});

test('local storage backend round-trips and filters by prefix', async () => {
  const map = new Map();
  const fake = {
    get length() { return map.size; },
    key: (i) => [...map.keys()][i],
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
  const store = createLocalBackend(fake, {});
  const n = createNote();
  await store.set(`note:${n.id}`, n);
  await store.set('clockSettings', { showSeconds: true });
  assert.deepEqual(await store.get(`note:${n.id}`), n);
  assert.deepEqual(await store.getAll('note:'), [n]);
  await store.remove(`note:${n.id}`);
  assert.deepEqual(await store.getAll('note:'), []);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBrowserSaves } from '../src/game/store/browserSaves.ts';

function storage() {
  const data = new Map();
  return {
    get length() { return data.size; },
    key: i => [...data.keys()][i] ?? null,
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: key => data.delete(key),
  };
}

test('separate browsers cannot list, load or delete each other’s saves', () => {
  const firstStorage = storage();
  const a = createBrowserSaves(() => firstStorage);
  const b = createBrowserSaves(() => storage());
  const state = { board: { '0,0': { id: 'city_edge' } }, deck: ['church'], scores: [4, 8] };
  const id = a.save('multi', state, 'Game');
  assert.deepEqual(b.list('multi'), []);
  assert.equal(b.load('multi', id), null);
  b.delete('multi', id);
  assert.deepEqual(a.load('multi', id).state, state);
  assert.deepEqual(createBrowserSaves(() => firstStorage).load('multi', id).state, state);
  assert.equal(a.list('multi')[0].label, 'Game');
});

test('modes and individual save keys stay isolated', () => {
  const local = storage();
  const a = createBrowserSaves(() => local);
  const otherTab = createBrowserSaves(() => local);
  const id = a.save('solo', { score: 10 }, 'Solo');
  const second = otherTab.save('solo', { score: 20 }, 'Second');
  a.save('multi', { scores: [2, 4] });
  assert.equal(a.list('solo').length, 2);
  assert.equal(a.list('multi').length, 1);
  assert.equal(a.load('multi', id), null);
  a.delete('multi', id);
  assert.ok(a.load('solo', id));
  a.delete('solo', id);
  assert.equal(a.load('solo', id), null);
  assert.ok(a.load('solo', second));
});

test('corrupt entries do not hide valid saves; write failures propagate', () => {
  const local = storage();
  const saves = createBrowserSaves(() => local);
  const id = saves.save('solo', { board: {} });
  local.setItem('carcassonne.saves.v2.solo.broken', '{');
  assert.equal(saves.list('solo').length, 1);
  assert.ok(saves.load('solo', id));
  local.setItem = () => { throw new Error('Quota exceeded'); };
  assert.throws(() => saves.save('solo', {}), /Quota exceeded/);
  assert.ok(saves.load('solo', id));
  assert.throws(() => createBrowserSaves(() => { throw new Error('Storage blocked'); }).list('solo'), /Storage blocked/);
});

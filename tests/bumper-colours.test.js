import test from 'node:test';
import assert from 'node:assert/strict';
import { bumperRingColours, BUMPER_COLOUR_DURATION } from '../src/game/bumper-colours.js';

test('bumper rings rapidly reach gold, briefly peak crimson, and recover to the exact idle emerald at 700ms', () => {
  const idle = { ring: 0x437f67, outer: 0xb5edbb, inner: 0x70bd91 };
  assert.equal(BUMPER_COLOUR_DURATION, 700);
  assert.deepEqual(bumperRingColours(-1), idle);
  assert.deepEqual(bumperRingColours(0), idle);
  assert.equal(bumperRingColours(90).ring, 0xffd166);
  assert.equal(bumperRingColours(140).ring, 0xffd166);
  assert.equal(bumperRingColours(220).ring, 0xd85a58);
  assert.equal(bumperRingColours(260).ring, 0xd85a58);
  assert.notDeepEqual(bumperRingColours(500), idle);
  assert.deepEqual(bumperRingColours(700), idle);
  assert.deepEqual(bumperRingColours(10000), idle, 'no looping');
});

test('CALM is one restrained brass tint and return, with no crimson phase', () => {
  const idle = bumperRingColours(-1);
  for (const at of [140, 240, 399]) assert.equal(bumperRingColours(at, true).ring, 0xb09d65);
  for (let at = 0; at <= 700; at++) {
    const c = bumperRingColours(at, true).ring;
    assert.notEqual(c, 0xd85a58);
    assert.ok(Math.abs(((c >> 16) & 255) - ((c >> 8) & 255)) < 65, 'no saturated red');
  }
  assert.deepEqual(bumperRingColours(700, true), idle);
});

test('colour stages have continuous boundaries and no white/black blink', () => {
  for (const calm of [false, true]) {
    let previous = bumperRingColours(0, calm);
    for (let age = 1; age <= 701; age++) {
      const current = bumperRingColours(age, calm);
      for (const key of ['ring', 'outer', 'inner']) for (const shift of [0, 8, 16]) {
        assert.ok(Math.abs(((current[key] >> shift) & 255) - ((previous[key] >> shift) & 255)) <= 5);
      }
      assert.notEqual(current.ring, 0xffffff); assert.notEqual(current.ring, 0);
      previous = current;
    }
  }
});

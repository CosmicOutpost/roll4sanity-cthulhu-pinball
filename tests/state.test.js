import test from 'node:test';
import assert from 'node:assert/strict';
import { GameState } from '../src/game/state.js';

test('three balls, scoring, game over, and clean restart', () => {
  const state = new GameState();
  assert.equal(state.addScore(100, 'bumper'), false);
  for (let ball = 1; ball <= 3; ball++) {
    assert.equal(state.ballNumber, ball);
    assert.equal(state.launch(), true);
    assert.equal(state.launch(), false);
    assert.equal(state.addScore(100, 'bumper'), true);
    assert.equal(state.drain(), true);
    assert.equal(state.drain(), false);
  }
  assert.equal(state.phase, 'gameover');
  assert.equal(state.score, 300);
  assert.equal(state.launch(), false);
  assert.equal(state.addScore(500, 'late hit'), false);
  state.restart();
  assert.deepEqual({ score: state.score, ball: state.ballNumber, phase: state.phase, paused: state.paused }, { score: 0, ball: 1, phase: 'ready', paused: false });
});

test('pause prevents launching and scoring', () => {
  const state = new GameState();
  state.togglePause();
  assert.equal(state.launch(), false);
  state.togglePause();
  assert.equal(state.launch(), true);
  state.togglePause();
  assert.equal(state.addScore(100, 'bumper'), false);
});

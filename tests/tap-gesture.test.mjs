import test from 'node:test';
import assert from 'node:assert/strict';
import { createTapGesture } from '../lib/tap-gesture.ts';

const touch = (pointerId = 1, clientX = 40, clientY = 50) => ({
  pointerId,
  clientX,
  clientY,
  pointerType: 'touch',
  button: 0,
});

test('a short tap selects, including native event properties inherited from a prototype', () => {
  const gesture = createTapGesture();
  // DOM PointerEvent properties are accessors, not enumerable own properties.
  gesture.start(Object.create(touch()), 0);
  assert.equal(gesture.end(touch(1, 44, 52), 150), true);
});

test('pinching never selects on either finger release, even if the second finger stays still', () => {
  for (const order of [
    [1, 2],
    [2, 1],
  ]) {
    const gesture = createTapGesture();
    gesture.start(touch(1), 0);
    gesture.start(touch(2), 20);
    gesture.move(touch(1, 70), 50);
    for (const id of order) assert.equal(gesture.end(touch(id), 100), false);
    gesture.start(touch(3), 150);
    assert.equal(gesture.end(touch(3), 200), true);
  }
});

test('orbiting out and back to the starting position is still a drag', () => {
  const gesture = createTapGesture();
  gesture.start(touch(), 0);
  gesture.move(touch(1, 80));
  assert.equal(gesture.end(touch(), 200), false);
});

test('cancelled gestures and long presses do not select or poison the next tap', () => {
  const gesture = createTapGesture();
  gesture.start(touch(), 0);
  gesture.cancel(touch());
  assert.equal(gesture.end(touch(), 100), false);
  gesture.start(touch(), 200);
  assert.equal(gesture.end(touch(), 1100), false);
  gesture.start(touch(), 1200);
  assert.equal(gesture.end(touch(), 1300), true);
});

test('mouse selection stays precise and right-click panning cannot select', () => {
  const gesture = createTapGesture(),
    mouse = { ...touch(), pointerType: 'mouse' };
  gesture.start(mouse, 0);
  assert.equal(gesture.end(mouse, 100), true);
  gesture.start(mouse, 200);
  assert.equal(gesture.end({ ...mouse, clientX: 48 }, 300), false);
  gesture.start({ ...mouse, button: 2 }, 400);
  assert.equal(gesture.end({ ...mouse, button: 2 }, 500), false);
});

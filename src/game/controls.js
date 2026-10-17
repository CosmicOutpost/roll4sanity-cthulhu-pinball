export function bindControls(physics, toggleDebug, refresh) {
  const pressed = new Map();
  const actions = { KeyZ: 'left', Slash: 'right', Space: 'plunger' };
  const recompute = () => {
    for (const action of Object.values(actions)) physics.controls[action] = [...pressed.values()].includes(action);
  };
  const clear = () => {
    pressed.clear();
    physics.releaseControls();
    document.querySelectorAll('.touch-controls button').forEach(b => b.classList.remove('active'));
  };
  const pause = () => { physics.state.togglePause(); clear(); refresh(); };
  const restart = () => { clear(); physics.restart(); refresh(); };
  const keydown = e => {
    if (['KeyZ', 'Slash', 'Space', 'KeyP', 'KeyR', 'KeyD'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    if (e.code === 'KeyP') return pause();
    if (e.code === 'KeyR') return restart();
    if (e.code === 'KeyD') return toggleDebug();
    if (physics.state.paused) return;
    if (actions[e.code]) { pressed.set(e.code, actions[e.code]); recompute(); }
  };
  const keyup = e => {
    if (!actions[e.code]) return;
    e.preventDefault();
    const wasPlunger = physics.controls.plunger;
    pressed.delete(e.code);
    recompute();
    if (wasPlunger && !physics.controls.plunger) physics.launch();
  };
  const onBlur = () => { clear(); if (!physics.state.paused) physics.state.togglePause(); refresh(); };
  const visibility = () => { if (document.hidden) onBlur(); };
  window.addEventListener('keydown', keydown);
  window.addEventListener('keyup', keyup);
  window.addEventListener('blur', onBlur);
  document.addEventListener('visibilitychange', visibility);
  const removers = [];
  for (const [id, action] of [['left-flipper', 'left'], ['right-flipper', 'right'], ['launch', 'plunger']]) {
    const button = document.getElementById(id);
    const down = e => {
      e.preventDefault();
      if (physics.state.paused || e.button !== 0) return;
      button.setPointerCapture(e.pointerId);
      pressed.set(`pointer:${e.pointerId}`, action);
      button.classList.add('active');
      recompute();
    };
    const up = e => {
      const had = pressed.delete(`pointer:${e.pointerId}`);
      recompute();
      if (![...pressed.values()].includes(action)) button.classList.remove('active');
      if (had && action === 'plunger' && !physics.controls.plunger) {
        // Only a deliberate release fires. Cancellation or loss of capture must
        // never turn an interrupted gesture into an unintended weak plunge.
        if (e.type === 'pointerup') physics.launch();
        else physics.charge = 0;
      }
    };
    button.addEventListener('pointerdown', down);
    button.addEventListener('pointerup', up);
    button.addEventListener('pointercancel', up);
    button.addEventListener('lostpointercapture', up);
    removers.push(() => { button.removeEventListener('pointerdown', down); for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.removeEventListener(type, up); });
  }
  for (const [id, handler] of [['pause', pause], ['restart', restart], ['debug', toggleDebug]]) {
    document.getElementById(id).addEventListener('click', handler);
    removers.push(() => document.getElementById(id).removeEventListener('click', handler));
  }
  return () => {
    window.removeEventListener('keydown', keydown);
    window.removeEventListener('keyup', keyup);
    window.removeEventListener('blur', onBlur);
    document.removeEventListener('visibilitychange', visibility);
    removers.forEach(remove => remove());
  };
}

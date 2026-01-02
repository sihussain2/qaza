(function() {
  // Patch render to display the next incomplete Qaza date and move the "Reading for" label
  // This avoids editing popup.js directly by monkey-patching the global render function.

  function findNextIncompleteDate(rightState) {
    const start = new Date(QAZA_START_DATE);
    const today = new Date();
    // iterate from start to today, return first date that is missing or incomplete
    for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
      const ds = d.toISOString().slice(0, 10);
      const day = rightState.data[ds];
      if (!day || !isComplete(day)) return ds;
    }
    // fallback to cursorDate if everything is complete
    return rightState.cursorDate;
  }

  function ensureReadingDiv() {
    let rd = document.getElementById('readingFor');
    if (!rd) {
      rd = document.createElement('div');
      rd.id = 'readingFor';
      rd.style.marginTop = '6px';
      rd.style.fontSize = '13px';
      rd.style.opacity = '0.9';
      // insert between rightDate and hijri if possible
      if (rightDateDiv && hijriDiv && rightDateDiv.parentNode) {
        rightDateDiv.parentNode.insertBefore(rd, hijriDiv);
      } else if (rightDateDiv && rightDateDiv.parentNode) {
        rightDateDiv.parentNode.appendChild(rd);
      }
    }
    return rd;
  }

  // Wait until popup.js has defined render (it should be loaded before this script)
  function patchRenderOnce() {
    if (typeof render !== 'function') {
      // try again shortly
      setTimeout(patchRenderOnce, 50);
      return;
    }

    const originalRender = render;
    window.render = function(state) {
      // call original behavior first
      try { originalRender(state); } catch (e) { console.warn('original render failed', e); }

      try {
        if (!state || !state.right) return;
        const next = findNextIncompleteDate(state.right);
        if (rightDateDiv) rightDateDiv.textContent = next;
        if (hijriDiv) hijriDiv.textContent = typeof hijri === 'function' ? hijri(next) : '';
        const rd = ensureReadingDiv();
        rd.textContent = `Reading for ${next}`;
        if (qazaJumpLabel) qazaJumpLabel.textContent = 'Jump to';
      } catch (e) {
        console.warn('render patch failed', e);
      }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patchRenderOnce);
  } else {
    patchRenderOnce();
  }
})();

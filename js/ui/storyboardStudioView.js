(function (Nexora) {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  let scenes = [];

  function render() {
    const result = $('storyboard-result');
    if (!result) return;
    if (!scenes.length) {
      result.innerHTML = '<div class="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-center text-xs text-slate-500">Storyboard yang dibuat akan tampil di sini.</div>';
      return;
    }
    result.innerHTML = scenes.map((scene) => `
      <article class="rounded-2xl border border-violet-100 bg-white p-4 space-y-2 shadow-sm">
        <div class="flex items-center justify-between gap-2">
          <h3 class="text-sm font-extrabold text-slate-900">Adegan ${scene.number}: ${esc(scene.title)}</h3>
          <span class="rounded-full bg-violet-50 px-2 py-1 text-[10px] font-bold text-violet-700">Scene ${scene.number}</span>
        </div>
        <p class="text-xs text-slate-600">${esc(scene.direction)}</p>
        <div class="rounded-xl bg-slate-50 p-3 text-[11px] text-slate-600 whitespace-pre-line">${esc(scene.prompt)}</div>
        <button type="button" data-copy-scene="${scene.number - 1}" class="rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-bold">Salin prompt adegan</button>
      </article>`).join('') + `
      <button type="button" id="storyboard-copy-all" class="w-full rounded-xl bg-slate-900 px-4 py-3 text-xs font-extrabold text-white">Salin semua prompt</button>`;
    result.querySelectorAll('[data-copy-scene]').forEach((button) => {
      button.addEventListener('click', () => copy(scenes[Number(button.dataset.copyScene)]?.prompt || ''));
    });
    $('storyboard-copy-all')?.addEventListener('click', () => copy(scenes.map((s) => s.prompt).join('\n\n')));
  }

  function copy(value) {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(value).then(() => Nexora.notificationsUI?.showToast('Prompt berhasil disalin.', 'success'))
        .catch(() => Nexora.notificationsUI?.showToast('Gagal menyalin prompt.', 'error'));
    } else {
      Nexora.notificationsUI?.showToast('Clipboard tidak didukung browser ini.', 'error');
    }
  }

  function init() {
    const form = $('storyboard-form');
    if (!form) return;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const idea = $('storyboard-idea')?.value.trim();
      if (!idea) return;
      scenes = Nexora.storyboardService.create(
        idea,
        $('storyboard-style')?.value || 'stylized cinematic 3D animation',
        Number($('storyboard-count')?.value || 6)
      );
      render();
    });
    render();
  }

  Nexora.storyboardStudioView = { init, render };
})(window.Nexora = window.Nexora || {});

(function (Nexora) {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const esc = (v) => Nexora.utils && Nexora.utils.escapeHtml
    ? Nexora.utils.escapeHtml(v)
    : String(v ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let editingId = null;

  function resetForm() {
    editingId = null;
    ['character-name','character-role','character-age','character-appearance','character-outfit','character-personality'].forEach((id) => { if ($(id)) $(id).value = ''; });
    if ($('character-save-btn')) $('character-save-btn').textContent = 'Simpan Karakter';
  }

  function render() {
    const root = $('character-library-list');
    if (!root || !Nexora.characterLibrary) return;
    const items = Nexora.characterLibrary.list();
    root.innerHTML = items.length ? items.map((c) => `
      <article class="rounded-2xl border border-sky-100 bg-white p-3 space-y-2">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0"><h4 class="font-extrabold text-sm text-slate-900 break-words">${esc(c.name)}</h4><p class="text-[11px] text-slate-500">${esc(c.role || 'Karakter')} ${c.age ? '• ' + esc(c.age) : ''}</p></div>
          <span class="shrink-0 rounded-full bg-violet-50 px-2 py-1 text-[10px] font-bold text-violet-700">3D CHARACTER BIBLE</span>
        </div>
        <p class="text-xs text-slate-600 whitespace-pre-line">${esc(c.appearance || 'Belum ada deskripsi penampilan.')}</p>
        <div class="flex flex-wrap gap-2">
          <button type="button" data-action="prompt" data-id="${esc(c.id)}" class="rounded-lg bg-sky-600 px-3 py-2 text-[11px] font-bold text-white">Salin prompt visual</button>
          <button type="button" data-action="edit" data-id="${esc(c.id)}" class="rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-bold">Edit</button>
          <button type="button" data-action="delete" data-id="${esc(c.id)}" class="rounded-lg border border-rose-200 px-3 py-2 text-[11px] font-bold text-rose-600">Hapus</button>
        </div>
      </article>`).join('') : '<div class="rounded-xl border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500">Belum ada karakter. Buat karakter utama pertama.</div>';
  }

  function init() {
    const form = $('character-studio-form');
    if (!form) return;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      try {
        Nexora.characterLibrary.save({
          id: editingId || undefined,
          name: $('character-name').value,
          role: $('character-role').value,
          age: $('character-age').value,
          appearance: $('character-appearance').value,
          outfit: $('character-outfit').value,
          personality: $('character-personality').value
        });
        resetForm(); render();
        Nexora.notificationsUI?.showToast('Character Bible tersimpan di perangkat ini.', 'success');
      } catch (err) { Nexora.notificationsUI?.showToast(err.message, 'warning'); }
    });

    $('character-reset-btn')?.addEventListener('click', resetForm);
    $('character-library-list')?.addEventListener('click', async (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      const character = Nexora.characterLibrary.list().find((x) => x.id === button.dataset.id);
      if (!character) return;
      if (button.dataset.action === 'delete') {
        if (confirm(`Hapus karakter ${character.name}?`)) { Nexora.characterLibrary.remove(character.id); render(); }
      } else if (button.dataset.action === 'edit') {
        editingId = character.id;
        $('character-name').value = character.name;
        $('character-role').value = character.role;
        $('character-age').value = character.age;
        $('character-appearance').value = character.appearance;
        $('character-outfit').value = character.outfit;
        $('character-personality').value = character.personality;
        $('character-save-btn').textContent = 'Simpan Perubahan';
        $('character-studio-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (button.dataset.action === 'prompt') {
        const prompt = Nexora.characterLibrary.buildPrompt(character);
        try {
          await navigator.clipboard.writeText(prompt);
          Nexora.notificationsUI?.showToast('Prompt karakter disalin. Belum ada gambar yang dibuat.', 'success');
        } catch (_) {
          const blob = new Blob([prompt], { type: 'text/plain;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url; a.download = `${character.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-character-prompt.txt`; a.click(); URL.revokeObjectURL(url);
        }
      }
    });
    render();
  }

  Nexora.characterStudioView = { init, render };
})(window.Nexora = window.Nexora || {});

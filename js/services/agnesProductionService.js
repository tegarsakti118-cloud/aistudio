(function (Nexora) {
  'use strict';
  const KEY = 'nexora_agnes_server_url_v1';
  const clean = (v) => String(v || '').trim().replace(/\/+$/, '');
  class AgnesProductionService {
    constructor() { this.baseUrl = clean(localStorage.getItem(KEY)); this.isRunning = false; this.cancelRequested = false; this.activeTaskId = null; }
    getBaseUrl() { return this.baseUrl; }
    setBaseUrl(v) {
      const url = clean(v);
      let parsed; try { parsed = new URL(url); } catch (_) { throw new Error('URL server Agnes tidak valid.'); }
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('URL harus HTTP/HTTPS.');
      this.baseUrl = url; localStorage.setItem(KEY, url); return url;
    }
    async request(path, options = {}) {
      if (!this.baseUrl) throw new Error('Isi alamat server Agnes dulu.');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), options.timeout || 30000);
      try {
        const res = await fetch(this.baseUrl + path, { ...options, signal: controller.signal, headers: { Accept: 'application/json', ...(options.headers || {}) } });
        const ct = res.headers.get('content-type') || '';
        const data = ct.includes('application/json') ? await res.json() : await res.text();
        if (!res.ok) {
          const detail = data && typeof data === 'object' ? (data.detail || data.message || data.error) : data;
          throw new Error(typeof detail === 'string' ? detail : `Agnes HTTP ${res.status}`);
        }
        return data;
      } catch (e) {
        if (e.name === 'AbortError') throw new Error('Koneksi Agnes timeout.');
        if (e instanceof TypeError) throw new Error('Tidak dapat menghubungi Agnes. Periksa URL, server aktif, dan CORS.');
        throw e;
      } finally { clearTimeout(timer); }
    }
    async testConnection() { return this.request('/api/models', { timeout: 20000 }); }
    buildPrompt(project, script, chars) {
      const scenes = Array.isArray(script.scenes) ? script.scenes : [];
      const scenePlan = scenes.map((sc, i) => typeof sc === 'string'
        ? `${i + 1}. ${sc}`
        : `${sc.scene_no || i + 1}. ${sc.duration_sec || 7} detik; ${sc.speaker || 'Tokoh'}: ${sc.dialogue || sc.narration || sc.text || ''}; Visual: ${sc.visual_direction || ''}`).join('\n');
      const bible = (chars || []).map(c => `${c.name}: ${c.role || ''}; ${c.appearance || ''}; outfit: ${c.outfit || ''}; personality: ${c.personality || ''}`).join('\n');
      return [
        'Create a complete multi-shot vertical 9:16 animated story video, target 90-110 seconds, 720p.',
        'Visual quality: polished stylized cinematic 3D cartoon animation, expressive chibi-like characters, detailed 3D environments and props, real character body movement, facial expressions, cinematic camera changes, close-ups and medium shots.',
        'Maintain exact character identity, face, hairstyle, outfit, proportions and color palette across every scene. Keep environment and visual style continuous.',
        'This must be animated footage, NOT a slideshow, still-image montage, pan/zoom presentation, or flat 2D cards. Show visible character and camera motion in each scene.',
        'Use Indonesian dialogue, narration and readable Indonesian subtitles. Add fitting background music and sound effects. Story must have a hook, development, conflict, resolution and ending.',
        `Project: ${project.title || 'Nexora Story'}. Niche: ${project.niche || 'Storytelling'}.`,
        `Hook: ${script.hook || ''}`,
        `Character Bible:\n${bible || 'Create original consistent characters.'}`,
        `Scene plan:\n${scenePlan || 'Develop scenes from the story idea.'}`,
        `Ending: ${script.cta || 'Provide a satisfying ending.'}`,
        'Generate all scenes and concatenate them into one final MP4.'
      ].join('\n\n');
    }
    async generateStoryVideo({ project, script, characterBible = [], onProgress = () => {} }) {
      if (this.isRunning) throw new Error('Produksi Agnes sedang berjalan.');
      this.isRunning = true; this.cancelRequested = false;
      try {
        onProgress({ percent: 2, message: 'Mengirim naskah ke Agnes Multi-shot Story...' });
        const form = new FormData();
        form.append('prompt', this.buildPrompt(project, script, characterBible));
        form.append('content_lang', 'id');
        const created = await this.request('/api/tasks/creative', { method: 'POST', body: form, timeout: 60000 });
        const id = created.task_id || created.id || created.taskId;
        if (!id) throw new Error('Agnes tidak mengembalikan task_id. Periksa versi Agnes.');
        this.activeTaskId = id;
        const start = Date.now();
        while (Date.now() - start < 60 * 60 * 1000) {
          if (this.cancelRequested) {
            try { await this.request(`/api/tasks/${encodeURIComponent(id)}/stop`, { method: 'POST', timeout: 15000 }); } catch (_) {}
            throw new Error('Produksi dihentikan.');
          }
          await new Promise(r => setTimeout(r, 5000));
          const task = await this.request(`/api/tasks/${encodeURIComponent(id)}`);
          const status = String(task.status || task.state || '').toLowerCase();
          const pct = Math.max(5, Math.min(96, Number(task.progress || task.percent || 0)));
          onProgress({ percent: pct, message: task.message || task.current_stage || task.stage || `Agnes: ${status || 'memproses'}` });
          if (['completed', 'success', 'succeeded', 'done'].includes(status)) {
            onProgress({ percent: 100, message: 'MP4 final selesai.' });
            return { taskId: id, url: `${this.baseUrl}/api/video/${encodeURIComponent(id)}`, ext: 'mp4', sizeKb: Number(task.size_kb || 0), durationSec: Number(task.duration || task.duration_sec || 0), provider: 'Agnes' };
          }
          if (['failed', 'error', 'cancelled', 'canceled', 'stopped'].includes(status)) throw new Error(task.error || task.message || `Task ${status}`);
        }
        throw new Error('Render belum selesai dalam 60 menit. Periksa task di server Agnes.');
      } finally { this.isRunning = false; }
    }
    cancel() { this.cancelRequested = true; }
  }
  Nexora.agnesProductionService = new AgnesProductionService();
})(window.Nexora = window.Nexora || {});

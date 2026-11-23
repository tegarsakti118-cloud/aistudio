(function (Nexora) {
  'use strict';

  const MODEL = 'agnes-video-2.5-flash';
  const FUNCTION_NAME = 'agnes-video';
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function getScenes(script) {
    const raw = script && Array.isArray(script.scenes) ? script.scenes : [];
    return raw.map((scene, index) => {
      if (typeof scene === 'string') {
        return { sceneNo: index + 1, dialogue: scene, visual: '' };
      }
      return {
        sceneNo: Number(scene.scene_no || index + 1),
        dialogue: String(scene.dialogue || scene.narration || scene.text || '').trim(),
        visual: String(scene.visual_direction || scene.visual || scene.setting || '').trim(),
        duration: Number(scene.duration_sec || 6),
        character: String(scene.character || scene.speaker || '').trim()
      };
    }).filter((scene) => scene.dialogue || scene.visual);
  }

  function makePrompt(project, scene, index, total) {
    const title = String(project.title || 'Short story').slice(0, 140);
    const visual = scene.visual || 'A clear cinematic scene that visually expresses the story beat';
    const character = scene.character ? `Character identity: ${scene.character}. Keep the same face, hair, outfit and proportions throughout this project.` : 'Keep character identity, face, hairstyle, outfit and proportions visually consistent.';
    return [
      'Create one coherent animated 3D cartoon film shot, vertical 9:16, polished cinematic lighting, expressive character acting, natural body movement, detailed environment, smooth camera movement.',
      `Project: ${title}. Shot ${index + 1} of ${total}.`,
      `Visual direction: ${visual}.`,
      character,
      scene.dialogue ? `Story/dialogue context in Indonesian (visual context only, do not render text on screen): ${scene.dialogue}` : '',
      'No captions, no subtitles, no logos, no watermark, no split screen, no slideshow, no still-image montage. Show continuous visible motion within this shot.'
    ].filter(Boolean).join('\n');
  }

  async function invoke(payload) {
    const sb = Nexora.supabaseService;
    if (!sb || !sb.client || !sb.isAuthenticated()) {
      throw new Error('Login Supabase diperlukan sebelum memakai Agnes.');
    }
    const { data, error } = await sb.client.functions.invoke(FUNCTION_NAME, { body: payload });
    if (error) {
      let message = error.message || 'Edge Function gagal dipanggil.';
      if (error.context && typeof error.context.json === 'function') {
        try { const body = await error.context.json(); if (body.error) message = body.error; } catch (_) {}
      }
      throw new Error(message);
    }
    if (!data || data.error) throw new Error((data && data.error) || 'Respons Agnes tidak valid.');
    return data;
  }

  async function createClip({ project, scene, index, total }) {
    const seconds = Math.max(4, Math.min(12, Math.round(scene.duration || 6)));
    return invoke({
      action: 'create',
      model: MODEL,
      prompt: makePrompt(project, scene, index, total),
      seconds,
      aspect_ratio: '9:16'
    });
  }

  async function waitForClip(videoId, onStatus) {
    const started = Date.now();
    let delay = 8000;
    while (Date.now() - started < 15 * 60 * 1000) {
      await sleep(delay);
      const result = await invoke({ action: 'status', video_id: videoId, model: MODEL });
      const status = String(result.status || 'processing').toLowerCase();
      if (onStatus) onStatus(result);
      if (status === 'completed' || status === 'success' || status === 'succeeded') {
        const url = result.url || result.video_url || result.video?.url;
        if (!url) throw new Error('Agnes menyatakan selesai, tetapi URL video tidak ditemukan.');
        return { videoId, url, status, raw: result };
      }
      if (status === 'failed' || status === 'error') {
        throw new Error(result.error || result.message || 'Generasi klip gagal di Agnes.');
      }
      delay = Math.min(20000, Math.round(delay * 1.25));
    }
    throw new Error('Waktu tunggu 15 menit habis. Cek status tugas di dashboard Agnes.');
  }

  async function generateScenes({ project, script, onProgress, onClip }) {
    const scenes = getScenes(script);
    if (!scenes.length) throw new Error('Naskah belum memiliki daftar scenes.');
    const results = [];
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      if (onProgress) onProgress({ phase: 'creating', index: i, total: scenes.length, sceneNo: scene.sceneNo });
      const created = await createClip({ project, scene, index: i, total: scenes.length });
      const videoId = created.video_id || created.id || created.task_id;
      if (!videoId) throw new Error(`Agnes tidak mengembalikan video_id untuk adegan ${scene.sceneNo}.`);
      if (onProgress) onProgress({ phase: 'polling', index: i, total: scenes.length, sceneNo: scene.sceneNo, videoId });
      const clip = await waitForClip(videoId, (status) => {
        if (onProgress) onProgress({ phase: 'polling', index: i, total: scenes.length, sceneNo: scene.sceneNo, status: status.status, progress: status.progress });
      });
      const item = { sceneNo: scene.sceneNo, videoId, url: clip.url, dialogue: scene.dialogue, visual: scene.visual };
      results.push(item);
      if (onClip) onClip(item, results.slice());
    }
    return results;
  }

  Nexora.agnesVideoService = { generateScenes, getScenes, model: MODEL };
})(window.Nexora = window.Nexora || {});

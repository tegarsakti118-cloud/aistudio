(function (Nexora) {
  'use strict';

  const STORAGE_KEY = 'nexora_character_library_v1';
  const safeText = (value, max = 500) => String(value || '').trim().slice(0, max);

  class CharacterLibrary {
    constructor() { this.items = this.load(); }

    load() {
      try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        return Array.isArray(parsed) ? parsed.filter((x) => x && x.id && x.name) : [];
      } catch (_) { return []; }
    }

    persist() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items));
        return true;
      } catch (_) { return false; }
    }

    list() { return [...this.items]; }

    save(input) {
      const character = {
        id: input.id || `char_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: safeText(input.name, 60),
        role: safeText(input.role, 80),
        age: safeText(input.age, 30),
        appearance: safeText(input.appearance, 500),
        outfit: safeText(input.outfit, 300),
        personality: safeText(input.personality, 300),
        visualStyle: 'stylized cinematic 3D cartoon character, high quality 3D animation, consistent character design',
        createdAt: input.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      if (!character.name) throw new Error('Nama karakter wajib diisi.');
      const index = this.items.findIndex((x) => x.id === character.id);
      if (index >= 0) this.items[index] = character;
      else this.items.unshift(character);
      if (!this.persist()) throw new Error('Penyimpanan lokal penuh atau tidak tersedia.');
      return character;
    }

    remove(id) {
      this.items = this.items.filter((x) => x.id !== id);
      this.persist();
    }

    buildPrompt(character) {
      if (!character) return '';
      return [
        'Create a production-ready character reference sheet for a 3D animated film.',
        `Character name: ${character.name}.`,
        character.role && `Role: ${character.role}.`,
        character.age && `Apparent age: ${character.age}.`,
        character.appearance && `Physical design: ${character.appearance}.`,
        character.outfit && `Clothing and accessories: ${character.outfit}.`,
        character.personality && `Personality conveyed through expression and pose: ${character.personality}.`,
        'Show full body, front view, three-quarter view and side view in one clean character turnaround sheet.',
        'Keep facial features, hairstyle, body proportions, clothing colors and accessories identical across views.',
        'Neutral studio background, soft cinematic lighting, polished stylized 3D cartoon, detailed materials, no text, no watermark.'
      ].filter(Boolean).join('\n');
    }
  }

  Nexora.characterLibrary = new CharacterLibrary();
})(window.Nexora = window.Nexora || {});

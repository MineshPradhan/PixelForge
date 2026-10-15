/**
 * PixelForge Studio Pro — Typographic Glyphs Browser Panel
 *
 * Implements Adobe Photoshop Glyphs Palette Parity:
 * 1. Categorized Unicode symbol browser (Punctuation, Currency, Math, Arrows, Stars, Ligatures)
 * 2. 1-click glyph insertion into the active text layer
 * 3. Automatic system clipboard copy fallback
 * 4. Recent glyphs history
 */

class GlyphsPanel {
    constructor(app = null) {
        this.app = app;
        this.recentGlyphs = ['©', '™', '®', '—', '•', '★', '→', '€'];

        this.categories = {
            'Punctuation & Quotes': ['“', '”', '‘', '’', '«', '»', '—', '–', '…', '•', '‹', '›', '„', '‚', '¿', '¡'],
            'Currency': ['$', '€', '£', '¥', '₹', '₿', '¢', '₩', '¤', '₱', '₴', '₺', '₫', '₡'],
            'Math & Logic': ['±', '×', '÷', '√', '∞', 'π', '∑', '∆', '≈', '≠', '≤', '≥', 'µ', '∂', '∫', '‰', '‱', 'º', 'ª'],
            'Arrows': ['←', '↑', '→', '↓', '↔', '↕', '↖', '↗', '↘', '↙', '↵', '↺', '↻', '➔'],
            'Dingbats & Stars': ['★', '☆', '✦', '✧', '✪', '✫', '✯', '✶', '✷', '✸', '✹', '✺', '✻', '✼', '✽', '✾', '✿', '❀'],
            'Shapes & Emblems': ['♠', '♥', '♦', '♣', '♤', '♡', '♢', '♧', '■', '□', '▲', '△', '▼', '▽', '◆', '◇', '●', '○', '◈'],
            'Legal & Fractions': ['©', '®', '™', '§', '¶', '†', '‡', '½', '¼', '¾', '⅓', '⅔', '⅛', '⅜', '⅝', '⅞']
        };
    }

    setApp(app) {
        this.app = app;
    }

    insertGlyph(char) {
        if (!char) return;

        // Add / promote to front of recents
        const idx = this.recentGlyphs.indexOf(char);
        if (idx !== -1) {
            this.recentGlyphs.splice(idx, 1);
        }
        this.recentGlyphs.unshift(char);
        if (this.recentGlyphs.length > 16) this.recentGlyphs.pop();

        // Insert into active text layer if active
        if (this.app && this.app.layerManager) {
            const active = this.app.layerManager.getActiveLayer();
            if (active && active.type === 'text') {
                active.text = (active.text || '') + char;
                this.app.renderComposite();
                this.app.pushHistoryState(`Insert Glyph '${char}'`);
                return true;
            }
        }

        // Fallback: Copy to clipboard
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
            navigator.clipboard.writeText(char);
        }
        return false;
    }
}

// Export for browser & Node
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GlyphsPanel };
}
if (typeof window !== 'undefined') {
    window.GlyphsPanel = GlyphsPanel;
}
if (typeof global !== 'undefined') {
    global.GlyphsPanel = GlyphsPanel;
}

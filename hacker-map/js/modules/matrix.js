/**
 * H4CK3R M4P - Cyber Threat Intelligence
 * Matrix Canvas Background Module
 * 
 * Provides an atmospheric, subtle falling-code aesthetic tailored for technical legibility.
 * 
 * @author 0xsh4n
 * @url https://github.com/0xsh4n
 */

import { prefersReducedMotion } from '../utils/dom.js';

export class MatrixBackground {
    constructor(canvasId = 'matrix-canvas') {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;

        this.ctx = this.canvas.getContext('2d', { alpha: false });
        this.fontSize = 14;
        this.columns = 0;
        this.drops = [];
        this.animationFrameId = null;
        this.isRunning = false;
        this.lastFrameTime = 0;
        this.fpsInterval = 1000 / 24; // 24 FPS is cinematic, calm, and low on CPU/battery

        // Cyber / hacker character set
        this.characters = [
            '0', '1', 'A', 'F', 'X', '9', 'C', 'V', 'E',
            'X', 'S', 'S', 'R', 'C', 'E', 'S', 'Q', 'L', 'S', 'S', 'H',
            '$', '#', '%', '&', '*', '!', '?', '<', '>', '/', '{', '}',
            '0x', '::', '403', '401', '500', '200'
        ];

        this.init();
    }

    init() {
        if (!this.canvas) return;

        this.resize();
        window.addEventListener('resize', () => this.resize(), { passive: true });

        // If reduced motion is requested, do not run matrix rain
        if (!prefersReducedMotion()) {
            this.start();
        }
    }

    resize() {
        if (!this.canvas) return;
        const width = window.innerWidth;
        const height = window.innerHeight;

        this.canvas.width = width;
        this.canvas.height = height;

        this.columns = Math.floor(width / this.fontSize);
        this.drops = [];
        for (let i = 0; i < this.columns; i++) {
            // Stagger initial vertical positions
            this.drops[i] = Math.floor(Math.random() * -100);
        }

        // Fill initial black
        if (this.ctx) {
            this.ctx.fillStyle = '#000000';
            this.ctx.fillRect(0, 0, width, height);
        }
    }

    start() {
        if (this.isRunning || !this.canvas) return;
        this.isRunning = true;
        this.lastFrameTime = performance.now();
        this.loop(this.lastFrameTime);
    }

    stop() {
        this.isRunning = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    toggle(enable) {
        if (enable === undefined) {
            enable = !this.isRunning;
        }
        if (enable) {
            this.canvas.style.display = 'block';
            this.start();
        } else {
            this.stop();
            this.canvas.style.display = 'none';
        }
        return this.isRunning;
    }

    loop(timestamp) {
        if (!this.isRunning) return;

        this.animationFrameId = requestAnimationFrame((t) => this.loop(t));

        const elapsed = timestamp - this.lastFrameTime;
        if (elapsed < this.fpsInterval) return;

        this.lastFrameTime = timestamp - (elapsed % this.fpsInterval);
        this.draw();
    }

    draw() {
        const { ctx, canvas, fontSize, drops, characters } = this;
        if (!ctx || !canvas) return;

        // Translucent black overlay gives trailing fade effect without blinding UI
        ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.font = `${fontSize}px 'Fira Code', monospace`;

        for (let i = 0; i < drops.length; i++) {
            // Don't render every column on every frame for a cleaner, spaced look
            if (i % 2 !== 0) continue;

            const text = characters[Math.floor(Math.random() * characters.length)];
            const x = i * fontSize;
            const y = drops[i] * fontSize;

            // Occasional bright leading glyph
            if (Math.random() > 0.96) {
                ctx.fillStyle = '#d7ffd7'; // White-green head
            } else {
                ctx.fillStyle = 'rgba(0, 255, 65, 0.28)'; // Dim ambient neon green
            }

            if (y > 0 && y < canvas.height + fontSize) {
                ctx.fillText(text, x, y);
            }

            // Reset drop to top with randomized delay once it falls off the bottom
            if (y > canvas.height && Math.random() > 0.975) {
                drops[i] = 0;
            }

            drops[i]++;
        }
    }
}

// danmaku.js
let comments = [];
let canvas = null;
let ctx = null;
let isPlaying = false;
let delayOffsetMs = 0; // User-defined delay

window.initDanmakuEngine = (canvasElement, videoElement) => {
    console.log("Initializing Danmaku Engine");
    canvas = canvasElement;
    ctx = canvas.getContext('2d');

    // Get delay setting
    chrome.storage.local.get(['delayOffset'], (res) => {
        if (res.delayOffset) {
            delayOffsetMs = parseFloat(res.delayOffset) * 1000;
        }
    });

    // Watch for storage changes for delay
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.delayOffset) {
            delayOffsetMs = parseFloat(changes.delayOffset.newValue) * 1000;
            console.log("Delay offset updated to:", changes.delayOffset.newValue);
        }
    });

    // Start rendering loop
    isPlaying = true;
    requestAnimationFrame(drawLoop);
};

window.addCommentToDanmaku = (comment) => {
    // Comment object from background script
    const text = comment.content;
    if (!text || text.trim() === '') return;

    // Niconico specifics
    const sizeMap = {
        'big': 48,
        'medium': 32,
        'small': 24
    };
    const colorMap = {
        'white': '#ffffff',
        'red': '#ff0000',
        'blue': '#0000ff',
        'green': '#00ff00',
        'yellow': '#ffff00',
        'pink': '#ff00ff',
        'orange': '#ff9900'
    };

    const fontSize = sizeMap[comment.size] || 32;
    const color = colorMap[comment.color] || '#ffffff';

    // Measure text width 
    ctx.font = `bold ${fontSize}px sans-serif`;
    const textWidth = ctx.measureText(text).width;

    // Calculate speed: standard is across screen in 4 seconds
    const totalDistance = canvas.width + textWidth;
    const durationMs = 4000;
    const framesPerSec = 60;
    const pixelsPerFrame = totalDistance / (durationMs / (1000 / framesPerSec));

    // Determine vertical slot to minimize overlaps
    const slotHeight = fontSize + 4;
    const maxSlots = Math.floor(canvas.height / slotHeight);
    // Pick random slot from top 80% of screen to not block subtitles fully, or full screen 
    const slotCount = Math.floor(maxSlots * 0.85);
    const slotIndex = Math.floor(Math.random() * (slotCount > 0 ? slotCount : 1));
    const y = (slotIndex * slotHeight) + fontSize + 10;

    const newComment = {
        text: text,
        x: canvas.width,
        y: y,
        color: color,
        fontSize: fontSize,
        speed: pixelsPerFrame,
        createdAt: Date.now(),
        targetTime: Date.now() + delayOffsetMs, // Time it should appear
        isVisible: false
    };

    comments.push(newComment);
};

function drawLoop() {
    if (!isPlaying) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const now = Date.now();

    for (let i = comments.length - 1; i >= 0; i--) {
        const c = comments[i];

        // Check if it's time to show the comment (respecting delay)
        if (now >= c.targetTime) {
            c.isVisible = true;
        }

        if (c.isVisible) {
            // Draw text
            ctx.font = `bold ${c.fontSize}px 'Hiragino Kaku Gothic ProN', 'Meiryo', 'Noto Sans JP', sans-serif`;
            ctx.fillStyle = c.color;

            // Black outline for visibility on bright video
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 4;
            ctx.strokeText(c.text, c.x, c.y);
            ctx.fillText(c.text, c.x, c.y);

            // Move left
            c.x -= c.speed;

            // Remove off-screen comments
            if (c.x + ctx.measureText(c.text).width < 0) {
                comments.splice(i, 1);
            }
        }
    }

    requestAnimationFrame(drawLoop);
}

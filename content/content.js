// content.js
console.log("Nico-Netflix extension loaded.");

let isInitialized = false;
let videoPlayer = null;

setInterval(checkAndInject, 1000);

function checkAndInject() {
    if (isInitialized) return;
    const video = document.querySelector('video');
    if (video && video.readyState > 0 && !document.getElementById('niconet-sidebar')) {
        initOverlay(video);
    }
}

function initOverlay(video) {
    isInitialized = true;
    videoPlayer = video;

    console.log("Found Netflix video, injecting UI...");

    // Apply layout modification class to HTML to squeeze Netflix player and prevent clipping
    document.documentElement.classList.add('niconet-active');

    const canvas = document.createElement('canvas');
    canvas.id = 'niconet-overlay';
    document.body.appendChild(canvas);

    const sidebarHTML = `
    <div id="niconet-sidebar">
      <div id="niconet-sidebar-header">
        <h3>NETFLIX JIKKYO</h3>
        <button id="niconet-toggle-btn">×</button>
      </div>
      <div id="niconet-comment-list"></div>
      <div id="niconet-input-area">
        <input type="text" id="niconet-comment-input" placeholder="コメントを入力...">
        <button id="niconet-send-btn">送信</button>
      </div>
    </div>
  `;
    document.body.insertAdjacentHTML('beforeend', sidebarHTML);

    if (typeof window.initNicoNetUI === 'function') window.initNicoNetUI();
    if (typeof window.initDanmakuEngine === 'function') window.initDanmakuEngine(canvas, video);

    // Resize canvas explicitly over the Netflix video area
    const resizeCanvas = () => {
        const isSidebarOpen = document.documentElement.classList.contains('niconet-active');
        // Ensure canvas sits perfectly over the left portion of the screen
        canvas.width = window.innerWidth - (isSidebarOpen ? 320 : 0);
        canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resizeCanvas);
    // Initial size flush
    setTimeout(resizeCanvas, 500);

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.type === "NEW_COMMENT") {
            if (typeof window.handleNewComment === 'function') window.handleNewComment(request.comment);
            if (typeof window.addCommentToDanmaku === 'function') window.addCommentToDanmaku(request.comment);
        }
    });

    const observer = new MutationObserver(() => {
        if (!document.body.contains(canvas)) {
            isInitialized = false;
        }
    });
    observer.observe(document.body, { childList: true });

    chrome.storage.local.get(['broadcastId', 'autoStart'], (res) => {
        if (res.autoStart && res.broadcastId) {
            chrome.runtime.sendMessage({ type: "START_NICO_CONNECTION", broadcastId: res.broadcastId });
        }
    });
}

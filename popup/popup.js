document.addEventListener('DOMContentLoaded', () => {
    const broadcastIdInput = document.getElementById('broadcast-id');
    const startBtn = document.getElementById('start-btn');
    const stopBtn = document.getElementById('stop-btn');
    const delaySlider = document.getElementById('delay-offset');
    const delayValue = document.getElementById('delay-value');

    // Load saved settings
    chrome.storage.local.get(['broadcastId', 'delayOffset'], (res) => {
        if (res.broadcastId) broadcastIdInput.value = res.broadcastId;
        if (res.delayOffset) {
            delaySlider.value = res.delayOffset;
            delayValue.innerText = Number(res.delayOffset).toFixed(1) + 's';
        }
    });

    // Start button
    startBtn.addEventListener('click', () => {
        const broadcastId = broadcastIdInput.value.trim();
        if (!broadcastId) return;

        // Save to storage
        chrome.storage.local.set({ broadcastId: broadcastId, autoStart: true });

        // Tell background to connect
        chrome.runtime.sendMessage({
            type: "START_NICO_CONNECTION",
            broadcastId: broadcastId
        }, (response) => {
            startBtn.innerText = "Started!";
            setTimeout(() => startBtn.innerText = "Start Overlay on Netflix", 2000);
        });
    });

    // Stop button
    stopBtn.addEventListener('click', () => {
        chrome.storage.local.set({ autoStart: false });
        chrome.runtime.sendMessage({ type: "STOP_NICO_CONNECTION" }, () => {
            stopBtn.innerText = "Stopped!";
            setTimeout(() => stopBtn.innerText = "Stop Overlay", 2000);
        });
    });

    // Delay slider visual update
    delaySlider.addEventListener('input', (e) => {
        const val = e.target.value;
        delayValue.innerText = Number(val).toFixed(1) + 's';
    });

    // Delay slider save on release
    delaySlider.addEventListener('change', (e) => {
        const val = e.target.value;
        chrome.storage.local.set({ delayOffset: val });
    });
});

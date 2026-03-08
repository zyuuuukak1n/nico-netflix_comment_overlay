// background.js

let nicoTabId = null;
let currentBroadcastId = null;
let simulationInterval = null;
let commentCount = 0;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "START_NICO_CONNECTION") {
        startConnection(request.broadcastId)
            .then(() => sendResponse({ success: true }))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true; // async
    } else if (request.type === "STOP_NICO_CONNECTION") {
        stopConnection();
        sendResponse({ success: true });
    } else if (request.type === "POST_COMMENT") {
        // Send to Netflix tabs so it shows locally immediately
        broadcastComment({
            no: "-",
            user: "You",
            content: request.comment,
            color: "yellow",
            size: "medium",
            time: Date.now()
        });

        // Also send to Nico tab to actually post it
        if (nicoTabId) {
            chrome.tabs.sendMessage(nicoTabId, { type: "POST_COMMENT_NICO", comment: request.comment }).catch(() => { });
        }

        sendResponse({ success: true });
    } else if (request.type === "NEW_COMMENT") {
        // Relay from nico_content.js to Netflix
        if (sender.tab && sender.tab.id === nicoTabId) {
            request.comment.time = Date.now();
            console.log("Relaying new REAL comment from Nico:", request.comment.content);
            broadcastComment(request.comment);
        } else {
            console.log("Received comment but sender tab doesn't match nicoTabId", sender.tab?.id, "vs", nicoTabId);
        }
    } else if (request.type === "NICO_TAB_ALIVE") {
        // Update nicoTabId if it lost track
        if (sender.tab) nicoTabId = sender.tab.id;
    }
});

async function startConnection(broadcastId) {
    stopConnection();
    currentBroadcastId = broadcastId;

    // Use simulation for testing
    if (broadcastId === "test" || !broadcastId.startsWith("lv")) {
        startSimulation();
        return;
    }

    // Real connection by opening a background tab
    const nicoUrl = `https://live.nicovideo.jp/watch/${broadcastId}`;
    console.log(`Attempting to open Nico tab for ${nicoUrl}...`);

    chrome.tabs.create({ url: nicoUrl, active: false }, (tab) => {
        nicoTabId = tab.id;
        // Mute the tab so we don't hear duplicate audio
        chrome.tabs.update(tab.id, { muted: true });
        console.log("Nico tab created with ID: " + tab.id);
    });
}

function stopConnection() {
    if (nicoTabId) {
        chrome.tabs.remove(nicoTabId).catch(err => console.log("Tab already closed"));
        nicoTabId = null;
    }
    if (simulationInterval) {
        clearInterval(simulationInterval);
        simulationInterval = null;
    }
    currentBroadcastId = null;
}

function broadcastComment(comment) {
    chrome.tabs.query({ url: "https://www.netflix.com/watch/*" }, (tabs) => {
        for (let tab of tabs) {
            chrome.tabs.sendMessage(tab.id, { type: "NEW_COMMENT", comment: comment }).catch(() => { });
        }
    });
}

// ------ Simulation Mode for Testing ------
const testComments = [
    "大谷の集中力", "緊張で手汗やばい", "祈ってる", "フルカウント！！",
    "次で決まる？", "すげぇ...", "もう見れない", "俺も持たない",
    "ここが勝負", "3-2！", "でも大谷が上だ", "次の一球で決まる",
    "簡単には終わらない", "粘ってるな", "トラウトやべぇ", "投げ込め！",
    "さすがトラウト", "大谷の表情やばい", "これが侍だ", "鬼の形相",
    "男の中の男", "日本を背負ってる", "www", "きたああああ", "おおおおお"
];

function startSimulation() {
    console.log("Starting comment simulation...");
    commentCount = 0;

    for (let i = 0; i < 5; i++) {
        emitSimulatedComment();
    }

    simulationInterval = setInterval(() => {
        emitSimulatedComment();
    }, 1000); // 1 comment per second
}

function emitSimulatedComment() {
    const text = testComments[Math.floor(Math.random() * testComments.length)];
    commentCount++;

    broadcastComment({
        no: commentCount,
        user: `User${Math.floor(Math.random() * 10000)}`,
        content: text,
        color: Math.random() > 0.95 ? "red" : (Math.random() > 0.9 ? "yellow" : "white"),
        size: Math.random() > 0.9 ? "big" : "medium",
        time: Date.now()
    });
}

// nico_content.js
console.log("Nico-Netflix extension: Injected into Niconico Live tab.");

// Send a ping so background knows this tab is the data source
let pingInterval = setInterval(() => {
    try {
        chrome.runtime.sendMessage({ type: "NICO_TAB_ALIVE" });
    } catch (e) {
        if (e.message && e.message.includes("Extension context invalidated")) {
            clearInterval(pingInterval);
            window.close(); // Extension was reloaded, kill this zombie tab
        }
    }
}, 5000);

let commentCount = 0;

const observer = new MutationObserver((mutations) => {
    for (let m of mutations) {
        for (let node of m.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
                extractComments(node);
            }
        }
    }
});

function extractComments(rootNode) {
    // Niconico's new UI often uses a table/row layout for comments
    const selectors = '[data-name="comment"], li[class*="comment"], div[class*="comment-row"], div[class*="CommentItem"], tr[class*="comment"]';
    let targets = Array.from(rootNode.querySelectorAll(selectors));

    if (rootNode.matches && rootNode.matches(selectors)) {
        targets.push(rootNode);
    }

    // Fallback for general chat rows if specific classes aren't found
    if (targets.length === 0) {
        const allEls = rootNode.querySelectorAll('div, li, tr');
        for (let el of allEls) {
            if (el.className && typeof el.className === 'string' && el.className.toLowerCase().includes('comment')) {
                if (el.textContent.trim()) {
                    targets.push(el);
                }
            }
        }
    }

    // If we STILL can't find specific targets, maybe the root node itself IS the text node container (e.g. they append spans)
    if (targets.length === 0 && rootNode.textContent.trim()) {
        targets.push(rootNode);
    }

    for (let row of targets) {
        if (row.dataset.niconetHandled) continue;
        row.dataset.niconetHandled = "true";

        let message = "";

        // Explicit modern target
        let textEl = row.querySelector('[data-name="comment-text"], [class*="text"], [class*="message"], [class*="CommentText"]');

        if (textEl && textEl.textContent.trim()) {
            message = textEl.textContent.trim();
        } else {
            // Deep dive text extraction heuristic
            const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT, null, false);
            let node;
            let validTexts = [];
            while ((node = walker.nextNode())) {
                const t = node.nodeValue.trim();
                // Strict filtering of noise:
                // 1. Pure numbers (comment ID / view counts)
                // 2. Timestamps like 12:34 or 1:23:45 or 00:00
                // 3. Simple punctuation leftovers
                // 4. Nicknames often end in "さん" or similar, or just skip if it's too short and there's a longer text available.
                if (t && !/^\d+$/.test(t) && !/^\d{1,2}:\d{2}(:\d{2})?$/.test(t) && !/^[/:,.\- ]+$/.test(t) && t !== "プレミアム") {
                    // Further filter if the text node might be a username explicitly (e.g. parent has 'name' class)
                    let isNameClass = false;
                    let pNode = node.parentElement;
                    if (pNode) {
                        const pClass = (pNode.className || '').toString().toLowerCase();
                        if (pClass.includes('name') || pClass.includes('user') || pClass.includes('creator')) {
                            isNameClass = true;
                        }
                    }
                    if (!isNameClass) validTexts.push(t);
                }
            }

            if (validTexts.length > 0) {
                // Join remaining valid texts, as sometimes comments are split by links or emotes
                message = validTexts.join(" ");
            }
        }

        if (message) {
            commentCount++;
            // Clean up the message if it has newline noise
            message = message.replace(/\n/g, ' ').trim();

            try {
                chrome.runtime.sendMessage({
                    type: "NEW_COMMENT",
                    comment: {
                        no: commentCount,
                        user: "NicoLive",
                        content: message,
                        color: "white", // Default, could try to parse colors but complex via DOM
                        size: "medium"
                    }
                });
            } catch (e) {
                if (e.message && e.message.includes("Extension context invalidated")) {
                    observer.disconnect();
                    window.close(); // Extension was reloaded, kill this zombie tab
                }
            }
        }
    }
}

// Start observing
setTimeout(() => {
    if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
        console.log("Nico-Netflix: Started observing Nico DOM for comments.");
    }
}, 3000);

// Post comment back to Nico
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "POST_COMMENT_NICO") {
        const inputs = Array.from(document.querySelectorAll('input, textarea')).filter(el => {
            const type = el.getAttribute('type');
            return (!type || type === 'text') && el.offsetWidth > 0;
        });

        let targetInput = inputs.find(el => (el.placeholder && el.placeholder.includes('コメント'))) || inputs[inputs.length - 1];

        if (targetInput) {
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
            if (nativeInputValueSetter) {
                nativeInputValueSetter.call(targetInput, msg.comment);
                targetInput.dispatchEvent(new Event('input', { bubbles: true }));
            } else {
                targetInput.value = msg.comment;
            }

            const form = targetInput.closest('form');
            if (form) {
                form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
            } else {
                const btn = targetInput.parentElement.querySelector('button') || document.querySelector('button[aria-label*="送信"], button[title*="送信"], button[class*="send"]');
                if (btn) btn.click();
            }
        }
    }
});

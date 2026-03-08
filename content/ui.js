// ui.js
window.initNicoNetUI = () => {
    console.log("Initializing NicoNet UI");

    const sidebar = document.getElementById('niconet-sidebar');
    const toggleBtn = document.getElementById('niconet-toggle-btn');
    const commentList = document.getElementById('niconet-comment-list');
    const commentInput = document.getElementById('niconet-comment-input');
    const sendBtn = document.getElementById('niconet-send-btn');

    let isSidebarOpen = true;

    toggleBtn.addEventListener('click', () => {
        isSidebarOpen = !isSidebarOpen;
        if (isSidebarOpen) {
            sidebar.classList.remove('niconet-hidden');
            document.documentElement.classList.add('niconet-active');
            toggleBtn.innerText = '×';
        } else {
            sidebar.classList.add('niconet-hidden');
            document.documentElement.classList.remove('niconet-active');
            toggleBtn.innerText = '◀';
        }
        window.dispatchEvent(new Event('resize'));
    });

    // Handle new comments arriving to add to DOM
    window.handleNewComment = (comment) => {
        const item = document.createElement('div');
        item.className = 'niconet-comment-item';

        item.innerHTML = `
      <div class="niconet-no">${comment.no}</div>
      <div class="niconet-user" title="${comment.user}">${comment.user}</div>
      <div class="niconet-text">${escapeHTML(comment.content)}</div>
    `;

        commentList.appendChild(item);

        // Auto scroll to bottom
        commentList.scrollTop = commentList.scrollHeight;

        // Keep list manageable
        while (commentList.children.length > 200) {
            commentList.removeChild(commentList.firstChild);
        }
    };

    const sendComment = () => {
        const text = commentInput.value.trim();
        if (!text) return;

        // Send to background
        chrome.runtime.sendMessage({ type: "POST_COMMENT", comment: text }, (response) => {
            if (response && response.success) {
                commentInput.value = '';
            } else {
                alert("Failed to send comment.");
            }
        });
    };

    sendBtn.addEventListener('click', sendComment);
    commentInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendComment();
        }
    });
};

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g,
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

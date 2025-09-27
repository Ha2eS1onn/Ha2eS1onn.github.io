/* 彩色文字圆块头像 */
(function () {
    function insertTextAvatar() {
      const cards = document.querySelectorAll('.wl-cards .wl-card');
      cards.forEach(card => {
        if (card.querySelector('.my-avatar')) return;        // 防重复
        const nickEl = card.querySelector('.wl-nick');
        if (!nickEl) return;
        const first = nickEl.textContent.trim()[0] || '?';
        const avatar = document.createElement('div');
        avatar.className = 'my-avatar';
        avatar.textContent = first.toUpperCase();
        const header = card.querySelector('.wl-header');
        if (header) header.prepend(avatar);
      });
    }
    /* 初次 + 后续动态加载 */
    insertTextAvatar();
    const ob = new MutationObserver(insertTextAvatar);
    ob.observe(document.querySelector('.wl-cards'), { childList: true });
  })();
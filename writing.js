(() => {
  const topics = ['All', 'AI Engineering', 'LLM Inference', 'RAG & Agents', 'Backend', 'Deployment'];
  const preview = new URLSearchParams(location.search).get('preview') === '1';
  const raw = preview ? window.WRITING_SAMPLES : window.WRITING_ARTICLES;

  function validUrl(value) {
    try {
      const url = new URL(value);
      return ['https:', 'http:'].includes(url.protocol) && !!url.hostname &&
        !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) &&
        !url.username && !url.password;
    } catch { return false; }
  }
  function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
  }
  function published(article) {
    return article && article.status === 'published' &&
      typeof article.title === 'string' && article.title.trim() &&
      typeof article.excerpt === 'string' && article.excerpt.trim() &&
      typeof article.platform === 'string' && article.platform.trim() &&
      ['article', 'post', 'note'].includes(article.type) &&
      topics.includes(article.topic) && article.topic !== 'All' &&
      validUrl(article.url) && validDate(article.publishedAt);
  }
  const articles = (Array.isArray(raw) ? raw : [])
    .filter(preview ? article => article?.status === 'sample' : published)
    .sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));

  function el(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value != null) node.textContent = value;
    return node;
  }
  function dateText(value) {
    return validDate(value) ? new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`)) : 'Date pending';
  }
  function platformName(article) {
    return article.platform === 'LinkedIn' && article.type === 'post' ? 'LinkedIn post' : article.platform;
  }
  function platformMark(platform) {
    const isLinkedIn = platform === 'LinkedIn';
    const isMedium = platform === 'Medium';
    const mark = el('span', `writing-platform-icon ${isMedium ? 'is-medium' : isLinkedIn ? '' : 'is-other'}`, isMedium ? 'M' : isLinkedIn ? 'in' : '↗');
    mark.setAttribute('aria-hidden', 'true');
    return mark;
  }
  function cover(article) {
    const box = el('div', 'writing-cover');
    if (article.cover && article.coverAlt && (validUrl(article.cover) || article.cover.startsWith('data:'))) {
      const img = el('img');
      img.src = article.cover;
      img.alt = article.coverAlt;
      img.loading = 'lazy';
      box.append(img);
    } else if (article.cover && article.coverAlt && !/^[a-z][a-z\d+.-]*:/i.test(article.cover) && !article.cover.startsWith('//')) {
      const img = el('img');
      const inSubdir = location.pathname.includes('/writing');
      const prefix = inSubdir ? '../' : './';
      const cleanPath = article.cover.replace(/^\.?\//, '');
      img.src = `${prefix}${cleanPath}`;
      img.alt = article.coverAlt;
      img.loading = 'lazy';
      box.append(img);
    } else {
      box.append(el('span', 'writing-cover-topic', article.topic), el('span', 'writing-cover-title', article.title), el('span', 'writing-cover-rule'));
    }
    return box;
  }
  function meta(article) {
    const row = el('p', 'writing-meta');
    const platform = el('span', 'writing-platform');
    platform.append(platformMark(article.platform), document.createTextNode(platformName(article)));
    row.append(platform, el('span', 'writing-meta-dot', '·'), el('time', '', dateText(article.publishedAt)));
    if (validDate(article.publishedAt)) row.querySelector('time').dateTime = article.publishedAt;
    if (Number.isInteger(article.readingMinutes) && article.readingMinutes > 0) row.append(el('span', 'writing-meta-dot', '·'), el('span', '', `${article.readingMinutes} min read`));
    return row;
  }
  function action(platform, url, type, title, secondary = false) {
    const name = platform === 'LinkedIn' && type === 'post' ? 'LinkedIn post' : platform;
    const label = `Read on ${name}`;
    if (!validUrl(url)) return el('span', 'writing-action is-sample', `${label} · sample link inactive`);
    const link = el('a', `writing-action${secondary ? ' writing-action-secondary' : ''}`);
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', `${label}: ${title} (opens in a new tab)`);
    link.append(document.createTextNode(label), el('span', 'writing-arrow', '↗'));
    link.lastChild.setAttribute('aria-hidden', 'true');
    return link;
  }
  function articleCard(article, featured = false) {
    const card = el('article', featured ? 'writing-featured-card' : 'writing-card');
    card.append(cover(article));
    const body = el('div', featured ? 'writing-featured-body' : 'writing-card-body');
    body.append(el('span', 'writing-topic', article.topic), el('h3', '', article.title), el('p', 'writing-excerpt', article.excerpt), meta(article));
    const actions = el('div', 'writing-action-row');
    actions.append(action(article.platform, article.url, article.type, article.title));
    for (const link of Array.isArray(article.secondaryLinks) ? article.secondaryLinks : []) {
      if (validUrl(link.url) && typeof link.platform === 'string' && link.platform.trim()) actions.append(action(link.platform, link.url, link.type, article.title, true));
    }
    body.append(actions);
    card.append(body);
    return card;
  }
  function latest() {
    const list = document.getElementById('latest-writing-list');
    if (!list) return;
    if (!articles.length) {
      list.append(el('p', 'latest-writing-empty', 'Writing is on the way. Articles and practical notes will appear here.'));
      return;
    }
    articles.slice(0, 3).forEach(article => {
      const item = el(validUrl(article.url) ? 'a' : 'div', 'latest-writing-item');
      if (validUrl(article.url)) {
        item.href = article.url;
        item.target = '_blank';
        item.rel = 'noopener noreferrer';
        item.setAttribute('aria-label', `Read ${article.title} on ${platformName(article)} (opens in a new tab)`);
      }
      item.append(el('span', 'writing-topic', preview ? `${article.topic} · sample` : article.topic), el('strong', '', article.title));
      const footer = el('span', 'latest-writing-item-footer');
      footer.append(el('span', '', `${platformName(article)} · ${dateText(article.publishedAt)}`));
      if (!preview) footer.append(el('span', 'latest-writing-arrow', '↗'));
      item.append(footer);
      list.append(item);
    });
  }
  function writingPage() {
    const collection = document.getElementById('writing-collection-section');
    if (!collection) return;
    const menu = document.querySelector('.writing-menu-button');
    const mobileNav = document.getElementById('writing-mobile-nav');
    function closeMenu() { mobileNav.hidden = true; menu.setAttribute('aria-expanded', 'false'); }
    menu.addEventListener('click', () => {
      mobileNav.hidden = !mobileNav.hidden;
      menu.setAttribute('aria-expanded', String(!mobileNav.hidden));
    });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && !mobileNav.hidden) { closeMenu(); menu.focus(); } });
    document.addEventListener('click', event => { if (!mobileNav.hidden && !mobileNav.contains(event.target) && !menu.contains(event.target)) closeMenu(); });

    if (preview) document.getElementById('writing-preview-banner').hidden = false;
    if (!articles.length) { document.getElementById('writing-empty').hidden = false; return; }
    const featured = articles.find(article => article.featured);
    if (featured) {
      document.getElementById('writing-featured-section').hidden = false;
      document.getElementById('writing-featured').append(articleCard(featured, true));
    }
    collection.hidden = false;
    const remaining = articles.filter(article => article !== featured);
    const filters = document.getElementById('writing-filters');
    const grid = document.getElementById('writing-grid');
    const noResults = document.getElementById('writing-no-results');
    const count = document.getElementById('writing-count');
    const available = topics.filter(topic => topic === 'All' || articles.some(article => article.topic === topic));
    let selected = new URLSearchParams(location.search).get('topic') || 'All';
    filters.innerHTML = '';
    const buttons = available.map(topic => {
      const button = el('button', 'writing-filter', topic);
      button.type = 'button';
      button.addEventListener('click', () => { selected = topic; render(); });
      filters.append(button);
      return button;
    });
    let search = '';
    if (remaining.length >= 12) {
      const input = el('input', 'writing-search');
      input.type = 'search';
      input.placeholder = 'Search titles and excerpts';
      input.setAttribute('aria-label', 'Search titles and excerpts');
      input.addEventListener('input', () => { search = input.value.trim().toLocaleLowerCase(); render(); });
      filters.after(input);
    }
    document.getElementById('writing-clear-filters').addEventListener('click', () => { selected = 'All'; search = ''; const input = document.querySelector('.writing-search'); if (input) input.value = ''; render(); });
    function render() {
      buttons.forEach(button => button.setAttribute('aria-pressed', String(button.textContent === selected)));
      const defaultView = selected === 'All' && !search;
      if (featured) document.getElementById('writing-featured-section').hidden = !defaultView;
      const displayArticles = (defaultView && remaining.length > 0) ? remaining : articles;
      const matches = displayArticles.filter(article => (selected === 'All' || article.topic === selected) && (!search || `${article.title} ${article.excerpt}`.toLocaleLowerCase().includes(search)));
      grid.replaceChildren(...matches.map(article => articleCard(article)));
      grid.hidden = !matches.length;
      noResults.hidden = !!matches.length;
      count.textContent = `${matches.length} ${matches.length === 1 ? 'piece' : 'pieces'}`;
    }
    render();
  }
  latest();
  writingPage();
})();

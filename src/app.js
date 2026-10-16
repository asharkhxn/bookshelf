import { catalogue, genres, filterBooks } from './books.js';

const $ = selector => document.querySelector(selector);
const state = { books: catalogue.map(book => ({...book})), query: '', genre: 'All', detailId: null };
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const tooltip = $('#book-tooltip');
let toastTimer;
let detailOrigin;

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text != null) element.textContent = text;
  return element;
}
function paintBook(element, book) {
  element.style.setProperty('--book-color', book.color);
  element.style.setProperty('--book-ink', book.ink);
}
function visibleBooks(status) {
  return filterBooks(state.books.filter(book => book.status === status), state.query, state.genre);
}
function bookButton(book) {
  const slot = node('div', 'book-slot');
  paintBook(slot, book);
  slot.style.setProperty('--w', `${book.width}px`);
  slot.style.setProperty('--h', `${book.height}px`);
  slot.style.setProperty('--lean', `${book.lean}deg`);
  slot.style.setProperty('--title-size', `${Math.max(8.5, Math.min(15, book.width * .33))}px`);
  const button = node('button', `book face-${book.face}${book.width >= 44 ? ' wide' : ''}`);
  button.type = 'button';
  button.dataset.bookId = book.id;
  button.setAttribute('aria-label', `${book.title} by ${book.author}`);
  const object = node('span', 'book-object');
  object.setAttribute('aria-hidden', 'true');
  const spine = node('span', 'spine');
  const texture = node('img', 'spine-cover');
  texture.src = book.cover.replace('-L.jpg', '-M.jpg');
  texture.alt = '';
  texture.loading = 'lazy';
  texture.draggable = false;
  texture.addEventListener('error', () => texture.remove(), {once:true});
  spine.append(texture);
  const title = node('span', 'spine-title');
  title.append(node('span', '', book.title));
  spine.append(title);
  if (book.width >= 44) spine.append(node('span', 'spine-author', book.author));
  spine.append(node('span', 'spine-mark', ['✦', '◈', '●', 'Ⅰ'][Number(book.id.replace(/\D/g, '')) % 4]));
  const front = node('span', 'book-front');
  front.append(node('strong', '', book.title), node('small', '', book.author));
  const frontCover = node('img', 'front-cover');
  frontCover.src = book.cover.replace('-L.jpg', '-M.jpg');
  frontCover.alt = '';
  frontCover.loading = 'lazy';
  frontCover.draggable = false;
  frontCover.addEventListener('error', () => frontCover.remove(), {once:true});
  front.append(frontCover);
  object.append(spine, front, node('span', 'book-top'));
  button.append(object);
  button.addEventListener('click', () => {
    if (button.closest('.shelf-viewport').dataset.dragged === 'true') return;
    detailOrigin = button;
    openBook(book.id);
  });
  const showTooltip = () => {
    const rect = button.getBoundingClientRect();
    tooltip.replaceChildren(node('strong', '', book.title), node('span', '', book.author), node('small', '', `${book.genre} · ${book.status === 'read' ? 'Read' : 'To read'}`));
    tooltip.style.left = `${Math.max(134, Math.min(innerWidth - 134, rect.left + rect.width / 2))}px`;
    tooltip.style.top = `${rect.top - 38}px`;
    tooltip.hidden = false;
  };
  button.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch' && !button.closest('.dragging')) showTooltip(); });
  button.addEventListener('focus', showTooltip);
  button.addEventListener('pointerleave', hideTooltip);
  button.addEventListener('blur', hideTooltip);
  slot.append(button);
  return slot;
}
function hideTooltip() { tooltip.hidden = true; }
function render() {
  const read = visibleBooks('read');
  const unread = visibleBooks('to-read');
  const filtered = state.query.trim() || state.genre !== 'All';
  $('#volume-count').textContent = `${read.length} ${filtered ? 'matching ' : ''}${read.length === 1 ? 'volume' : 'volumes'}`;
  $('#to-read-count').textContent = `${unread.length} ${unread.length === 1 ? 'book' : 'books'}`;
  $('#clear-search').hidden = !state.query;
  for (const [status, books] of [['read', read], ['to-read', unread]]) {
    const track = $(`#${status}-track`);
    track.replaceChildren(...books.map(bookButton));
    if (!books.length) track.append(node('p', 'empty-state', 'No books here just yet. Try another search.'));
    $(`#${status}-shelf`).scrollLeft = 0;
    positionSpines($(`#${status}-shelf`));
  }
  hideTooltip();
}
function positionSpines(viewport) {
  const rect = viewport.getBoundingClientRect();
  for (const book of viewport.querySelectorAll('.book')) {
    const box = book.getBoundingClientRect();
    const offset = Math.max(-1, Math.min(1, (box.left + box.width / 2 - rect.width / 2) / (rect.width / 2)));
    book.style.setProperty('--ry', `${Math.sign(offset) * Math.abs(offset) ** 1.35 * 34}deg`);
  }
}
for (const genre of genres) {
  const button = node('button', 'pill', genre);
  button.type = 'button';
  button.setAttribute('aria-pressed', String(genre === 'All'));
  button.addEventListener('click', () => {
    state.genre = genre;
    for (const other of $('#genre-filters').children) other.setAttribute('aria-pressed', String(other === button));
    render();
  });
  $('#genre-filters').append(button);
}
$('#shelf-search').addEventListener('input', event => { state.query = event.target.value; render(); });
$('#clear-search').addEventListener('click', () => { state.query = ''; $('#shelf-search').value = ''; render(); $('#shelf-search').focus(); });
for (const viewport of document.querySelectorAll('.shelf-viewport')) {
  let start = null;
  let frame;
  viewport.addEventListener('scroll', () => {
    hideTooltip();
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => positionSpines(viewport));
  }, {passive: true});
  viewport.addEventListener('wheel', event => {
    if (viewport.scrollWidth <= viewport.clientWidth || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
    const atStart = viewport.scrollLeft <= 0 && event.deltaY < 0;
    const atEnd = viewport.scrollLeft + viewport.clientWidth >= viewport.scrollWidth - 1 && event.deltaY > 0;
    if (atStart || atEnd) return;
    event.preventDefault();
    viewport.scrollLeft += event.deltaY;
  }, {passive: false});
  viewport.addEventListener('pointerdown', event => {
    viewport.dataset.dragged = 'false';
    if (event.pointerType === 'touch' || event.button !== 0) return;
    start = { x: event.clientX, left: viewport.scrollLeft };
  });
  viewport.addEventListener('pointermove', event => {
    if (!start) return;
    if (Math.abs(event.clientX - start.x) > 5) {
      viewport.dataset.dragged = 'true';
      viewport.classList.add('dragging');
      hideTooltip();
      viewport.scrollLeft = start.left - (event.clientX - start.x);
    }
  });
  const stopDrag = () => { start = null; viewport.classList.remove('dragging'); };
  window.addEventListener('pointerup', stopDrag);
  viewport.addEventListener('pointerleave', stopDrag);
  viewport.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    viewport.scrollBy({left: event.key === 'ArrowRight' ? 260 : -260, behavior: reducedMotion.matches ? 'instant' : 'smooth'});
  });
}
window.addEventListener('resize', () => { hideTooltip(); document.querySelectorAll('.shelf-viewport').forEach(positionSpines); });

function closeDialog(dialog) { dialog.close(); }
function bindDialog(dialog) {
  dialog.addEventListener('click', event => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) closeDialog(dialog);
    if (event.target.closest('[data-close]')) closeDialog(dialog);
  });
  dialog.addEventListener('close', () => { document.body.style.overflow = ''; hideTooltip(); });
}
function showDialog(dialog) { hideTooltip(); dialog.showModal(); document.body.style.overflow = 'hidden'; }
for (const dialog of document.querySelectorAll('dialog')) bindDialog(dialog);

function openBook(id) {
  const book = state.books.find(book => book.id === id);
  if (!book) return;
  state.detailId = id;
  const dialog = $('#book-dialog');
  const close = node('button', 'close-dialog', '×');
  close.dataset.close = '';
  close.setAttribute('aria-label', 'Close book details');
  const layout = node('div', 'detail-layout');
  const cover = node('div', 'detail-cover');
  paintBook(cover, book);
  const coverType = node('div', 'cover-type');
  coverType.append(node('strong', '', book.title), node('span', '', book.author));
  const image = node('img');
  image.src = book.cover;
  image.alt = `${book.title} book cover`;
  image.addEventListener('error', () => image.remove(), {once:true});
  cover.append(coverType, image);
  const info = node('div', 'detail-info');
  const title = node('h2', '', book.title);
  title.id = 'detail-title';
  info.append(node('p', 'eyebrow', book.status === 'read' ? 'On the finished shelf' : 'Still to be discovered'), title, node('p', 'detail-author', book.author), node('span', 'detail-genre', book.genre), node('p', 'detail-description', 'Every book leaves a little something behind. This is where your thoughts, favourite passages, and rating will live.'), node('p', 'detail-isbn', `ISBN ${book.isbn}`));
  layout.append(cover, info);
  const navigation = node('div', 'detail-navigation');
  const previous = node('button', '', '← Previous');
  previous.setAttribute('aria-label', 'Previous book');
  previous.addEventListener('click', () => stepBook(-1));
  const next = node('button', '', 'Next →');
  next.setAttribute('aria-label', 'Next book');
  next.addEventListener('click', () => stepBook(1));
  navigation.append(previous, node('span', '', 'Example book · Preview'), next);
  dialog.replaceChildren(close, layout, navigation);
  if (!dialog.open) showDialog(dialog);
}
function stepBook(direction) {
  const current = state.books.find(book => book.id === state.detailId);
  const books = visibleBooks(current.status);
  const index = books.findIndex(book => book.id === current.id);
  if (books.length) openBook(books[(index + direction + books.length) % books.length].id);
}
$('#book-dialog').addEventListener('keydown', event => {
  if (event.key === 'ArrowRight') { event.preventDefault(); stepBook(1); }
  if (event.key === 'ArrowLeft') { event.preventDefault(); stepBook(-1); }
});
$('#book-dialog').addEventListener('close', () => { if (detailOrigin?.isConnected) detailOrigin.focus({preventScroll:true}); });
function toast(message) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 4200);
}
function lookup() {
  const query = $('#lookup').value;
  const results = filterBooks(catalogue, query).slice(0, 4);
  $('#lookup-results').replaceChildren(...results.map(book => {
    const row = node('div', 'result');
    const jacket = node('span', 'result-jacket', '✦');
    paintBook(jacket, book);
    const meta = node('div', 'result-meta');
    meta.append(node('strong', '', book.title), node('small', '', book.author));
    const added = state.books.some(item => item.id === book.id && item.status === 'to-read');
    const button = node('button', '', added ? 'On your shelf' : 'To read ＋');
    button.type = 'button';
    button.disabled = added;
    button.setAttribute('aria-label', added ? `${book.title} is on your to-read shelf` : `Add ${book.title} to your to-read shelf`);
    button.addEventListener('click', () => {
      // Preview-only state: do not imply the example data is permanently saved.
      const existing = state.books.find(item => item.id === book.id);
      if (existing) existing.status = 'to-read';
      else state.books.push({...book, status:'to-read'});
      state.query = '';
      state.genre = 'All';
      $('#shelf-search').value = '';
      for (const filter of $('#genre-filters').children) filter.setAttribute('aria-pressed', String(filter.textContent === 'All'));
      render();
      closeDialog($('#add-dialog'));
      const target = document.querySelector(`#to-read-track [data-book-id="${book.id}"]`);
      target?.scrollIntoView({behavior: reducedMotion.matches ? 'instant' : 'smooth', block:'center', inline:'center'});
      toast(`“${book.title}” moved to the to-read shelf. Preview only — resets on refresh.`);
    });
    row.append(jacket, meta, button);
    return row;
  }));
  if (!results.length) $('#lookup-results').append(node('p', 'empty-state', 'No sample matches. Try “Dune” or “Atomic Habits”.'));
}
$('#lookup-form').addEventListener('submit', event => { event.preventDefault(); lookup(); });
$('#lookup').addEventListener('input', lookup);
$('#add-book').addEventListener('click', () => { $('#lookup').value = ''; lookup(); showDialog($('#add-dialog')); $('#lookup').focus(); });
$('#about-preview').addEventListener('click', () => showDialog($('#about-dialog')));
render();

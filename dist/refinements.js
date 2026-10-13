(() => {
  const cards = Array.from(document.querySelectorAll('.journey-strip > div'));
  cards.forEach(card => {
    card.setAttribute('role', 'button'); card.setAttribute('tabindex', '0'); card.setAttribute('aria-pressed', 'false');
    const select = () => { const selected = card.getAttribute('aria-pressed') !== 'true'; cards.forEach(item => item.setAttribute('aria-pressed', String(item === card && selected))); };
    card.addEventListener('click', select);
    card.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(); } });
  });
  document.querySelector('#contact-form').addEventListener('submit', event => {
    event.preventDefault(); const form = event.currentTarget; if (!form.reportValidity()) return;
    const email = form.elements.email.value.trim(), request = form.elements.request.value.trim(), message = form.elements.message.value.trim();
    if (!request || !message) { document.querySelector('#contact-status').textContent = 'Please enter a request and message.'; return; }
    window.location.href = 'mailto:is.meinguyen@gmail.com?subject=' + encodeURIComponent(request) + '&body=' + encodeURIComponent('Reply email: ' + email + '\n\n' + message);
    document.querySelector('#contact-status').textContent = 'Email draft opened. Please send it from your email app; nothing has been sent automatically.';
  });
})();
// Progressive enhancement: content stays visible without observer support.
(() => {
  if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add('is-visible'); entry.target.classList.remove('reveal-ready'); observer.unobserve(entry.target); }
  }), {threshold:0.08});
  document.querySelectorAll('.project-card,.project-group-heading,.solution-card').forEach(element => {
    element.classList.add('scroll-reveal','reveal-ready'); observer.observe(element);
  });
})();

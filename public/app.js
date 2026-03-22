const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  },
  { threshold: 0.2 }
);

const fadeTargets = document.querySelectorAll('.section, .hero, .cta-section, .page-hero');
fadeTargets.forEach((el) => {
  el.classList.add('fade-in');
  observer.observe(el);
});

const countUp = (el, target) => {
  let current = 0;
  const increment = Math.max(1, Math.floor(target / 60));
  const tick = () => {
    current += increment;
    if (current >= target) {
      el.textContent = target;
      return;
    }
    el.textContent = current;
    requestAnimationFrame(tick);
  };
  tick();
};

const metricObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseInt(el.dataset.count, 10);
        if (!Number.isNaN(target) && !el.dataset.counted) {
          el.dataset.counted = 'true';
          countUp(el, target);
        }
      }
    });
  },
  { threshold: 0.6 }
);

const metrics = document.querySelectorAll('[data-count]');
metrics.forEach((el) => metricObserver.observe(el));

const form = document.querySelector('#pilot-form');
const statusEl = document.querySelector('#form-status');

if (form && statusEl) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    statusEl.textContent = 'Submitting...';

    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    try {
      const response = await fetch('/api/request-pilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Request failed');
      }

      statusEl.textContent = 'Thanks! We will reach out within 48 hours.';
      form.reset();
    } catch (error) {
      statusEl.textContent = 'Something went wrong. Please try again later.';
    }
  });
}

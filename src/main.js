const menu = document.querySelector('.menu-button');
const nav = document.querySelector('#site-nav');
const header = document.querySelector('.site-header');

function setMenu(open, restoreFocus = false) {
  nav.classList.toggle('open', open);
  menu.setAttribute('aria-expanded', String(open));
  menu.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  menu.textContent = open ? 'close' : 'menu';
  if (restoreFocus) menu.focus();
}

menu.addEventListener('click', () => setMenu(menu.getAttribute('aria-expanded') !== 'true'));
nav.addEventListener('click', event => {
  if (event.target.closest('a')) setMenu(false);
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') setMenu(false, true);
});
matchMedia('(min-width: 701px)').addEventListener('change', event => {
  if (event.matches) setMenu(false);
});

const preference = matchMedia('(prefers-color-scheme: dark)');
const systemTheme = () => preference.matches ? 'dark' : 'light';
const safeStorage = {
  get() { try { return localStorage.getItem('autonome-theme'); } catch { return null; } },
  set(value) { try { localStorage.setItem('autonome-theme', value); } catch { /* theme still applies for this page */ } }
};
const savedTheme = safeStorage.get();
if (savedTheme === 'light' || savedTheme === 'dark') {
  document.documentElement.dataset.theme = savedTheme;
  document.documentElement.dataset.themeSource = 'saved';
}

const themeToggle = document.createElement('button');
themeToggle.className = 'theme-toggle';
themeToggle.type = 'button';
header.append(themeToggle);

function updateThemeButton() {
  const current = document.documentElement.dataset.theme || systemTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  document.querySelectorAll('img[src="/mark.svg"], img[src="/mark-dark.svg"]').forEach(mark => {
    mark.src = current === 'dark' || mark.closest('.about-page') ? '/mark-dark.svg' : '/mark.svg';
  });
  themeToggle.textContent = next === 'dark' ? '●' : '○';
  themeToggle.setAttribute('aria-label', `Current theme: ${current}. Use ${next} mode`);
  themeToggle.title = `Use ${next} mode`;
}

updateThemeButton();
themeToggle.addEventListener('click', () => {
  const current = document.documentElement.dataset.theme || systemTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  document.documentElement.dataset.themeSource = 'saved';
  safeStorage.set(next);
  updateThemeButton();
});
preference.addEventListener('change', () => {
  if (document.documentElement.dataset.themeSource === 'system') {
    document.documentElement.dataset.theme = systemTheme();
    updateThemeButton();
  }
});

const sections = document.querySelectorAll('.section-content');
if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.classList.add('visible');
    });
  }, { threshold: 0.12 });
  sections.forEach(section => {
    section.classList.add('reveal');
    observer.observe(section);
  });
}

const menu = document.querySelector('.menu-button');
const nav = document.querySelector('#site-nav');

menu.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  menu.setAttribute('aria-expanded', String(open));
  menu.textContent = open ? 'close' : 'menu';
});

nav.addEventListener('click', (event) => {
  if (event.target.closest('.theme-toggle')) return;
  nav.classList.remove('open');
  menu.setAttribute('aria-expanded', 'false');
  menu.textContent = 'menu';
});

const systemTheme = () => matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
const savedTheme = localStorage.getItem('autonome-theme');
if (savedTheme) document.documentElement.dataset.theme = savedTheme;

const themeToggle = document.createElement('button');
themeToggle.className = 'theme-toggle';
themeToggle.type = 'button';
nav.append(themeToggle);

function updateThemeButton() {
  const current = document.documentElement.dataset.theme || systemTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  document.querySelectorAll('img[src="/mark.svg"], img[src="/mark-dark.svg"]').forEach((mark) => {
    mark.src = current === 'dark' ? '/mark-dark.svg' : '/mark.svg';
  });
  themeToggle.textContent = next === 'dark' ? '●' : '○';
  themeToggle.setAttribute('aria-label', `Use ${next} mode`);
  themeToggle.title = `Use ${next} mode`;
}

updateThemeButton();
themeToggle.addEventListener('click', () => {
  const current = document.documentElement.dataset.theme || systemTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('autonome-theme', next);
  updateThemeButton();
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (!document.documentElement.dataset.theme) updateThemeButton();
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) entry.target.classList.add('visible');
  });
}, { threshold: 0.12 });

document.querySelectorAll('.section-content').forEach((section) => {
  section.classList.add('reveal');
  observer.observe(section);
});

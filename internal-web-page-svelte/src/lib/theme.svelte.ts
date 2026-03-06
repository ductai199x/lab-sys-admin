let dark = $state(false);

export function initTheme() {
	if (typeof window === 'undefined') return;
	const stored = localStorage.getItem('theme');
	if (stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
		dark = true;
	}
	applyTheme();
}

function applyTheme() {
	if (typeof document === 'undefined') return;
	document.documentElement.classList.toggle('dark', dark);
}

export function toggleTheme() {
	dark = !dark;
	localStorage.setItem('theme', dark ? 'dark' : 'light');
	applyTheme();
}

export function isDark(): boolean {
	return dark;
}

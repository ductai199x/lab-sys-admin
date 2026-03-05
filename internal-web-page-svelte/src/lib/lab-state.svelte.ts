export type PageId = 'overview' | 'gpu' | 'cpu' | 'disk' | 'processes' | 'alerts';

let activePage: PageId = $state('overview');
let alertCount: number = $state(0);

export function getActivePage(): PageId {
	return activePage;
}

export function setActivePage(page: PageId) {
	activePage = page;
}

export function getAlertCount(): number {
	return alertCount;
}

export function setAlertCount(count: number) {
	alertCount = count;
}

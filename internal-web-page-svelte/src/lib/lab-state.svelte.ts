export type PageId = 'overview' | 'gpu' | 'cpu' | 'disk' | 'processes' | 'alerts' | 'machine-detail';

let activePage: PageId = $state('overview');
let previousPage: PageId = $state('overview');
let alertCount: number = $state(0);
let searchQuery: string = $state('');
let selectedMachine: string = $state('');

export function getActivePage(): PageId {
	return activePage;
}

export function setActivePage(page: PageId) {
	if (page !== 'machine-detail') {
		previousPage = activePage === 'machine-detail' ? previousPage : activePage;
	}
	activePage = page;
}

export function getPreviousPage(): PageId {
	return previousPage;
}

export function getAlertCount(): number {
	return alertCount;
}

export function setAlertCount(count: number) {
	alertCount = count;
}

export function getSearchQuery(): string {
	return searchQuery;
}

export function setSearchQuery(query: string) {
	searchQuery = query;
}

export function getSelectedMachine(): string {
	return selectedMachine;
}

export function setSelectedMachine(hostname: string) {
	selectedMachine = hostname;
	setActivePage('machine-detail');
}

export function goBackFromDetail() {
	selectedMachine = '';
	activePage = previousPage;
}

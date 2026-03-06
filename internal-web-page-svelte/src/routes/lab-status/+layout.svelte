<script lang="ts">
	import {
		LayoutGrid,
		Monitor,
		Cpu,
		HardDrive,
		Activity,
		Bell,
		RefreshCw,
		Sun,
		Moon,
		Menu,
		X
	} from 'lucide-svelte';
	import { cn } from '$lib/utils';
	import { initTheme, toggleTheme, isDark } from '$lib/theme.svelte';
	import { type PageId, getActivePage, setActivePage, getAlertCount, getSearchQuery, setSearchQuery, getSelectedMachine, goBackFromDetail } from '$lib/lab-state.svelte';
	import { ChevronLeft } from 'lucide-svelte';
	import { onMount } from 'svelte';

	let { children } = $props();

	let mobileMenuOpen = $state(false);

	const pageTitles: Record<PageId, string> = {
		overview: 'Overview',
		gpu: 'GPU',
		cpu: 'CPU & RAM',
		disk: 'Disk',
		processes: 'Processes',
		alerts: 'Alerts',
		'machine-detail': 'Machine Detail'
	};

	function getPageTitle(): string {
		const page = getActivePage();
		if (page === 'machine-detail') {
			return getSelectedMachine() || 'Machine Detail';
		}
		return pageTitles[page];
	}

	const navItems: { id: PageId; label: string; section: 'monitor' | 'system' }[] = [
		{ id: 'overview', label: 'Overview', section: 'monitor' },
		{ id: 'gpu', label: 'GPU', section: 'monitor' },
		{ id: 'cpu', label: 'CPU & RAM', section: 'monitor' },
		{ id: 'disk', label: 'Disk', section: 'monitor' },
		{ id: 'processes', label: 'Processes', section: 'monitor' },
		{ id: 'alerts', label: 'Alerts', section: 'system' }
	];

	function handleRefresh() {
		window.dispatchEvent(new CustomEvent('lab-refresh'));
	}

	function handleMobileNav(id: PageId) {
		setActivePage(id);
		mobileMenuOpen = false;
	}

	onMount(() => {
		initTheme();
	});
</script>

<svelte:head>
	<title>{pageTitles[getActivePage()]} - MISL Lab Dashboard</title>
</svelte:head>

<div class="flex min-h-screen">
	<!-- Desktop Sidebar -->
	<aside class="w-[220px] min-h-screen bg-sidebar-bg fixed left-0 top-0 bottom-0 z-50 flex flex-col py-6 px-4 max-md:hidden">
		<!-- Brand -->
		<div class="flex items-center gap-3 px-2 mb-8">
			<div class="w-[38px] h-[38px] rounded-[10px] bg-gradient-to-br from-[#3b7dd8] to-[#2d9d5e] flex items-center justify-center font-extrabold text-base text-white">
				M
			</div>
			<div class="text-white font-bold text-[17px] tracking-tight">MISL Lab</div>
		</div>

		<!-- Navigation -->
		<nav class="flex flex-col gap-1 flex-1">
			<div class="text-[10px] font-bold tracking-[1.2px] uppercase text-[#555860] px-3 pt-4 pb-1.5">
				Monitor
			</div>
			{#each navItems.filter((n) => n.section === 'monitor') as item}
				<button
					class={cn(
						'flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-sm font-medium w-full text-left transition-all duration-150 cursor-pointer',
						getActivePage() === item.id
							? 'bg-sidebar-active text-sidebar-text-active'
							: 'text-sidebar-text hover:bg-sidebar-hover hover:text-[#d0d3da]'
					)}
					onclick={() => setActivePage(item.id)}
				>
					{#if item.id === 'overview'}
						<LayoutGrid class="size-[18px] shrink-0" />
					{:else if item.id === 'gpu'}
						<Monitor class="size-[18px] shrink-0" />
					{:else if item.id === 'cpu'}
						<Cpu class="size-[18px] shrink-0" />
					{:else if item.id === 'disk'}
						<HardDrive class="size-[18px] shrink-0" />
					{:else if item.id === 'processes'}
						<Activity class="size-[18px] shrink-0" />
					{/if}
					{item.label}
				</button>
			{/each}

			<div class="text-[10px] font-bold tracking-[1.2px] uppercase text-[#555860] px-3 pt-4 pb-1.5">
				System
			</div>
			{#each navItems.filter((n) => n.section === 'system') as item}
				<button
					class={cn(
						'flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-sm font-medium w-full text-left transition-all duration-150 cursor-pointer',
						getActivePage() === item.id
							? 'bg-sidebar-active text-sidebar-text-active'
							: 'text-sidebar-text hover:bg-sidebar-hover hover:text-[#d0d3da]'
					)}
					onclick={() => setActivePage(item.id)}
				>
					<Bell class="size-[18px] shrink-0" />
					{item.label}
					{#if item.id === 'alerts' && getAlertCount() > 0}
						<span class="ml-auto bg-red-card text-white text-[10px] font-bold py-px px-[7px] rounded-full min-w-[20px] text-center">
							{getAlertCount()}
						</span>
					{/if}
				</button>
			{/each}
		</nav>

		<!-- Footer -->
		<div class="border-t border-sidebar-border pt-4 mt-2 flex flex-col gap-1">
			<button
				class="flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-sm font-medium w-full text-left text-sidebar-text hover:bg-sidebar-hover hover:text-[#d0d3da] transition-all duration-150 cursor-pointer"
				onclick={toggleTheme}
			>
				{#if isDark()}
					<Sun class="size-[18px] shrink-0" />
					Light Mode
				{:else}
					<Moon class="size-[18px] shrink-0" />
					Dark Mode
				{/if}
			</button>
			<button
				class="flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-sm font-medium w-full text-left text-sidebar-text hover:bg-sidebar-hover hover:text-[#d0d3da] transition-all duration-150 cursor-pointer"
				onclick={handleRefresh}
			>
				<RefreshCw class="size-[18px] shrink-0" />
				Refresh Data
			</button>
		</div>
	</aside>

	<!-- Mobile Menu Overlay -->
	{#if mobileMenuOpen}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="fixed inset-0 z-[60] bg-[rgba(26,29,35,0.5)] backdrop-blur-sm md:hidden"
			onclick={() => (mobileMenuOpen = false)}
			onkeydown={(e) => { if (e.key === 'Escape') mobileMenuOpen = false; }}
		></div>
	{/if}

	<!-- Mobile Sidebar Drawer -->
	<aside
		class={cn(
			'fixed left-0 top-0 bottom-0 z-[70] w-[260px] bg-sidebar-bg flex flex-col py-6 px-4 transition-transform duration-300 ease-in-out md:hidden',
			mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
		)}
	>
		<!-- Brand + Close -->
		<div class="flex items-center justify-between px-2 mb-8">
			<div class="flex items-center gap-3">
				<div class="w-[38px] h-[38px] rounded-[10px] bg-gradient-to-br from-[#3b7dd8] to-[#2d9d5e] flex items-center justify-center font-extrabold text-base text-white">
					M
				</div>
				<div class="text-white font-bold text-[17px] tracking-tight">MISL Lab</div>
			</div>
			<button
				class="flex items-center justify-center w-8 h-8 rounded-md text-sidebar-text hover:text-white hover:bg-sidebar-hover transition-colors cursor-pointer"
				onclick={() => (mobileMenuOpen = false)}
				aria-label="Close menu"
			>
				<X class="size-5" />
			</button>
		</div>

		<!-- Mobile Navigation -->
		<nav class="flex flex-col gap-1 flex-1 overflow-y-auto">
			<div class="text-[10px] font-bold tracking-[1.2px] uppercase text-[#555860] px-3 pt-4 pb-1.5">
				Monitor
			</div>
			{#each navItems.filter((n) => n.section === 'monitor') as item}
				<button
					class={cn(
						'flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-sm font-medium w-full text-left transition-all duration-150 cursor-pointer',
						getActivePage() === item.id
							? 'bg-sidebar-active text-sidebar-text-active'
							: 'text-sidebar-text hover:bg-sidebar-hover hover:text-[#d0d3da]'
					)}
					onclick={() => handleMobileNav(item.id)}
				>
					{#if item.id === 'overview'}
						<LayoutGrid class="size-[18px] shrink-0" />
					{:else if item.id === 'gpu'}
						<Monitor class="size-[18px] shrink-0" />
					{:else if item.id === 'cpu'}
						<Cpu class="size-[18px] shrink-0" />
					{:else if item.id === 'disk'}
						<HardDrive class="size-[18px] shrink-0" />
					{:else if item.id === 'processes'}
						<Activity class="size-[18px] shrink-0" />
					{/if}
					{item.label}
				</button>
			{/each}

			<div class="text-[10px] font-bold tracking-[1.2px] uppercase text-[#555860] px-3 pt-4 pb-1.5">
				System
			</div>
			{#each navItems.filter((n) => n.section === 'system') as item}
				<button
					class={cn(
						'flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-sm font-medium w-full text-left transition-all duration-150 cursor-pointer',
						getActivePage() === item.id
							? 'bg-sidebar-active text-sidebar-text-active'
							: 'text-sidebar-text hover:bg-sidebar-hover hover:text-[#d0d3da]'
					)}
					onclick={() => handleMobileNav(item.id)}
				>
					<Bell class="size-[18px] shrink-0" />
					{item.label}
					{#if item.id === 'alerts' && getAlertCount() > 0}
						<span class="ml-auto bg-red-card text-white text-[10px] font-bold py-px px-[7px] rounded-full min-w-[20px] text-center">
							{getAlertCount()}
						</span>
					{/if}
				</button>
			{/each}
		</nav>

		<!-- Mobile Footer -->
		<div class="border-t border-sidebar-border pt-4 mt-2 flex flex-col gap-1">
			<button
				class="flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-sm font-medium w-full text-left text-sidebar-text hover:bg-sidebar-hover hover:text-[#d0d3da] transition-all duration-150 cursor-pointer"
				onclick={toggleTheme}
			>
				{#if isDark()}
					<Sun class="size-[18px] shrink-0" />
					Light Mode
				{:else}
					<Moon class="size-[18px] shrink-0" />
					Dark Mode
				{/if}
			</button>
			<button
				class="flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-sm font-medium w-full text-left text-sidebar-text hover:bg-sidebar-hover hover:text-[#d0d3da] transition-all duration-150 cursor-pointer"
				onclick={() => { handleRefresh(); mobileMenuOpen = false; }}
			>
				<RefreshCw class="size-[18px] shrink-0" />
				Refresh Data
			</button>
		</div>
	</aside>

	<!-- Main Area -->
	<div class="flex-1 ml-[220px] min-h-screen max-md:ml-0">
		<!-- Top Bar -->
		<header class="flex items-center gap-4 px-8 max-md:px-4 py-4 bg-background border-b border-border-light sticky top-0 z-40">
			<!-- Mobile hamburger -->
			<button
				class="md:hidden flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-card hover:bg-muted transition-colors cursor-pointer shrink-0"
				onclick={() => (mobileMenuOpen = true)}
				aria-label="Open menu"
			>
				<Menu class="size-5" />
			</button>
			{#if getActivePage() === 'machine-detail'}
				<button
					class="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
					onclick={goBackFromDetail}
				>
					<ChevronLeft class="size-4" />
					Back
				</button>
			{/if}
			<div class="text-[22px] max-md:text-lg font-extrabold tracking-tight flex-1">{getPageTitle()}</div>
			<div class="flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-card text-sm text-muted-foreground min-w-[260px] max-md:hidden">
				<svg class="size-4 opacity-40 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
				<input
					type="text"
					placeholder="Search machines, users, processes..."
					class="border-none bg-transparent outline-none font-sans text-sm text-foreground w-full placeholder:text-muted-foreground"
					value={getSearchQuery()}
					oninput={(e) => setSearchQuery(e.currentTarget.value)}
				/>
				{#if getSearchQuery()}
					<button
						class="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
						onclick={() => setSearchQuery('')}
						aria-label="Clear search"
					>
						<X class="size-3.5" />
					</button>
				{/if}
			</div>
			<div class="size-9 rounded-full bg-gradient-to-br from-[#3b7dd8] to-[#2d9d5e] flex items-center justify-center text-white font-bold text-sm shrink-0">
				T
			</div>
		</header>

		<!-- Page Content -->
		<div class="p-7 px-8 max-md:p-4">
			{@render children()}
		</div>
	</div>
</div>

<script lang="ts">
	import type { Snippet } from "svelte";

	let {
		open = $bindable(false),
		onClose,
		children,
	}: {
		open?: boolean;
		onClose?: () => void;
		children?: Snippet;
	} = $props();

	let previouslyFocused: HTMLElement | null = null;
	let overlayEl: HTMLDivElement | undefined = $state(undefined);

	function handleKeydown(e: KeyboardEvent) {
		if (open && e.key === "Escape") {
			e.stopPropagation();
			open = false;
			onClose?.();
		}
	}

	function handleBackdropClick(e: MouseEvent) {
		if ((e.target as HTMLElement).dataset.slot === "dialog-overlay") {
			open = false;
			onClose?.();
		}
	}

	function trapFocus(e: KeyboardEvent) {
		if (e.key !== "Tab" || !overlayEl) return;

		const focusable = overlayEl.querySelectorAll<HTMLElement>(
			'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
		);
		if (focusable.length === 0) return;

		const first = focusable[0];
		const last = focusable[focusable.length - 1];

		if (e.shiftKey) {
			if (document.activeElement === first) {
				e.preventDefault();
				last.focus();
			}
		} else {
			if (document.activeElement === last) {
				e.preventDefault();
				first.focus();
			}
		}
	}

	$effect(() => {
		if (open) {
			previouslyFocused = document.activeElement as HTMLElement | null;
			// Focus the first focusable element inside the dialog after it mounts
			requestAnimationFrame(() => {
				if (overlayEl) {
					const focusable = overlayEl.querySelector<HTMLElement>(
						'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
					);
					focusable?.focus();
				}
			});
		} else {
			// Restore focus when dialog closes
			if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
				previouslyFocused.focus();
				previouslyFocused = null;
			}
		}
	});
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}

	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		bind:this={overlayEl}
		data-slot="dialog-overlay"
		class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-in fade-in-0"
		onclick={handleBackdropClick}
		onkeydown={trapFocus}
	>
		{@render children?.()}
	</div>
{/if}

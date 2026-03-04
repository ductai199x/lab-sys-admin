<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";
	import { cn } from "$lib/utils";

	let {
		class: className,
		value,
		active = false,
		children,
		...restProps
	}: HTMLAttributes<HTMLDivElement> & {
		value?: string;
		active?: boolean;
		children?: Snippet;
	} = $props();
</script>

{#if active}
	<div
		data-slot="tabs-content"
		role="tabpanel"
		class={cn("flex-1 outline-none", className)}
		{...restProps}
	>
		{@render children?.()}
	</div>
{/if}

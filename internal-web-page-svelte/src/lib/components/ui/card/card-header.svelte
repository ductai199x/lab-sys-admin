<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";
	import { cn } from "$lib/utils";

	let {
		class: className,
		children,
		...restProps
	}: HTMLAttributes<HTMLDivElement> & { children?: Snippet } = $props();
</script>

<div
	data-slot="card-header"
	class={cn(
		"flex flex-col gap-1.5 px-6 has-data-[slot=card-action]:flex-row has-data-[slot=card-action]:items-center has-data-[slot=card-action]:justify-between",
		className,
	)}
	{...restProps}
>
	{@render children?.()}
</div>

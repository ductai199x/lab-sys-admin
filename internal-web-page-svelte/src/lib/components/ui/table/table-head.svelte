<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLThAttributes } from "svelte/elements";
	import { cn } from "$lib/utils";

	let {
		class: className,
		children,
		...restProps
	}: HTMLThAttributes & { children?: Snippet } = $props();
</script>

<th
	data-slot="table-head"
	class={cn(
		"text-muted-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
		className,
	)}
	{...restProps}
>
	{@render children?.()}
</th>

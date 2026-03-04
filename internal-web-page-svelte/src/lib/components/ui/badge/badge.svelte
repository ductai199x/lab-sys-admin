<script lang="ts">
	import { cn } from "$lib/utils";
	import { badgeVariants, type BadgeProps } from "./index.js";

	let {
		class: className,
		variant = "default",
		children,
		...restProps
	}: BadgeProps = $props();
</script>

<span
	data-slot="badge"
	class={cn(badgeVariants({ variant }), className)}
	{...restProps}
>
	{@render children?.()}
</span>

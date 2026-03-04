<script lang="ts">
	import { cn } from "$lib/utils";
	import { buttonVariants, type ButtonProps } from "./index.js";

	let {
		class: className,
		variant = "default",
		size = "default",
		children,
		...restProps
	}: ButtonProps = $props();
</script>

<button
	data-slot="button"
	class={cn(buttonVariants({ variant, size }), className)}
	{...restProps}
>
	{@render children?.()}
</button>

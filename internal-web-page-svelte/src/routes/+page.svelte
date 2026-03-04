<script lang="ts">
	import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "$lib/components/ui/card";
	import { Monitor, ArrowRight, Server } from "lucide-svelte";
</script>

<svelte:head>
	<title>Welcome to MISL Lab</title>
	<meta name="description" content="MISL Lab Home Page" />
</svelte:head>

<div class="min-h-screen flex flex-col items-center justify-center px-4 sm:px-8">
	<main class="flex flex-col items-center gap-10 max-w-3xl w-full py-16">
		<div class="flex flex-col items-center gap-3 text-center">
			<div class="flex items-center justify-center size-16 rounded-2xl bg-primary/10 mb-2">
				<Server class="size-8 text-primary" />
			</div>
			<h1 class="text-4xl sm:text-5xl font-bold tracking-tight">
				Welcome to <a
					href="https://misl.ece.drexel.edu/"
					class="text-primary hover:text-primary/80 transition-colors"
				>MISL Lab</a>
			</h1>
			<p class="text-muted-foreground text-lg">
				Multimedia Information Systems Laboratory @ Drexel University
			</p>
		</div>

		<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
			<a href="/lab-status" class="group no-underline">
				<Card class="h-full transition-all duration-200 hover:shadow-md hover:border-primary/50 group-hover:-translate-y-0.5">
					<CardHeader>
						<div class="flex items-center gap-3">
							<div class="flex items-center justify-center size-10 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
								<Monitor class="size-5 text-primary" />
							</div>
							<div class="flex-1">
								<CardTitle class="text-base">Lab Machine Status</CardTitle>
								<CardDescription>Monitor GPU, CPU, RAM, and disk usage</CardDescription>
							</div>
							<ArrowRight class="size-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
						</div>
					</CardHeader>
				</Card>
			</a>
		</div>
	</main>
</div>

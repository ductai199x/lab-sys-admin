<svelte:head>
	<title>Welcome to MISL Lab</title>
	<meta name="description" content="MISL Lab Home Page" />
</svelte:head>

<div class="container">
	<main>
		<h1>
			Welcome to <a href="https://misl.ece.drexel.edu/">MISL Lab @ Drexel University</a>
		</h1>

		<div class="grid">
			<a href="/lab-status" class="card">
				<h2>Lab Machine Status</h2>
				<p>A page detailing the statuses of the lab&apos;s machines</p>
			</a>
		</div>
	</main>
</div>

<style>
	.container {
		padding: 0 2rem;
	}

	main {
		min-height: 100vh;
		padding: 4rem 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
	}

	h1 {
		margin: 0;
		line-height: 1.15;
		font-size: 3rem;
		text-align: center;
	}

	h1 a {
		color: var(--color-primary);
	}

	.grid {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-wrap: wrap;
		max-width: 800px;
		margin-top: 3rem;
	}

	.card {
		margin: 1rem;
		padding: 2rem;
		text-align: left;
		color: inherit;
		text-decoration: none;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
		box-shadow: var(--shadow);
		transition: border-color 0.2s ease, box-shadow 0.2s ease;
		max-width: 340px;
	}

	.card:hover {
		border-color: var(--color-primary);
		box-shadow: var(--shadow-lg);
		text-decoration: none;
	}

	.card h2 {
		margin: 0 0 0.75rem 0;
		font-size: 1.4rem;
	}

	.card p {
		margin: 0;
		font-size: 1.1rem;
		line-height: 1.5;
		color: var(--color-text-muted);
	}

	@media (max-width: 600px) {
		.grid {
			width: 100%;
			flex-direction: column;
		}
	}
</style>

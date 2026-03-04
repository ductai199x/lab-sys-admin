import { json } from '@sveltejs/kit';
import { createClient } from 'redis';
import type { RequestHandler } from './$types';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const KNOWN_MACHINES = (process.env.KNOWN_MACHINES || '').split(',').filter(Boolean);

let redisClient: ReturnType<typeof createClient> | null = null;
let connectPromise: Promise<ReturnType<typeof createClient>> | null = null;

async function getRedisClient() {
	if (redisClient?.isOpen) return redisClient;
	if (connectPromise) return connectPromise;

	connectPromise = (async () => {
		try {
			const client = createClient({ url: REDIS_URL });
			client.on('error', (err) => console.error('Redis client error:', err));
			await client.connect();
			redisClient = client;
			return client;
		} finally {
			connectPromise = null;
		}
	})();

	return connectPromise;
}

export const GET: RequestHandler = async () => {
	try {
		const client = await getRedisClient();
		const keys = await client.keys('machine:*');

		const machines: Record<string, unknown> = {};
		if (keys.length > 0) {
			const values = await client.mGet(keys);
			for (const raw of values) {
				if (raw) {
					try {
						const data = JSON.parse(raw);
						if (data.hostname) {
							machines[data.hostname] = data;
						}
					} catch {
						// skip malformed entries
					}
				}
			}
		}

		return json({
			machines,
			known_machines: KNOWN_MACHINES,
			fetched_at: new Date().toISOString(),
			machine_count: Object.keys(machines).length
		});
	} catch (err) {
		console.error('Failed to read from Redis:', err);
		redisClient = null;
		connectPromise = null;
		return json(
			{
				error: 'Failed to fetch machine data',
				machines: {},
				known_machines: KNOWN_MACHINES,
				fetched_at: new Date().toISOString(),
				machine_count: 0
			},
			{ status: 503 }
		);
	}
};

import { json } from '@sveltejs/kit';
import { createClient } from 'redis';
import type { RequestHandler } from './$types';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const KNOWN_MACHINES = (process.env.KNOWN_MACHINES || '').split(',').filter(Boolean);

let redisClient: ReturnType<typeof createClient> | null = null;

async function getRedisClient() {
	if (!redisClient || !redisClient.isOpen) {
		redisClient = createClient({ url: REDIS_URL });
		redisClient.on('error', (err) => console.error('Redis client error:', err));
		await redisClient.connect();
	}
	return redisClient;
}

export const GET: RequestHandler = async () => {
	try {
		const client = await getRedisClient();
		const keys = await client.keys('machine:*');

		const machines: Record<string, unknown> = {};
		for (const key of keys) {
			const raw = await client.get(key);
			if (raw) {
				try {
					const data = JSON.parse(raw);
					machines[data.hostname] = data;
				} catch {
					// skip malformed entries
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

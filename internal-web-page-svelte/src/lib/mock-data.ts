import type { MachineData, MachinesResponse } from './types';

/**
 * Generate a mock timestamp relative to "now" so time-since displays look realistic.
 * Offset is in seconds (negative = in the past).
 */
function recentTimestamp(offsetSeconds: number = 0): string {
	return new Date(Date.now() + offsetSeconds * 1000).toISOString();
}

function buildMockMachines(): Record<string, MachineData> {
	return {
		// ── lab3001: moderate GPU use, healthy CPU/RAM ──────────────────
		lab3001: {
			hostname: 'lab3001',
			timestamp: recentTimestamp(-5),
			gpu: {
				available: true,
				driver_version: '550.127.05',
				gpus: [
					{
						index: 0,
						name: 'NVIDIA RTX A6000',
						memory: { total_mib: 49140, used_mib: 12480, free_mib: 36660 },
						utilization: { gpu_percent: 34, memory_percent: 25 },
						temperature_c: 52,
						clocks: { graphics_mhz: 1410, sm_mhz: 1410, memory_mhz: 8001 },
						power: { usage_watts: 125, limit_watts: 300 },
						processes: [
							{
								pid: 19201,
								gpu_memory_mib: 8192,
								type: 'C',
								user: 'tai',
								command: 'python train_segmentation.py --epochs 100',
								cpu_percent: 45.2,
								ram_mib: 4200
							},
							{
								pid: 19250,
								gpu_memory_mib: 4288,
								type: 'C',
								user: 'tai',
								command: 'python eval_model.py --checkpoint best.pt',
								cpu_percent: 12.8,
								ram_mib: 2100
							}
						]
					},
					{
						index: 1,
						name: 'NVIDIA RTX A6000',
						memory: { total_mib: 49140, used_mib: 2, free_mib: 49138 },
						utilization: { gpu_percent: 0, memory_percent: 0 },
						temperature_c: 35,
						clocks: { graphics_mhz: 210, sm_mhz: 210, memory_mhz: 405 },
						power: { usage_watts: 22, limit_watts: 300 },
						processes: []
					}
				]
			},
			cpu: {
				percent: 23.4,
				per_core: [30, 18, 45, 12, 22, 8, 35, 15, 28, 10, 42, 5, 20, 16, 32, 14],
				load_average: { '1min': 3.21, '5min': 2.87, '15min': 2.45 },
				count_logical: 16,
				count_physical: 8
			},
			ram: {
				total_mib: 131072,
				used_mib: 42300,
				free_mib: 56772,
				cached_mib: 32000
			},
			disk: {
				partitions: [
					{
						mountpoint: '/',
						device: '/dev/nvme0n1p2',
						fstype: 'ext4',
						total_gib: 468.0,
						used_gib: 142.3,
						free_gib: 301.8,
						percent: 30.4
					},
					{
						mountpoint: '/data',
						device: '/dev/sda1',
						fstype: 'ext4',
						total_gib: 3726.0,
						used_gib: 1845.2,
						free_gib: 1880.8,
						percent: 49.5
					}
				]
			},
			processes: {
				top_by_cpu: [
					{ pid: 19201, user: 'tai', name: 'python', command: 'python train_segmentation.py --epochs 100', cpu_percent: 45.2, ram_mib: 4200 },
					{ pid: 19250, user: 'tai', name: 'python', command: 'python eval_model.py --checkpoint best.pt', cpu_percent: 12.8, ram_mib: 2100 },
					{ pid: 1842, user: 'root', name: 'Xorg', command: '/usr/lib/xorg/Xorg :0', cpu_percent: 3.1, ram_mib: 320 },
					{ pid: 2104, user: 'root', name: 'dockerd', command: '/usr/bin/dockerd -H fd://', cpu_percent: 1.4, ram_mib: 180 },
					{ pid: 1, user: 'root', name: 'systemd', command: '/sbin/init', cpu_percent: 0.1, ram_mib: 12 }
				],
				top_by_memory: [
					{ pid: 19201, user: 'tai', name: 'python', command: 'python train_segmentation.py --epochs 100', cpu_percent: 45.2, ram_mib: 4200 },
					{ pid: 19250, user: 'tai', name: 'python', command: 'python eval_model.py --checkpoint best.pt', cpu_percent: 12.8, ram_mib: 2100 },
					{ pid: 1842, user: 'root', name: 'Xorg', command: '/usr/lib/xorg/Xorg :0', cpu_percent: 3.1, ram_mib: 320 },
					{ pid: 2104, user: 'root', name: 'dockerd', command: '/usr/bin/dockerd -H fd://', cpu_percent: 1.4, ram_mib: 180 },
					{ pid: 1, user: 'root', name: 'systemd', command: '/sbin/init', cpu_percent: 0.1, ram_mib: 12 }
				]
			}
		},

		// ── lab3002: heavy GPU use (both GPUs), high CPU ────────────────
		lab3002: {
			hostname: 'lab3002',
			timestamp: recentTimestamp(-8),
			gpu: {
				available: true,
				driver_version: '550.127.05',
				gpus: [
					{
						index: 0,
						name: 'NVIDIA GeForce RTX 3090',
						memory: { total_mib: 24576, used_mib: 22100, free_mib: 2476 },
						utilization: { gpu_percent: 97, memory_percent: 90 },
						temperature_c: 78,
						clocks: { graphics_mhz: 1950, sm_mhz: 1950, memory_mhz: 9751 },
						power: { usage_watts: 340, limit_watts: 350 },
						processes: [
							{
								pid: 45210,
								gpu_memory_mib: 21800,
								type: 'C',
								user: 'shengbang',
								command: 'python -m torch.distributed.launch --nproc_per_gpu=1 train_llm.py',
								cpu_percent: 89.5,
								ram_mib: 16200
							}
						]
					},
					{
						index: 1,
						name: 'NVIDIA GeForce RTX 3090',
						memory: { total_mib: 24576, used_mib: 19500, free_mib: 5076 },
						utilization: { gpu_percent: 85, memory_percent: 79 },
						temperature_c: 74,
						clocks: { graphics_mhz: 1890, sm_mhz: 1890, memory_mhz: 9751 },
						power: { usage_watts: 310, limit_watts: 350 },
						processes: [
							{
								pid: 45211,
								gpu_memory_mib: 19200,
								type: 'C',
								user: 'shengbang',
								command: 'python -m torch.distributed.launch --nproc_per_gpu=1 train_llm.py',
								cpu_percent: 82.1,
								ram_mib: 14800
							}
						]
					}
				]
			},
			cpu: {
				percent: 87.2,
				per_core: [95, 92, 88, 91, 85, 90, 78, 82, 94, 88, 76, 84, 91, 87, 80, 86, 93, 89, 77, 83, 90, 85, 88, 92],
				load_average: { '1min': 18.42, '5min': 17.05, '15min': 15.22 },
				count_logical: 24,
				count_physical: 12
			},
			ram: {
				total_mib: 131072,
				used_mib: 98500,
				free_mib: 8572,
				cached_mib: 24000
			},
			disk: {
				partitions: [
					{
						mountpoint: '/',
						device: '/dev/nvme0n1p2',
						fstype: 'ext4',
						total_gib: 468.0,
						used_gib: 210.5,
						free_gib: 233.6,
						percent: 45.0
					},
					{
						mountpoint: '/data',
						device: '/dev/sda1',
						fstype: 'ext4',
						total_gib: 3726.0,
						used_gib: 3350.8,
						free_gib: 375.2,
						percent: 89.9
					}
				]
			},
			processes: {
				top_by_cpu: [
					{ pid: 45210, user: 'shengbang', name: 'python', command: 'python -m torch.distributed.launch --nproc_per_gpu=1 train_llm.py', cpu_percent: 89.5, ram_mib: 16200 },
					{ pid: 45211, user: 'shengbang', name: 'python', command: 'python -m torch.distributed.launch --nproc_per_gpu=1 train_llm.py', cpu_percent: 82.1, ram_mib: 14800 },
					{ pid: 3201, user: 'shengbang', name: 'python', command: 'python preprocess_data.py --input /data/raw', cpu_percent: 15.3, ram_mib: 8400 },
					{ pid: 1842, user: 'root', name: 'Xorg', command: '/usr/lib/xorg/Xorg :0', cpu_percent: 2.4, ram_mib: 290 },
					{ pid: 2104, user: 'root', name: 'dockerd', command: '/usr/bin/dockerd -H fd://', cpu_percent: 1.1, ram_mib: 165 }
				],
				top_by_memory: [
					{ pid: 45210, user: 'shengbang', name: 'python', command: 'python -m torch.distributed.launch --nproc_per_gpu=1 train_llm.py', cpu_percent: 89.5, ram_mib: 16200 },
					{ pid: 45211, user: 'shengbang', name: 'python', command: 'python -m torch.distributed.launch --nproc_per_gpu=1 train_llm.py', cpu_percent: 82.1, ram_mib: 14800 },
					{ pid: 3201, user: 'shengbang', name: 'python', command: 'python preprocess_data.py --input /data/raw', cpu_percent: 15.3, ram_mib: 8400 },
					{ pid: 1842, user: 'root', name: 'Xorg', command: '/usr/lib/xorg/Xorg :0', cpu_percent: 2.4, ram_mib: 290 },
					{ pid: 2104, user: 'root', name: 'dockerd', command: '/usr/bin/dockerd -H fd://', cpu_percent: 1.1, ram_mib: 165 }
				]
			}
		},

		// ── lab3003: idle machine, GPUs available ───────────────────────
		lab3003: {
			hostname: 'lab3003',
			timestamp: recentTimestamp(-3),
			gpu: {
				available: true,
				driver_version: '550.127.05',
				gpus: [
					{
						index: 0,
						name: 'NVIDIA GeForce RTX 3090',
						memory: { total_mib: 24576, used_mib: 4, free_mib: 24572 },
						utilization: { gpu_percent: 0, memory_percent: 0 },
						temperature_c: 32,
						clocks: { graphics_mhz: 210, sm_mhz: 210, memory_mhz: 405 },
						power: { usage_watts: 18, limit_watts: 350 },
						processes: []
					},
					{
						index: 1,
						name: 'NVIDIA GeForce RTX 3090',
						memory: { total_mib: 24576, used_mib: 4, free_mib: 24572 },
						utilization: { gpu_percent: 0, memory_percent: 0 },
						temperature_c: 30,
						clocks: { graphics_mhz: 210, sm_mhz: 210, memory_mhz: 405 },
						power: { usage_watts: 16, limit_watts: 350 },
						processes: []
					}
				]
			},
			cpu: {
				percent: 2.1,
				per_core: [3, 1, 4, 2, 1, 3, 2, 1, 4, 1, 2, 3, 1, 2, 3, 1],
				load_average: { '1min': 0.12, '5min': 0.08, '15min': 0.05 },
				count_logical: 16,
				count_physical: 8
			},
			ram: {
				total_mib: 65536,
				used_mib: 3200,
				free_mib: 48336,
				cached_mib: 14000
			},
			disk: {
				partitions: [
					{
						mountpoint: '/',
						device: '/dev/nvme0n1p2',
						fstype: 'ext4',
						total_gib: 468.0,
						used_gib: 85.1,
						free_gib: 359.0,
						percent: 18.2
					},
					{
						mountpoint: '/data',
						device: '/dev/sda1',
						fstype: 'ext4',
						total_gib: 1863.0,
						used_gib: 420.5,
						free_gib: 1442.5,
						percent: 22.6
					}
				]
			},
			processes: {
				top_by_cpu: [
					{ pid: 1842, user: 'root', name: 'Xorg', command: '/usr/lib/xorg/Xorg :0', cpu_percent: 1.2, ram_mib: 280 },
					{ pid: 2104, user: 'root', name: 'dockerd', command: '/usr/bin/dockerd -H fd://', cpu_percent: 0.4, ram_mib: 150 },
					{ pid: 1, user: 'root', name: 'systemd', command: '/sbin/init', cpu_percent: 0.1, ram_mib: 12 }
				],
				top_by_memory: [
					{ pid: 1842, user: 'root', name: 'Xorg', command: '/usr/lib/xorg/Xorg :0', cpu_percent: 1.2, ram_mib: 280 },
					{ pid: 2104, user: 'root', name: 'dockerd', command: '/usr/bin/dockerd -H fd://', cpu_percent: 0.4, ram_mib: 150 },
					{ pid: 1, user: 'root', name: 'systemd', command: '/sbin/init', cpu_percent: 0.1, ram_mib: 12 }
				]
			}
		},

		// ── lab3004: moderate use, single GPU busy ──────────────────────
		lab3004: {
			hostname: 'lab3004',
			timestamp: recentTimestamp(-12),
			gpu: {
				available: true,
				driver_version: '550.127.05',
				gpus: [
					{
						index: 0,
						name: 'NVIDIA GeForce RTX 4090',
						memory: { total_mib: 24564, used_mib: 18200, free_mib: 6364 },
						utilization: { gpu_percent: 72, memory_percent: 74 },
						temperature_c: 68,
						clocks: { graphics_mhz: 2520, sm_mhz: 2520, memory_mhz: 10501 },
						power: { usage_watts: 280, limit_watts: 450 },
						processes: [
							{
								pid: 8801,
								gpu_memory_mib: 14200,
								type: 'C',
								user: 'danial',
								command: 'python train_diffusion.py --config configs/v2.yaml',
								cpu_percent: 55.3,
								ram_mib: 9800
							},
							{
								pid: 8850,
								gpu_memory_mib: 4000,
								type: 'C',
								user: 'danial',
								command: 'python generate_samples.py --num 1000',
								cpu_percent: 22.1,
								ram_mib: 3200
							}
						]
					}
				]
			},
			cpu: {
				percent: 48.5,
				per_core: [65, 42, 58, 38, 52, 35, 60, 44, 48, 30, 55, 40, 50, 36, 62, 41, 46, 33, 57, 39],
				load_average: { '1min': 8.14, '5min': 7.52, '15min': 6.88 },
				count_logical: 20,
				count_physical: 10
			},
			ram: {
				total_mib: 131072,
				used_mib: 68400,
				free_mib: 32672,
				cached_mib: 30000
			},
			disk: {
				partitions: [
					{
						mountpoint: '/',
						device: '/dev/nvme0n1p2',
						fstype: 'ext4',
						total_gib: 468.0,
						used_gib: 198.4,
						free_gib: 245.7,
						percent: 42.4
					},
					{
						mountpoint: '/data',
						device: '/dev/sda1',
						fstype: 'ext4',
						total_gib: 7452.0,
						used_gib: 5420.1,
						free_gib: 2031.9,
						percent: 72.7
					}
				]
			},
			processes: {
				top_by_cpu: [
					{ pid: 8801, user: 'danial', name: 'python', command: 'python train_diffusion.py --config configs/v2.yaml', cpu_percent: 55.3, ram_mib: 9800 },
					{ pid: 8850, user: 'danial', name: 'python', command: 'python generate_samples.py --num 1000', cpu_percent: 22.1, ram_mib: 3200 },
					{ pid: 9100, user: 'danial', name: 'python', command: 'tensorboard --logdir runs/', cpu_percent: 4.5, ram_mib: 620 },
					{ pid: 1842, user: 'root', name: 'Xorg', command: '/usr/lib/xorg/Xorg :0', cpu_percent: 2.8, ram_mib: 310 },
					{ pid: 2104, user: 'root', name: 'dockerd', command: '/usr/bin/dockerd -H fd://', cpu_percent: 1.2, ram_mib: 170 }
				],
				top_by_memory: [
					{ pid: 8801, user: 'danial', name: 'python', command: 'python train_diffusion.py --config configs/v2.yaml', cpu_percent: 55.3, ram_mib: 9800 },
					{ pid: 8850, user: 'danial', name: 'python', command: 'python generate_samples.py --num 1000', cpu_percent: 22.1, ram_mib: 3200 },
					{ pid: 9100, user: 'danial', name: 'python', command: 'tensorboard --logdir runs/', cpu_percent: 4.5, ram_mib: 620 },
					{ pid: 1842, user: 'root', name: 'Xorg', command: '/usr/lib/xorg/Xorg :0', cpu_percent: 2.8, ram_mib: 310 },
					{ pid: 2104, user: 'root', name: 'dockerd', command: '/usr/bin/dockerd -H fd://', cpu_percent: 1.2, ram_mib: 170 }
				]
			}
		},

		// ── lab3005: no GPU machine, moderate CPU/RAM ───────────────────
		lab3005: {
			hostname: 'lab3005',
			timestamp: recentTimestamp(-6),
			gpu: {
				available: false,
				driver_version: null,
				gpus: []
			},
			cpu: {
				percent: 38.7,
				per_core: [42, 35, 50, 28, 40, 32, 45, 30],
				load_average: { '1min': 2.85, '5min': 3.12, '15min': 2.94 },
				count_logical: 8,
				count_physical: 4
			},
			ram: {
				total_mib: 32768,
				used_mib: 18500,
				free_mib: 6268,
				cached_mib: 8000
			},
			disk: {
				partitions: [
					{
						mountpoint: '/',
						device: '/dev/sda1',
						fstype: 'ext4',
						total_gib: 931.0,
						used_gib: 520.3,
						free_gib: 363.4,
						percent: 55.9
					}
				]
			},
			processes: {
				top_by_cpu: [
					{ pid: 7720, user: 'aref', name: 'python', command: 'python data_pipeline.py --workers 4', cpu_percent: 32.4, ram_mib: 5400 },
					{ pid: 7750, user: 'aref', name: 'python', command: 'jupyter-notebook --port 8888', cpu_percent: 5.1, ram_mib: 1200 },
					{ pid: 1842, user: 'root', name: 'Xorg', command: '/usr/lib/xorg/Xorg :0', cpu_percent: 1.8, ram_mib: 260 },
					{ pid: 2104, user: 'root', name: 'dockerd', command: '/usr/bin/dockerd -H fd://', cpu_percent: 0.8, ram_mib: 155 },
					{ pid: 1, user: 'root', name: 'systemd', command: '/sbin/init', cpu_percent: 0.1, ram_mib: 12 }
				],
				top_by_memory: [
					{ pid: 7720, user: 'aref', name: 'python', command: 'python data_pipeline.py --workers 4', cpu_percent: 32.4, ram_mib: 5400 },
					{ pid: 7750, user: 'aref', name: 'python', command: 'jupyter-notebook --port 8888', cpu_percent: 5.1, ram_mib: 1200 },
					{ pid: 1842, user: 'root', name: 'Xorg', command: '/usr/lib/xorg/Xorg :0', cpu_percent: 1.8, ram_mib: 260 },
					{ pid: 2104, user: 'root', name: 'dockerd', command: '/usr/bin/dockerd -H fd://', cpu_percent: 0.8, ram_mib: 155 },
					{ pid: 1, user: 'root', name: 'systemd', command: '/sbin/init', cpu_percent: 0.1, ram_mib: 12 }
				]
			}
		},

		// ── lab6001: 4x GPU machine, two GPUs busy ──────────────────────
		lab6001: {
			hostname: 'lab6001',
			timestamp: recentTimestamp(-4),
			gpu: {
				available: true,
				driver_version: '550.127.05',
				gpus: [
					{
						index: 0,
						name: 'NVIDIA A100-SXM4-80GB',
						memory: { total_mib: 81920, used_mib: 62400, free_mib: 19520 },
						utilization: { gpu_percent: 88, memory_percent: 76 },
						temperature_c: 65,
						clocks: { graphics_mhz: 1410, sm_mhz: 1410, memory_mhz: 1593 },
						power: { usage_watts: 290, limit_watts: 400 },
						processes: [
							{
								pid: 55100,
								gpu_memory_mib: 62000,
								type: 'C',
								user: 'tai',
								command: 'python train_foundation_model.py --config large_v3.yaml --gpus 0,1',
								cpu_percent: 92.4,
								ram_mib: 24500
							}
						]
					},
					{
						index: 1,
						name: 'NVIDIA A100-SXM4-80GB',
						memory: { total_mib: 81920, used_mib: 58200, free_mib: 23720 },
						utilization: { gpu_percent: 82, memory_percent: 71 },
						temperature_c: 62,
						clocks: { graphics_mhz: 1380, sm_mhz: 1380, memory_mhz: 1593 },
						power: { usage_watts: 275, limit_watts: 400 },
						processes: [
							{
								pid: 55101,
								gpu_memory_mib: 58000,
								type: 'C',
								user: 'tai',
								command: 'python train_foundation_model.py --config large_v3.yaml --gpus 0,1',
								cpu_percent: 88.1,
								ram_mib: 22000
							}
						]
					},
					{
						index: 2,
						name: 'NVIDIA A100-SXM4-80GB',
						memory: { total_mib: 81920, used_mib: 6, free_mib: 81914 },
						utilization: { gpu_percent: 0, memory_percent: 0 },
						temperature_c: 33,
						clocks: { graphics_mhz: 210, sm_mhz: 210, memory_mhz: 405 },
						power: { usage_watts: 52, limit_watts: 400 },
						processes: []
					},
					{
						index: 3,
						name: 'NVIDIA A100-SXM4-80GB',
						memory: { total_mib: 81920, used_mib: 6, free_mib: 81914 },
						utilization: { gpu_percent: 0, memory_percent: 0 },
						temperature_c: 31,
						clocks: { graphics_mhz: 210, sm_mhz: 210, memory_mhz: 405 },
						power: { usage_watts: 50, limit_watts: 400 },
						processes: []
					}
				]
			},
			cpu: {
				percent: 62.8,
				per_core: [78, 65, 82, 58, 70, 55, 75, 60, 68, 52, 72, 56, 80, 62, 74, 58, 66, 50, 71, 54, 76, 59, 73, 57, 69, 53, 77, 61, 67, 51, 70, 55],
				load_average: { '1min': 14.56, '5min': 13.21, '15min': 11.88 },
				count_logical: 32,
				count_physical: 16
			},
			ram: {
				total_mib: 524288,
				used_mib: 285000,
				free_mib: 139288,
				cached_mib: 100000
			},
			disk: {
				partitions: [
					{
						mountpoint: '/',
						device: '/dev/nvme0n1p2',
						fstype: 'ext4',
						total_gib: 931.0,
						used_gib: 285.4,
						free_gib: 598.2,
						percent: 30.7
					},
					{
						mountpoint: '/data',
						device: '/dev/md0',
						fstype: 'ext4',
						total_gib: 14902.0,
						used_gib: 8240.5,
						free_gib: 6661.5,
						percent: 55.3
					}
				]
			},
			processes: {
				top_by_cpu: [
					{ pid: 55100, user: 'tai', name: 'python', command: 'python train_foundation_model.py --config large_v3.yaml --gpus 0,1', cpu_percent: 92.4, ram_mib: 24500 },
					{ pid: 55101, user: 'tai', name: 'python', command: 'python train_foundation_model.py --config large_v3.yaml --gpus 0,1', cpu_percent: 88.1, ram_mib: 22000 },
					{ pid: 55200, user: 'tai', name: 'python', command: 'python data_loader_worker.py', cpu_percent: 18.5, ram_mib: 6400 },
					{ pid: 1842, user: 'root', name: 'Xorg', command: '/usr/lib/xorg/Xorg :0', cpu_percent: 1.9, ram_mib: 340 },
					{ pid: 2104, user: 'root', name: 'dockerd', command: '/usr/bin/dockerd -H fd://', cpu_percent: 1.3, ram_mib: 190 }
				],
				top_by_memory: [
					{ pid: 55100, user: 'tai', name: 'python', command: 'python train_foundation_model.py --config large_v3.yaml --gpus 0,1', cpu_percent: 92.4, ram_mib: 24500 },
					{ pid: 55101, user: 'tai', name: 'python', command: 'python train_foundation_model.py --config large_v3.yaml --gpus 0,1', cpu_percent: 88.1, ram_mib: 22000 },
					{ pid: 55200, user: 'tai', name: 'python', command: 'python data_loader_worker.py', cpu_percent: 18.5, ram_mib: 6400 },
					{ pid: 1842, user: 'root', name: 'Xorg', command: '/usr/lib/xorg/Xorg :0', cpu_percent: 1.9, ram_mib: 340 },
					{ pid: 2104, user: 'root', name: 'dockerd', command: '/usr/bin/dockerd -H fd://', cpu_percent: 1.3, ram_mib: 190 }
				]
			}
		},

		// ── lab6002: critical disk usage, high RAM ──────────────────────
		lab6002: {
			hostname: 'lab6002',
			timestamp: recentTimestamp(-15),
			gpu: {
				available: true,
				driver_version: '550.127.05',
				gpus: [
					{
						index: 0,
						name: 'NVIDIA GeForce RTX 3090',
						memory: { total_mib: 24576, used_mib: 8400, free_mib: 16176 },
						utilization: { gpu_percent: 42, memory_percent: 34 },
						temperature_c: 55,
						clocks: { graphics_mhz: 1695, sm_mhz: 1695, memory_mhz: 9751 },
						power: { usage_watts: 180, limit_watts: 350 },
						processes: [
							{
								pid: 33010,
								gpu_memory_mib: 8200,
								type: 'C',
								user: 'aref',
								command: 'python inference_server.py --model resnet152 --port 5000',
								cpu_percent: 28.4,
								ram_mib: 4800
							}
						]
					}
				]
			},
			cpu: {
				percent: 55.3,
				per_core: [62, 48, 70, 45, 58, 52, 64, 42, 55, 50, 68, 44, 60, 47, 66, 43],
				load_average: { '1min': 7.82, '5min': 8.15, '15min': 7.45 },
				count_logical: 16,
				count_physical: 8
			},
			ram: {
				total_mib: 131072,
				used_mib: 122000,
				free_mib: 1072,
				cached_mib: 8000
			},
			disk: {
				partitions: [
					{
						mountpoint: '/',
						device: '/dev/nvme0n1p2',
						fstype: 'ext4',
						total_gib: 468.0,
						used_gib: 442.8,
						free_gib: 1.3,
						percent: 94.6
					},
					{
						mountpoint: '/data',
						device: '/dev/sda1',
						fstype: 'ext4',
						total_gib: 3726.0,
						used_gib: 3510.2,
						free_gib: 215.8,
						percent: 94.2
					}
				]
			},
			processes: {
				top_by_cpu: [
					{ pid: 33010, user: 'aref', name: 'python', command: 'python inference_server.py --model resnet152 --port 5000', cpu_percent: 28.4, ram_mib: 4800 },
					{ pid: 33200, user: 'aref', name: 'python', command: 'python benchmark_suite.py --all', cpu_percent: 22.8, ram_mib: 12000 },
					{ pid: 33350, user: 'misl-admin', name: 'rsync', command: 'rsync -avz /data/backup/ remote:/archive/', cpu_percent: 12.1, ram_mib: 850 },
					{ pid: 1842, user: 'root', name: 'Xorg', command: '/usr/lib/xorg/Xorg :0', cpu_percent: 2.2, ram_mib: 300 },
					{ pid: 2104, user: 'root', name: 'dockerd', command: '/usr/bin/dockerd -H fd://', cpu_percent: 1.0, ram_mib: 160 }
				],
				top_by_memory: [
					{ pid: 33200, user: 'aref', name: 'python', command: 'python benchmark_suite.py --all', cpu_percent: 22.8, ram_mib: 12000 },
					{ pid: 33010, user: 'aref', name: 'python', command: 'python inference_server.py --model resnet152 --port 5000', cpu_percent: 28.4, ram_mib: 4800 },
					{ pid: 33350, user: 'misl-admin', name: 'rsync', command: 'rsync -avz /data/backup/ remote:/archive/', cpu_percent: 12.1, ram_mib: 850 },
					{ pid: 1842, user: 'root', name: 'Xorg', command: '/usr/lib/xorg/Xorg :0', cpu_percent: 2.2, ram_mib: 300 },
					{ pid: 2104, user: 'root', name: 'dockerd', command: '/usr/bin/dockerd -H fd://', cpu_percent: 1.0, ram_mib: 160 }
				]
			}
		}

		// lab100 is intentionally omitted to appear as "Offline" in the dashboard
	};
}

export function getMockResponse(): MachinesResponse {
	const machines = buildMockMachines();
	return {
		machines,
		known_machines: [
			'lab3001',
			'lab3002',
			'lab3003',
			'lab3004',
			'lab3005',
			'lab6001',
			'lab6002',
			'lab100'
		],
		fetched_at: new Date().toISOString(),
		machine_count: Object.keys(machines).length
	};
}

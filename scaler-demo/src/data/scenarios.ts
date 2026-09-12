import type { Scenario } from '../types'

const createNoiseGenerator = (base: number, range: number) => {
  let value = base
  return () => {
    const change = (Math.random() - 0.5) * range
    value = Math.max(base - range / 2, Math.min(base + range / 2, value + change))
    return Math.round(value)
  }
}

const createSpikeGenerator = (base: number, maxSpike: number, spikeChance: number = 0.1) => {
  let value = base
  return () => {
    if (Math.random() < spikeChance) {
      value = Math.min(maxSpike, base + Math.random() * (maxSpike - base))
    } else {
      value = Math.max(base * 0.7, value * 0.95)
    }
    return Math.round(value)
  }
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'normal',
    name: 'Normal Operation',
    description: 'Steady baseline load with minor fluctuations',
    metricGenerators: {
      'checkout-api-cpu': createNoiseGenerator(55, 20),
      'events-worker-sqs': createNoiseGenerator(2000, 800),
      'cache-layer-cpu': createNoiseGenerator(40, 15),
      'webhook-receiver-rps': createNoiseGenerator(1100, 300),
      'pdf-renderer-active': () => 0
    }
  },
  {
    id: 'sqs-spike',
    name: 'SQS Spike',
    description: 'Sudden spike in queue depth; triggers scale recommendations',
    metricGenerators: {
      'checkout-api-cpu': createNoiseGenerator(65, 15),
      'events-worker-sqs': createSpikeGenerator(2000, 8000, 0.2),
      'cache-layer-cpu': createNoiseGenerator(48, 18),
      'webhook-receiver-rps': createNoiseGenerator(1200, 250),
      'pdf-renderer-active': () => 0
    }
  },
  {
    id: 'off-peak',
    name: 'Off-Peak Hours',
    description: 'Low traffic; suggests scale-down to save costs',
    metricGenerators: {
      'checkout-api-cpu': createNoiseGenerator(20, 10),
      'events-worker-sqs': createNoiseGenerator(300, 150),
      'cache-layer-cpu': createNoiseGenerator(15, 8),
      'webhook-receiver-rps': createNoiseGenerator(200, 100),
      'pdf-renderer-active': () => 0
    }
  },
  {
    id: 'sustained-load',
    name: 'Sustained High Load',
    description: 'Consistent high CPU and traffic; maintains scaled state',
    metricGenerators: {
      'checkout-api-cpu': createNoiseGenerator(78, 10),
      'events-worker-sqs': createNoiseGenerator(5500, 1200),
      'cache-layer-cpu': createNoiseGenerator(72, 12),
      'webhook-receiver-rps': createNoiseGenerator(2800, 400),
      'pdf-renderer-active': () => 5
    }
  }
]

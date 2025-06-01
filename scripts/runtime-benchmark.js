#!/usr/bin/env node

/**
 * Runtime Performance Benchmark Script
 * Compares performance between Node.js and Edge runtime endpoints
 */

const fetch = require('node-fetch').default || require('node-fetch');

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

async function benchmarkEndpoint(url, name, iterations = 10) {
  console.log(`\n🔥 Benchmarking ${name}...`);
  
  const times = [];
  let successCount = 0;
  
  for (let i = 0; i < iterations; i++) {
    try {
      const start = Date.now();
      const response = await fetch(url);
      const end = Date.now();
      
      if (response.ok) {
        successCount++;
        times.push(end - start);
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Request ${i + 1} failed:`, error.message);
    }
  }
  
  if (times.length === 0) {
    console.log(`❌ ${name}: All requests failed`);
    return null;
  }
  
  const average = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  const median = times.sort((a, b) => a - b)[Math.floor(times.length / 2)];
  
  console.log(`✅ ${name}:`);
  console.log(`   Success Rate: ${successCount}/${iterations} (${(successCount/iterations*100).toFixed(1)}%)`);
  console.log(`   Average: ${average.toFixed(2)}ms`);
  console.log(`   Median: ${median}ms`);
  console.log(`   Min: ${min}ms`);
  console.log(`   Max: ${max}ms`);
  
  return { average, median, min, max, successCount, name };
}

async function runBenchmarks() {
  console.log('🚀 Starting Runtime Performance Benchmarks...');
  console.log(`Base URL: ${BASE_URL}`);
  
  const endpoints = [
    {
      url: `${BASE_URL}/api/health`,
      name: 'Health Check (Node.js Runtime)',
    },
    {
      url: `${BASE_URL}/api/health/edge`,
      name: 'Health Check (Edge Runtime)',
    },
    {
      url: `${BASE_URL}/api/templates`,
      name: 'Templates (Edge Runtime)',
    },
  ];
  
  const results = [];
  
  for (const endpoint of endpoints) {
    const result = await benchmarkEndpoint(endpoint.url, endpoint.name);
    if (result) {
      results.push(result);
    }
  }
  
  // Summary comparison
  console.log('\n📊 Performance Summary:');
  console.log('='.repeat(60));
  
  results.sort((a, b) => a.average - b.average);
  
  results.forEach((result, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
    console.log(`${medal} ${result.name}: ${result.average.toFixed(2)}ms avg`);
  });
  
  // Edge vs Node.js comparison
  const edgeResults = results.filter(r => r.name.includes('Edge'));
  const nodeResults = results.filter(r => r.name.includes('Node.js'));
  
  if (edgeResults.length > 0 && nodeResults.length > 0) {
    const edgeAvg = edgeResults.reduce((sum, r) => sum + r.average, 0) / edgeResults.length;
    const nodeAvg = nodeResults.reduce((sum, r) => sum + r.average, 0) / nodeResults.length;
    const improvement = ((nodeAvg - edgeAvg) / nodeAvg * 100);
    
    console.log('\n🔥 Runtime Comparison:');
    console.log(`Edge Runtime Average: ${edgeAvg.toFixed(2)}ms`);
    console.log(`Node.js Runtime Average: ${nodeAvg.toFixed(2)}ms`);
    console.log(`Edge Runtime is ${improvement.toFixed(1)}% faster`);
  }
  
  console.log('\n✅ Benchmark completed!');
}

// Run benchmarks
runBenchmarks().catch(console.error); 
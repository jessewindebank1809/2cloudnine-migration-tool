#!/usr/bin/env node

const fetch = require('node-fetch').default || require('node-fetch');
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

async function testRoute(path, name) {
  const start = Date.now();
  try {
    const response = await fetch(`${BASE_URL}${path}`);
    const end = Date.now();
    console.log(`${name}: ${end - start}ms - ${response.status}`);
    return end - start;
  } catch (error) {
    console.log(`${name}: FAILED - ${error.message}`);
    return null;
  }
}

async function runTests() {
  console.log('🚀 Route Speed Tests');
  
  const tests = [
    ['/api/health/fast', 'Health (Ultra Fast)'],
    ['/api/health/edge', 'Health (Edge)'],
    ['/api/health', 'Health (Slow DB)'],
    ['/api/templates', 'Templates (Edge)'],
    ['/fast-home', 'Fast Home (No Auth)'],
    ['/', 'Home (With Auth)'],
  ];

  for (const [path, name] of tests) {
    await testRoute(path, name);
    await new Promise(r => setTimeout(r, 100));
  }
}

runTests(); 
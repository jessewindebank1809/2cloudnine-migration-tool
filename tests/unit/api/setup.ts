/**
 * Test setup for API route tests
 * Provides proper polyfills for Web APIs used in Next.js API routes
 */

// Polyfill TextEncoder/TextDecoder
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any;

// Polyfill Web APIs
if (!global.Headers) {
  global.Headers = class Headers {
    private headers: Map<string, string>;

    constructor(init?: HeadersInit) {
      this.headers = new Map();
      if (init) {
        if (init instanceof Headers) {
          init.forEach((value, key) => {
            this.headers.set(key.toLowerCase(), value);
          });
        } else if (Array.isArray(init)) {
          init.forEach(([key, value]) => {
            this.headers.set(key.toLowerCase(), value);
          });
        } else if (typeof init === 'object') {
          Object.entries(init).forEach(([key, value]) => {
            this.headers.set(key.toLowerCase(), String(value));
          });
        }
      }
    }

    get(name: string): string | null {
      return this.headers.get(name.toLowerCase()) || null;
    }

    set(name: string, value: string): void {
      this.headers.set(name.toLowerCase(), value);
    }

    has(name: string): boolean {
      return this.headers.has(name.toLowerCase());
    }

    delete(name: string): void {
      this.headers.delete(name.toLowerCase());
    }

    forEach(callback: (value: string, key: string, parent: Headers) => void): void {
      this.headers.forEach((value, key) => {
        callback(value, key, this);
      });
    }

    *entries(): IterableIterator<[string, string]> {
      for (const entry of Array.from(this.headers.entries())) {
        yield entry;
      }
    }

    *keys(): IterableIterator<string> {
      for (const key of Array.from(this.headers.keys())) {
        yield key;
      }
    }

    *values(): IterableIterator<string> {
      for (const value of Array.from(this.headers.values())) {
        yield value;
      }
    }

    [Symbol.iterator](): IterableIterator<[string, string]> {
      return this.entries();
    }
  } as any;
}

if (!global.Request) {
  global.Request = class Request {
    url: string;
    method: string;
    headers: Headers;
    body: any;

    constructor(input: RequestInfo | URL, init?: RequestInit) {
      this.url = String(input);
      this.method = init?.method || 'GET';
      this.headers = new Headers(init?.headers);
      this.body = init?.body;
    }

    async json() {
      if (typeof this.body === 'string') {
        return JSON.parse(this.body);
      }
      return this.body;
    }

    async text() {
      if (typeof this.body === 'string') {
        return this.body;
      }
      return JSON.stringify(this.body);
    }
  } as any;
}

if (!global.Response) {
  global.Response = class Response {
    body: any;
    status: number;
    statusText: string;
    headers: Headers;
    ok: boolean;

    constructor(body?: BodyInit | null, init?: ResponseInit) {
      this.body = body;
      this.status = init?.status || 200;
      this.statusText = init?.statusText || '';
      this.headers = new Headers(init?.headers);
      this.ok = this.status >= 200 && this.status < 300;
    }

    async json() {
      if (typeof this.body === 'string') {
        return JSON.parse(this.body);
      }
      return this.body;
    }

    async text() {
      if (typeof this.body === 'string') {
        return this.body;
      }
      return JSON.stringify(this.body);
    }
  } as any;
}
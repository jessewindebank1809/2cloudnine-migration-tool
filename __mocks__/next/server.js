class NextRequest {
  constructor(input, init) {
    this.url = String(input);
    this.method = init?.method || 'GET';
    this.headers = new Headers(init?.headers);
    this._body = init?.body;
  }

  async json() {
    if (typeof this._body === 'string') {
      return JSON.parse(this._body);
    }
    return this._body;
  }

  async text() {
    if (typeof this._body === 'string') {
      return this._body;
    }
    return JSON.stringify(this._body);
  }
}

class NextResponse extends Response {
  static json(data, init) {
    const response = new Response(JSON.stringify(data), {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(init?.headers || {})
      }
    });
    
    // Add json() method to the response
    response.json = async () => data;
    
    return response;
  }
}

module.exports = { NextRequest, NextResponse };
import { describe, it, expect, beforeEach } from '@jest/globals';

// Mock modules before imports
jest.mock('@/lib/auth/session-helper');
jest.mock('@/lib/slack/client');
jest.mock('@/lib/github/client');
jest.mock('@sentry/nextjs');

import { POST } from '@/app/api/feedback/route';
import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/session-helper';
import { SlackClient } from '@/lib/slack/client';
import { GitHubClient } from '@/lib/github/client';
import * as Sentry from '@sentry/nextjs';

const mockRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>;
const mockSlackClient = SlackClient as jest.MockedClass<typeof SlackClient>;
const mockGitHubClient = GitHubClient as jest.MockedClass<typeof GitHubClient>;
const mockSentry = Sentry as jest.Mocked<typeof Sentry>;

describe('Feedback API - Attachment Handling', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables
    process.env = { 
      ...originalEnv,
      SLACK_WEBHOOK_URL: 'https://hooks.slack.com/test',
      GITHUB_TOKEN: 'test-token',
      GITHUB_REPO: 'test/repo'
    };
    
    jest.clearAllMocks();
    
    // Setup default mocks
    mockRequireAuth.mockResolvedValue({
      user: {
        id: 'test-user-id',
        email: 'test@example.com'
      }
    } as any);
    
    mockSlackClient.mockImplementation(() => ({
      sendFeedback: jest.fn().mockResolvedValue(undefined)
    } as any));
    
    mockGitHubClient.mockImplementation(() => ({
      createIssue: jest.fn().mockResolvedValue({
        number: 123,
        html_url: 'https://github.com/test/repo/issues/123',
        title: 'Test Issue',
        state: 'open'
      })
    } as any));
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should accept feedback with image attachments', async () => {
    const mockRequest = new NextRequest('http://localhost:3000/api/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'bug',
        message: 'Test feedback with image',
        url: 'http://localhost:3000/test',
        userAgent: 'Mozilla/5.0',
        attachments: [
          {
            name: 'screenshot.png',
            type: 'image/png',
            size: 50000,
            data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
          }
        ]
      })
    });

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.githubIssueUrl).toBe('https://github.com/test/repo/issues/123');
  });

  it('should accept feedback with multiple attachments', async () => {
    const mockRequest = new NextRequest('http://localhost:3000/api/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'feature',
        message: 'Test feedback with multiple attachments',
        url: 'http://localhost:3000/test',
        userAgent: 'Mozilla/5.0',
        attachments: [
          {
            name: 'screenshot1.png',
            type: 'image/png',
            size: 30000,
            data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
          },
          {
            name: 'screenshot2.jpg',
            type: 'image/jpeg',
            size: 40000,
            data: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k='
          },
          {
            name: 'log.txt',
            type: 'text/plain',
            size: 1000,
            data: 'data:text/plain;base64,VGVzdCBsb2cgZmlsZQ=='
          }
        ]
      })
    });

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('should reject feedback with too many attachments', async () => {
    const mockRequest = new NextRequest('http://localhost:3000/api/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'bug',
        message: 'Test feedback',
        url: 'http://localhost:3000/test',
        userAgent: 'Mozilla/5.0',
        attachments: [
          { name: 'file1.png', type: 'image/png', size: 1000, data: 'data:image/png;base64,test' },
          { name: 'file2.png', type: 'image/png', size: 1000, data: 'data:image/png;base64,test' },
          { name: 'file3.png', type: 'image/png', size: 1000, data: 'data:image/png;base64,test' },
          { name: 'file4.png', type: 'image/png', size: 1000, data: 'data:image/png;base64,test' }
        ]
      })
    });

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Maximum 3 attachments allowed');
  });

  it('should handle feedback without attachments', async () => {
    const mockRequest = new NextRequest('http://localhost:3000/api/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'improvement',
        message: 'Test feedback without attachments',
        url: 'http://localhost:3000/test',
        userAgent: 'Mozilla/5.0'
      })
    });

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('should include attachment info in Slack notification', async () => {
    const mockSendFeedback = jest.fn().mockResolvedValue(undefined);
    mockSlackClient.mockImplementation(() => ({
      sendFeedback: mockSendFeedback
    } as any));

    const mockRequest = new NextRequest('http://localhost:3000/api/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'bug',
        message: 'Test with attachments',
        url: 'http://localhost:3000/test',
        userAgent: 'Mozilla/5.0',
        attachments: [
          {
            name: 'test.png',
            type: 'image/png',
            size: 5000,
            data: 'data:image/png;base64,test'
          }
        ]
      })
    });

    await POST(mockRequest);

    expect(mockSendFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        attachmentCount: 1
      })
    );
  });

  it('should embed images in GitHub issue body', async () => {
    const mockCreateIssue = jest.fn().mockResolvedValue({
      number: 123,
      html_url: 'https://github.com/test/repo/issues/123',
      title: 'Test Issue',
      state: 'open'
    });
    mockGitHubClient.mockImplementation(() => ({
      createIssue: mockCreateIssue
    } as any));

    const mockRequest = new NextRequest('http://localhost:3000/api/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'bug',
        message: 'Test with image',
        url: 'http://localhost:3000/test',
        userAgent: 'Mozilla/5.0',
        attachments: [
          {
            name: 'screenshot.png',
            type: 'image/png',
            size: 5000,
            data: 'data:image/png;base64,testdata'
          }
        ]
      })
    });

    await POST(mockRequest);

    expect(mockCreateIssue).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining('### Attachments') && 
              expect.stringContaining('![screenshot.png](data:image/png;base64,testdata)')
      })
    );
  });
});
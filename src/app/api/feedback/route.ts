import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session-helper";
import { SlackClient } from "@/lib/slack/client";
import * as Sentry from "@sentry/nextjs";

// Rate limiting: Track submissions per user
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 5; // 5 submissions
const RATE_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);

  if (!userLimit || now > userLimit.resetTime) {
    // Reset or create new limit
    rateLimitMap.set(userId, {
      count: 1,
      resetTime: now + RATE_WINDOW,
    });
    return true;
  }

  if (userLimit.count >= RATE_LIMIT) {
    return false;
  }

  userLimit.count++;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const authSession = await requireAuth(request);
    const userId = authSession.user.id;
    const userEmail = authSession.user.email;

    // Check rate limit
    if (!checkRateLimit(userId)) {
      return NextResponse.json(
        { error: "Too many submissions. Please try again later." },
        { status: 429 },
      );
    }

    // Parse request body
    const body = await request.json();
    const { type, message, url, userAgent } = body;

    // Validate required fields
    if (!type || !message || !message.trim()) {
      return NextResponse.json(
        { error: "Type and message are required" },
        { status: 400 },
      );
    }

    // Validate type
    const validTypes = ["bug", "feature", "improvement", "other"];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: "Invalid feedback type" },
        { status: 400 },
      );
    }

    // Check if Slack webhook is configured
    const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!slackWebhookUrl) {
      console.warn(
        "SLACK_WEBHOOK_URL not configured, logging feedback to console",
      );
      console.log("Feedback received:", {
        type,
        message,
        userEmail,
        url,
        timestamp: new Date().toISOString(),
      });

      // Still return success to user
      return NextResponse.json({
        success: true,
        message: "Feedback received (Slack not configured)",
      });
    }

    // Send to Slack
    try {
      const slackClient = new SlackClient(slackWebhookUrl);
      await slackClient.sendFeedback({
        type,
        message,
        userEmail,
        url,
        userAgent,
        timestamp: new Date().toISOString(),
      });

      // Log to Sentry for tracking
      Sentry.captureMessage("User feedback submitted", {
        level: "info",
        tags: {
          feedbackType: type,
        },
        extra: {
          userEmail,
          url,
        },
      });

      return NextResponse.json({
        success: true,
        message: "Feedback sent successfully",
      });
    } catch (slackError) {
      console.error("Failed to send to Slack:", slackError);

      // Log error but don't fail the request
      Sentry.captureException(slackError, {
        tags: {
          component: "feedback",
        },
      });

      return NextResponse.json({
        success: true,
        message: "Feedback received (Slack delivery pending)",
      });
    }
  } catch (error) {
    console.error("Feedback submission error:", error);

    Sentry.captureException(error);

    // Handle authentication errors
    if (error instanceof Error && error.message === "Unauthorised") {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    return NextResponse.json(
      { error: "Failed to submit feedback" },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session-helper";
import { SlackClient } from "@/lib/slack/client";
import { GitHubClient } from "@/lib/github/client";
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
    const { type, message, url, userAgent, attachments = [] } = body;

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

    // Validate attachments
    if (attachments.length > 3) {
      return NextResponse.json(
        { error: "Maximum 3 attachments allowed" },
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

    // Create GitHub issue if configured
    let githubIssueUrl: string | undefined;
    const githubToken = process.env.GITHUB_TOKEN;
    const githubRepo = process.env.GITHUB_REPO;

    if (githubToken && githubRepo) {
      try {
        const [owner, repo] = githubRepo.split("/");
        const githubClient = new GitHubClient(githubToken, owner, repo);

        // Process attachments for GitHub issue
        let attachmentsSection = "";
        if (attachments.length > 0) {
          attachmentsSection = "\n\n### Attachments\n";
          
          for (const attachment of attachments) {
            const { name, type, size, data } = attachment;
            
            // For images, embed them directly in the issue
            if (type.startsWith("image/")) {
              attachmentsSection += `\n**${name}** (${(size / 1024).toFixed(1)}KB)\n\n`;
              attachmentsSection += `![${name}](${data})\n`;
            } else {
              // For non-images, provide file info
              attachmentsSection += `\n**${name}** (${(size / 1024).toFixed(1)}KB) - Type: ${type}\n`;
              attachmentsSection += `*Note: Non-image attachments cannot be directly embedded in GitHub issues. Please contact the user for the full file.*\n`;
            }
          }
        }

        // Create issue title and body
        const issueTitle = `[${type.charAt(0).toUpperCase() + type.slice(1)}] User Feedback - ${new Date().toLocaleDateString()}`;
        const issueBody = `## User Feedback

**Type:** ${type}
**Submitted by:** ${userEmail}
**URL:** ${url}
**Time:** ${new Date().toISOString()}

### Message
${message}${attachmentsSection}

### Browser Info
\`\`\`
${userAgent}
\`\`\`

---
*This issue was automatically created from user feedback submitted through the TC9 Migration Tool.*`;

        const labels = type === "bug" ? ["bug", "user-feedback"] : ["enhancement", "user-feedback"];

        const issue = await githubClient.createIssue({
          title: issueTitle,
          body: issueBody,
          labels,
        });

        githubIssueUrl = issue.html_url;
        console.log("GitHub issue created:", githubIssueUrl);
      } catch (githubError) {
        console.error("Failed to create GitHub issue:", githubError);
        // Don't fail the request if GitHub fails
        Sentry.captureException(githubError, {
          tags: {
            component: "feedback",
            service: "github",
          },
        });
      }
    } else if (!githubToken) {
      console.warn("GITHUB_TOKEN not configured, skipping issue creation");
    } else if (!githubRepo) {
      console.warn("GITHUB_REPO not configured, skipping issue creation");
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
        githubIssueUrl, // Pass GitHub issue URL to Slack
        attachmentCount: attachments.length,
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
          githubIssueUrl,
        },
      });

      return NextResponse.json({
        success: true,
        message: "Feedback sent successfully",
        githubIssueUrl,
      });
    } catch (slackError) {
      console.error("Failed to send to Slack:", slackError);

      // Log error but don't fail the request
      Sentry.captureException(slackError, {
        tags: {
          component: "feedback",
          service: "slack",
        },
      });

      return NextResponse.json({
        success: true,
        message: "Feedback received (Slack delivery pending)",
        githubIssueUrl,
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

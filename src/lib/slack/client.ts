interface SlackMessage {
  type: string;
  message: string;
  userEmail: string;
  url: string;
  userAgent: string;
  timestamp: string;
  githubIssueUrl?: string;
  attachmentCount?: number;
}

export class SlackClient {
  private webhookUrl: string;

  constructor(webhookUrl: string) {
    this.webhookUrl = webhookUrl;
  }

  async sendFeedback(feedback: SlackMessage): Promise<void> {
    const emoji = this.getEmoji(feedback.type);
    const color = this.getColor(feedback.type);

    const payload = {
      attachments: [
        {
          color,
          fallback: `${emoji} ${feedback.type} feedback from ${feedback.userEmail}`,
          author_name: feedback.userEmail,
          title: `${emoji} ${this.formatType(feedback.type)} Feedback`,
          text: feedback.message,
          fields: [
            {
              title: "Page",
              value: feedback.url,
              short: true,
            },
            {
              title: "Time",
              value: new Date(feedback.timestamp).toLocaleString("en-GB", {
                dateStyle: "short",
                timeStyle: "short",
              }),
              short: true,
            },
            ...(feedback.attachmentCount && feedback.attachmentCount > 0
              ? [
                  {
                    title: "Attachments",
                    value: `${feedback.attachmentCount} file${feedback.attachmentCount > 1 ? 's' : ''}`,
                    short: true,
                  },
                ]
              : []),
            ...(feedback.githubIssueUrl
              ? [
                  {
                    title: "GitHub Issue",
                    value: `<${feedback.githubIssueUrl}|View Issue>`,
                    short: false,
                  },
                ]
              : []),
          ],
          footer: "TC9 Migration Tool",
          ts: Math.floor(Date.now() / 1000).toString(),
        },
      ],
    };

    const response = await fetch(this.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Slack webhook failed: ${response.status}`);
    }
  }

  private getEmoji(type: string): string {
    const emojis: Record<string, string> = {
      bug: "🐛",
      feature: "✨",
      improvement: "💡",
      other: "💬",
    };
    return emojis[type] || "💬";
  }

  private getColor(type: string): string {
    const colors: Record<string, string> = {
      bug: "#e74c3c", // Red
      feature: "#3498db", // Blue
      improvement: "#f39c12", // Orange
      other: "#95a5a6", // Grey
    };
    return colors[type] || "#95a5a6";
  }

  private formatType(type: string): string {
    return type.charAt(0).toUpperCase() + type.slice(1);
  }
}

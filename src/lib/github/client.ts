interface GitHubIssue {
  title: string;
  body: string;
  labels?: string[];
}

interface GitHubIssueResponse {
  number: number;
  html_url: string;
  title: string;
  state: string;
}

export class GitHubClient {
  private token: string;
  private owner: string;
  private repo: string;
  private baseUrl = "https://api.github.com";

  constructor(token: string, owner: string, repo: string) {
    this.token = token;
    this.owner = owner;
    this.repo = repo;
  }

  async createIssue(issue: GitHubIssue): Promise<GitHubIssueResponse> {
    const url = `${this.baseUrl}/repos/${this.owner}/${this.repo}/issues`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(issue),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create GitHub issue: ${response.status} - ${error}`);
    }

    return response.json();
  }
}
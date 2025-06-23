import fs from 'fs';
import path from 'path';

class MigrationLogger {
  private logFilePath: string;
  private writeStream: fs.WriteStream | null = null;

  constructor() {
    // Use /tmp directory which is available in Docker containers
    // This ensures the log file can be written even in read-only filesystems
    const logDir = process.env.LOG_DIR || '/tmp';
    this.logFilePath = path.join(logDir, 'migration-output.log');
    
    // Create write stream with append mode
    try {
      this.writeStream = fs.createWriteStream(this.logFilePath, { flags: 'a' });
      this.log(`Migration logger initialized at ${new Date().toISOString()}`);
    } catch (error) {
      console.error('Failed to create log file write stream:', error);
    }
  }

  private formatMessage(level: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';
    return `[${timestamp}] [${level}] ${message}${dataStr}`;
  }

  private writeToFile(message: string) {
    if (this.writeStream && !this.writeStream.destroyed) {
      this.writeStream.write(message + '\n');
    }
  }

  log(message: string, data?: any) {
    const formatted = this.formatMessage('INFO', message, data);
    console.log(formatted);
    this.writeToFile(formatted);
  }

  error(message: string, data?: any) {
    const formatted = this.formatMessage('ERROR', message, data);
    console.error(formatted);
    this.writeToFile(formatted);
  }

  warn(message: string, data?: any) {
    const formatted = this.formatMessage('WARN', message, data);
    console.warn(formatted);
    this.writeToFile(formatted);
  }

  debug(message: string, data?: any) {
    const formatted = this.formatMessage('DEBUG', message, data);
    console.log(formatted);
    this.writeToFile(formatted);
  }

  // Method to get the current log file path
  getLogFilePath(): string {
    return this.logFilePath;
  }

  // Method to read recent logs
  async getRecentLogs(lines: number = 100): Promise<string[]> {
    try {
      const content = await fs.promises.readFile(this.logFilePath, 'utf-8');
      const allLines = content.trim().split('\n');
      return allLines.slice(-lines);
    } catch (error) {
      console.error('Failed to read log file:', error);
      return [];
    }
  }

  // Close the write stream
  close() {
    if (this.writeStream && !this.writeStream.destroyed) {
      this.writeStream.end();
    }
  }
}

// Export singleton instance
export const migrationLogger = new MigrationLogger();
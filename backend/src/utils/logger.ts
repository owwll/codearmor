class Logger {
  private formatMessage(level: string, colorCode: string, context: string, message: string, data?: object): string {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ' ' + JSON.stringify(data) : '';
    return `${colorCode}[${timestamp}] [${level}] [${context}] ${message}${dataStr}\x1b[0m`;
  }

  info(context: string, message: string, data?: object): void {
    console.log(this.formatMessage('INFO', '\x1b[36m', context, message, data));
  }

  warn(context: string, message: string, data?: object): void {
    console.warn(this.formatMessage('WARN', '\x1b[33m', context, message, data));
  }

  error(context: string, message: string, error?: Error | unknown): void {
    let errData: object | undefined;
    if (error instanceof Error) {
      errData = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    } else if (error !== undefined && error !== null) {
      errData = { details: String(error) };
    }
    console.error(this.formatMessage('ERROR', '\x1b[31m', context, message, errData));
  }

  debug(context: string, message: string, data?: object): void {
    if (process.env.DEV_MODE === 'true') {
      console.log(this.formatMessage('DEBUG', '\x1b[90m', context, message, data));
    }
  }
}

export const logger = new Logger();

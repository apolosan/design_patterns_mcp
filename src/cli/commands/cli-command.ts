/**
 * Command Pattern for CLI Operations
 * Defines the interface for all CLI commands in the design patterns MCP server
 */

export interface CLICommand {
  /** Command name used for identification and help */
  readonly name: string;

  /** Optional description for help text */
  readonly description?: string;

  /** Execute the command with optional arguments */
  execute(args?: string[]): Promise<void>;
}

export type DBConfig = {
  filename: string;
  options?: {
    readonly?: boolean;
    fileMustExist?: boolean;
    timeout?: number;
    verbose?: (message: string) => void;
  };
};
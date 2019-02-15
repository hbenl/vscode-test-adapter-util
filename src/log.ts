import * as fs from 'fs';
import * as vscode from 'vscode';
import * as util from 'util';

/**
 * A simple logger for VS Code extensions that can log to a VS Code output channel or a file
 */
export class Log {

	private configChangeSubscription: vscode.Disposable | undefined;
	private targets: ILogTarget[] = [];
	private nextInspectOptions: InspectOptions | undefined = undefined;

	/**
	 * Create a simple logger for VS Code extensions that can log to a VS Code output channel or a file
	 * @param configSection - the prefix for the configuration variables: logging to the output channel will be enabled if <configSection>.logpanel is set to true, logging to a file will be enabled if <configSection>.logfile is set to a filename
	 * @param workspaceFolder - the WorkspaceFolder (optional)
	 * @param outputChannelName - the name of the output channel
	 */
	constructor(
		private readonly configSection: string,
		private readonly workspaceFolder: vscode.WorkspaceFolder | undefined,
		private readonly outputChannelName: string,
		private inspectOptions: InspectOptions = {}
	) {
		this.configure();
		this.configChangeSubscription = vscode.workspace.onDidChangeConfiguration(event => {
			if (event.affectsConfiguration(this.configSection + '.logpanel') ||
				event.affectsConfiguration(this.configSection + '.logfile')) {
				this.configure();
			}
		});
	}

	get enabled() { return (this.targets.length > 0); }

	setDefaultInspectOptions(inspectOptions: InspectOptions) {
		this.inspectOptions = inspectOptions;
	}

	updateDefaultInspectOptions(inspectOptions: InspectOptions) {
		Object.assign(this.inspectOptions, inspectOptions);
	}

	setNextInspectOptions(inspectOptions: InspectOptions) {
		this.nextInspectOptions = inspectOptions;
	}

	updateNextInspectOptions(inspectOptions: InspectOptions) {
		if (this.nextInspectOptions !== undefined)
			Object.assign(this.nextInspectOptions, inspectOptions);
		else
			this.nextInspectOptions = Object.assign(Object.assign({}, this.inspectOptions), inspectOptions);
	}

	debug(...msg: any[]): void {
		this.log('DEBUG', msg);
	}

	info(...msg: any[]): void {
		this.log('INFO', msg);
	}

	warn(...msg: any[]): void {
		this.log('WARN', msg);
	}

	error(...msg: any[]): void {
		this.log('ERROR', msg);
	}

	dispose(): void {
		if (this.configChangeSubscription) {
			this.configChangeSubscription.dispose();
			this.configChangeSubscription = undefined;
		}
		this.targets.forEach(target => target.dispose());
		this.targets = [];
	}

	private log(logLevel: string, msg: any[]) {
		if (this.targets.length > 0) {
			const dateString = new Date().toISOString().replace('T', ' ').replace('Z', '');

			const inspectOptions = this.nextInspectOptions !== undefined
				? this.nextInspectOptions
				: this.inspectOptions;

			let isPreviousNotString = false;

			for (let i = 0; i < msg.length; ++i) {
				try {
					if (typeof msg[i] !== 'string') {
						msg[i] = util.inspect(msg[i], inspectOptions)
							+ (isPreviousNotString ? ';' : '');
						isPreviousNotString = true;
					} else {
						isPreviousNotString = false;
					}
				} catch (e) {
					msg[i] = '<inspection error>';
				}
			}

			const logEntry = `[${dateString}] [${logLevel}] ` + msg.join(' ');
			this.targets.forEach(target => target.write(logEntry));
		}
		this.nextInspectOptions = undefined;
	}

	private configure() {

		this.targets.forEach(target => target.dispose());
		this.targets = [];

		const uri = this.workspaceFolder ? this.workspaceFolder.uri : null;
		const configuration = vscode.workspace.getConfiguration(this.configSection, uri);

		if (configuration.get<boolean>('logpanel')) {
			this.targets.push(new OutputChannelTarget(this.outputChannelName));
		}

		const file = configuration.get<string>('logfile');
		if (file) {
			try {
				this.targets.push(new FileTarget(file));
			} catch (err) {
				vscode.window.showErrorMessage(`Couldn't open log file ${file}: ${err}`);
			}
		}
	}
}

interface ILogTarget {
	write(msg: string): void;
	dispose(): void;
}

export class OutputChannelTarget implements ILogTarget {

	private outputChannel: vscode.OutputChannel;

	constructor(name: string) {
		this.outputChannel = vscode.window.createOutputChannel(name);
	}

	write(msg: string): void {
		this.outputChannel.appendLine(msg);
	}

	dispose(): void {
		this.outputChannel.dispose();
	}
}

export class FileTarget implements ILogTarget {

	private readonly writeStream: fs.WriteStream;

	constructor(filename: string) {
		this.writeStream = fs.createWriteStream(filename, { flags: 'a' });
		this.writeStream.on('error', (err: Error) => {
			vscode.window.showErrorMessage(`Couldn't write log file ${filename}: ${err}`);
		});
	}

	write(msg: string): void {
		this.writeStream.write(msg + '\n');
	}

	dispose(): void {
		this.writeStream.end();
	}
}

export interface InspectOptions extends util.InspectOptions { }

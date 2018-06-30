import * as fs from 'fs';
import * as vscode from 'vscode';

export class Log {

	private targets: ILogTarget[] = [];

	constructor(
		private readonly configSection: string,
		private readonly workspaceFolder: vscode.WorkspaceFolder,
		private readonly outputChannelName: string
	) {
		this.configure();
		vscode.workspace.onDidChangeConfiguration(event => {
			if (event.affectsConfiguration(this.configSection + '.logpanel') || 
				event.affectsConfiguration(this.configSection + '.logfile')) {
				this.configure();
			}
		});
	}

	get enabled() { return (this.targets.length > 0); }

	debug(msg: string): void {
		this.log(msg, 'DEBUG');
	}

	info(msg: string): void {
		this.log(msg, 'INFO');
	}

	warn(msg: string): void {
		this.log(msg, 'WARN');
	}

	error(msg: string): void {
		this.log(msg, 'ERROR');
	}

	dispose(): void {
		this.targets.map(target => target.dispose());
		this.targets = [];
	}

	private log(msg: string, logLevel: string) {
		if (this.targets.length > 0) {
			const dateString = new Date().toISOString().replace('T', ' ').replace('Z', '');
			this.targets.map(target => target.write(`[${dateString}] [${logLevel}] ${msg}`));
		}
	}

	private configure() {

		this.targets.map(target => target.dispose());
		this.targets = [];

		const uri = this.workspaceFolder ? this.workspaceFolder.uri : undefined;
		const configuration = vscode.workspace.getConfiguration(this.configSection, uri);

		if (configuration.get<boolean>('logpanel')) {
			this.targets.push(new OutputChannelTarget(this.outputChannelName));
		}

		const file = configuration.get<string>('logfile');
		if (file) {
			this.targets.push(new FileTarget(file));
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

	private readonly buffered: string[] = [];
	private fd: number | undefined = undefined;
	private writing: boolean = false;

	constructor(filename: string) {
		fs.open(filename, 'a', (err, fd) => {
			if (err) {
				vscode.window.showErrorMessage(`Couldn't open log file ${filename}: ${err}`);
			} else {
				this.fd = fd;
				this.writeNext();
			}
		});
	}

	write(msg: string): void {
		if ((this.fd === undefined) || this.writing) {
			this.buffered.push(msg);
		} else {
			this.writeNow(msg);
		}
	}

	dispose(): void {
		if (this.fd !== undefined) {
			fs.closeSync(this.fd);
		}
	}

	/** must only be called if `this.fd` is set and `this.writing` is `false` */
	private writeNext(): void {
		const msg = this.buffered.shift();
		if (msg !== undefined) {
			this.writeNow(msg);
		}
	}

	/** must only be called if `this.fd` is set and `this.writing` is `false` */
	private writeNow(msg: string): void {
		this.writing = true;
		fs.write(this.fd!, msg + '\n', err => {
			if (err) {
				vscode.window.showErrorMessage(`Couldn't write to log file: ${err}`);
			}
			this.writing = false;
			this.writeNext();
		});
	}
}

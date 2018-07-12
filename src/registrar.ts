import * as vscode from 'vscode';
import { TestAdapter, TestExplorerExtension } from 'vscode-test-adapter-api';
import { Log } from './log';

export class TestAdapterRegistrar<T extends TestAdapter & { dispose: () => void }> {

	private readonly registeredAdapters = new Map<vscode.WorkspaceFolder, T>();

	constructor(
		private readonly testExplorer: TestExplorerExtension,
		private readonly adapterFactory: (workspaceFolder: vscode.WorkspaceFolder) => T,
		private readonly log: Log
	) {

		if (vscode.workspace.workspaceFolders) {
			for (const workspaceFolder of vscode.workspace.workspaceFolders) {
				this.add(workspaceFolder);
			}
		}

		log.info('Initialization finished');

		vscode.workspace.onDidChangeWorkspaceFolders((event) => {

			for (const workspaceFolder of event.removed) {
				this.remove(workspaceFolder);
			}

			for (const workspaceFolder of event.added) {
				this.add(workspaceFolder);
			}
		});
	}

	add(workspaceFolder: vscode.WorkspaceFolder) {

		if (this.log.enabled) this.log.info(`Creating adapter for ${workspaceFolder.uri.fsPath}`);

		const adapter = this.adapterFactory(workspaceFolder);
		this.registeredAdapters.set(workspaceFolder, adapter);

		if (this.log.enabled) this.log.info(`Registering adapter for ${workspaceFolder.uri.fsPath}`);

		this.testExplorer.registerAdapter(adapter);
	}

	remove(workspaceFolder: vscode.WorkspaceFolder) {

		const adapter = this.registeredAdapters.get(workspaceFolder);
		if (adapter) {

			if (this.log.enabled) this.log.info(`Removing adapter for ${workspaceFolder.uri.fsPath}`);

			this.testExplorer.unregisterAdapter(adapter);
			this.registeredAdapters.delete(workspaceFolder);
			adapter.dispose();
		}
	}

	dispose(): void {
		for (const workspaceFolder of this.registeredAdapters.keys()) {
			this.remove(workspaceFolder);
		}
		this.log.dispose();
	}
}

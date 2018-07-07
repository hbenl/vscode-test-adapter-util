import * as os from 'os';
import { exec } from 'child_process';

export async function detectNodePath(): Promise<string | undefined> {
	try {
		if (os.platform() === 'win32') {
			return (await execPromise("where node")).trim();
		} else {
			return (await execPromise("which node")).trim();
		}
	} catch (e) {
		return;
	}
}

function execPromise(cmd: string): Promise<string | undefined> {
	return new Promise<string | undefined>((resolve, reject) => {
		exec(cmd, (err, stdout) => {
			if (err) {
				reject(err);
			} else {
				resolve(stdout);
			}
		})
	});
}

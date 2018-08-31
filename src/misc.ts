import * as os from 'os';
import { exec } from 'child_process';

export async function detectNodePath(): Promise<string | undefined> {
	try {
		if (os.platform() === 'win32') {

			const result = await execPromise('where node');
			return result ? result.trim().split('\r\n')[0] : undefined;

		} else {

			const result = await execPromise('which node');
			return result ? result.trim() : undefined;

		}
	} catch (e) {
		return undefined;
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

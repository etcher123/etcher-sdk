/*
 * Copyright 2018 balena.io
 * Copyright 2020 Collabora Ltd. <arnaud.rebillout@collabora.com>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { platform } from 'os';

import { Argv } from 'yargs';

import { scanner, sourceDestination } from '../lib/';

import {
	pipeSourceToDestinationsWithProgressBar,
	readJsonFile,
	wrapper,
} from './utils';



// from scanner.ts
async function main_scan() {
	const adapters: scanner.adapters.Adapter[] = [
		new scanner.adapters.BlockDeviceAdapter({
			includeSystemDrives: () => true,
		}),
		new scanner.adapters.UsbbootDeviceAdapter(),
	];
	if (platform() === 'win32') {
		if (scanner.adapters.DriverlessDeviceAdapter !== undefined) {
			adapters.push(new scanner.adapters.DriverlessDeviceAdapter());
		}
	}
	const deviceScanner = new scanner.Scanner(adapters);
	deviceScanner.on(
		'attach',
		async (drive: scanner.adapters.AdapterSourceDestination) => {
			console.log('attach', JSON.stringify(drive, null, 2));
			if (drive.emitsProgress) {
				drive.on('progress', (progress: number) => {
					console.log(drive, progress, '%');
				});
			}
		},
	);
	deviceScanner.on(
		'detach',
		(drive: scanner.adapters.AdapterSourceDestination) => {
			console.log('detach', JSON.stringify(drive, null, 2));
		},
	);
	deviceScanner.on('error', (error: Error) => {
		console.log('error', JSON.stringify(error, null, 2));
	});
	await deviceScanner.start();
	const d = deviceScanner.getBy(
		'devicePath',
		'pci-0000:00:14.0-usb-0:2:1.0-scsi-0:0:0:0',
	);
	console.log('ready', d);
}

// from multi-destination.ts
const main_write = async ({
	sourceImage,
	devices,
	verify,
	trim,
	config,
	numBuffers,
}: {
	sourceImage: string;
	devices: string[];
	verify: boolean;
	trim: boolean;
	config: string;
	numBuffers: number;
}) => {
	const adapters = [
		new scanner.adapters.BlockDeviceAdapter({
			includeSystemDrives: () => false,
			unmountOnSuccess: false,
			write: true,
			direct: true,
		}),
	];
	const deviceScanner = new scanner.Scanner(adapters);
	deviceScanner.on('error', console.error);
	deviceScanner.start();
	// Wait for the deviceScanner to be ready
	await new Promise(resolve => {
		deviceScanner.on('ready', resolve);
	});
	let source: sourceDestination.SourceDestination = new sourceDestination.File({
		path: sourceImage,
	});
	source = await source.getInnerSource(); // getInnerSource will open the sources for you, no need to call open().
	if (trim || config !== undefined) {
		source = new sourceDestination.ConfiguredSource({
			source,
			shouldTrimPartitions: trim,
			createStreamFromDisk: true,
			configure: config !== undefined ? 'legacy' : undefined,
			config:
				config !== undefined
					? { config: await readJsonFile(config) }
					: undefined,
		});
	}
	const destinationDrives = Array.from(deviceScanner.drives.values()).filter(
		drive => {
			console.log('Device found:', drive.device);
			return devices.includes(drive.device!);
		},
	);
	try {
		await pipeSourceToDestinationsWithProgressBar(
			source,
			destinationDrives,
			verify,
			numBuffers,
		);
	} finally {
		deviceScanner.stop();
	}
};



// tslint:disable-next-line: no-var-requires
const argv = require('yargs')
	.command(
		'scan',
		'Scan available drives',
		() => {},
	)
	.command(
		'write <sourceImage> [devices..]',
		'Write the sourceImage on all devices.',
		(yargs: Argv) => {
			yargs.positional('sourceImage', { describe: 'Source image' });
			yargs.positional('devices', {	describe: 'Devices to write to'	});
			yargs.option('verify', { default: false });
			yargs.option('trim', { default: false });
			yargs.option('numBuffers', {
				default: 16,
				describe: 'Number of 1MiB buffers used to buffer data',
			});
			yargs.describe('config', 'json configuration file');
		},
	)
	.demandCommand(1, '')
	.help()
	.argv;

if (argv._[0] == 'scan') {
	main_scan();
} else if (argv._[0] == 'write') {
	wrapper(main_write, argv);
}

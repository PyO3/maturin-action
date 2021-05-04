import * as core from '@actions/core';
import * as httpclient from '@actions/http-client';
import { promises as fs, writeFileSync } from 'fs';
import * as tc from '@actions/tool-cache';
import * as exec from '@actions/exec';
import * as io from '@actions/io';
import * as path from 'path';
import stringArgv from "string-argv";

const IS_MACOS = process.platform == 'darwin';
const IS_WINDOWS = process.platform == 'win32';
const IS_LINUX = process.platform == 'linux';
const DEFAULT_MATURIN_VERSION = 'v0.10.4';

/**
 * Find maturin version
 */
async function findVersion(): Promise<string> {
    const version = core.getInput('maturin-version');
    if (version !== 'latest') {
        if (!version.startsWith('v')) {
            core.info(`Corrected maturin-version from '${version}' to 'v${version}'`)
            return `v${version}`;
        }
        return version;
    }

    core.info('Searching the latest version of maturin ...');
    const http = new httpclient.HttpClient('messense/maturin-action', [], {
        allowRetries: true
    });
    const response = await http.get('https://api.github.com/repos/PyO3/maturin/releases/latest');
    const body = await response.readBody();
    let tag = JSON.parse(body).tag_name;
    if (!tag) {
        // Just in case fetch latest maturin version failed
        tag = DEFAULT_MATURIN_VERSION;
    }
    return Promise.resolve(tag);
}

/**
 * Download and return the path to an executable maturin tool
 * @param string tag The tag to download
 */
async function downloadMaturin(tag: string): Promise<string> {
    let name: string;
    let zip = false;
    if (IS_WINDOWS) {
        name = 'maturin-x86_64-pc-windows-msvc.zip';
        zip = true;
    } else if (IS_MACOS) {
        name = 'maturin-x86_64-apple-darwin.tar.gz';
    } else {
        name = 'maturin-x86_64-unknown-linux-musl.tar.gz';
    }
    const url = `https://github.com/PyO3/maturin/releases/download/${tag}/${name}`;
    const tool = await tc.downloadTool(url);
    let toolPath: string;
    if (zip) {
        toolPath = await tc.extractZip(tool);
    } else {
        toolPath = await tc.extractTar(tool);
    }

    let exe: string;
    if (!IS_WINDOWS) {
        exe = path.join(toolPath, 'maturin');
        await fs.chmod(exe, 0o755);
    } else {
        exe = path.join(toolPath, 'maturin.exe');
    }
    return Promise.resolve(exe);
}

async function installMaturin(tag: string): Promise<string> {
    try {
        const exe = await io.which('maturin', true);
        core.info(`Found 'maturin' at ${exe}`);
        return exe;
    } catch (error) {
        const exe = await downloadMaturin(tag);
        core.info(`Installed 'maturin' to ${exe}`);
        core.addPath(path.dirname(exe));
        return exe;
    }
}

/**
 * Build manylinux wheel using Docker
 * @param tag maturin release tag, ie. version
 * @param args Docker args
 */
async function dockerBuild(tag: string, args: string[]) {
    let image: string;
    const container = core.getInput('container');
    let dockerArgs = [];
    if (container.indexOf(':') !== -1 || !container.startsWith('konstin2/maturin')) {
        image = container;
    } else {
        // konstin2/maturin support
        image = `${container}:${tag}`;
        // override entrypoint
        dockerArgs.push('--entrypoint', '/bin/bash');
    }

    core.startGroup('Pull Docker image');
    core.info(`Using ${image} Docker image`);
    const exitCode = await exec.exec('docker', ['pull', image]);
    if (exitCode != 0) {
        throw `maturin: 'docker pull' returned ${exitCode}`;
    }
    core.endGroup();

    const url = `https://github.com/PyO3/maturin/releases/download/${tag}/maturin-x86_64-unknown-linux-musl.tar.gz`;
    // Defaults to stable for Docker build
    const rustToolchain = core.getInput('rust-toolchain') || 'stable';
    const commands = [
        '#!/bin/bash',
        // Stop on first error
        'set -e',
        // Install Rust
        'echo "::group::Install Rust"',
        `which rustup > /dev/null || curl --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain ${rustToolchain}`,
        'export PATH="$HOME/.cargo/bin:$PATH"',
        `rustup override set ${rustToolchain}`,
        'echo "::endgroup::"',
        // Add all supported python versions to PATH
        'export PATH="$PATH:/opt/python/cp36-cp36m/bin:/opt/python/cp37-cp37m/bin:/opt/python/cp38-cp38/bin:/opt/python/cp39-cp39/bin"',
        // Install maturin
        'echo "::group::Install maturin"',
        `curl -L ${url} | tar -xz -C /usr/local/bin`,
        'echo "::endgroup::"',
    ];
    const target = core.getInput('target');
    if (target.length > 0) {
        commands.push(
            'echo "::group::Install Rust target"',
            `rustup target add ${target}`,
            'echo "::endgroup::"'
        );
    }
    commands.push(`maturin ${args.join(' ')}`);

    const workspace = process.env.GITHUB_WORKSPACE!;
    const scriptPath = path.join(workspace, 'run-maturin-action.sh');
    writeFileSync(
        scriptPath,
        commands.join('\n'),
    );
    await fs.chmod(scriptPath, 0o755);

    return await exec.exec(
        'docker',
        [
            'run',
            '--rm',
            '--workdir',
            workspace,
            // A list of environment variables
            '-e',
            'DEBIAN_FRONTEND=noninteractive',
            '-e',
            'RUSTFLAGS',
            '-e',
            'MATURIN_PASSWORD',
            '-e',
            'MATURIN_PYPI_TOKEN',
            '-e',
            'ARCHFLAGS',
            '-e',
            'PYO3_CROSS_LIB_DIR',
            // Mount $GITHUB_WORKSPACE at the same path
            '-v',
            `${workspace}:${workspace}`,
            ...dockerArgs,
            image,
            scriptPath
        ]
    );
}

/**
 * Install Rust target using rustup
 * @param target Rust target name
 */
async function installRustTarget(target: string, toolchain: string) {
    if (!target || target.length == 0) {
        return;
    }
    if (toolchain.length > 0) {
        await exec.exec('rustup', ['target', 'add', '--toolchain', toolchain, target]);
    } else {
        await exec.exec('rustup', ['target', 'add', target]);
    }
}

async function innerMain() {
    const rustToolchain = core.getInput('rust-toolchain');
    const inputArgs = core.getInput('args');
    const args = stringArgv(inputArgs);
    const command = core.getInput('command');
    args.unshift(command);

    let useDocker = false;
    // Only build and publish commands has --manylinux and --target options
    if (['build', 'publish'].includes(command)) {
        const manylinux = core.getInput('manylinux');
        if (manylinux.length > 0 && IS_LINUX) {
            args.push('--manylinux', manylinux);
            const container = core.getInput('container')
            // User can force non-Docker manylinux build by clearing the `container` input
            useDocker = manylinux !== 'off' && container.length > 0;
        }

        const target = core.getInput('target');
        if (target.length > 0) {
            args.push('--target', target);
        }
        if (!useDocker) {
            core.startGroup('Install Rust target')
            if (rustToolchain.length > 0) {
                await exec.exec('rustup', ['override', 'set', rustToolchain]);
            }
            await installRustTarget(target, rustToolchain);
            core.endGroup();
        }
    }

    const tag = await findVersion();

    let exitCode: number;
    if (useDocker) {
        exitCode = await dockerBuild(tag, args);
    } else {
        core.startGroup('Install maturin');
        core.info(`Installing 'maturin' from tag '${tag}'`);
        const maturinPath = await installMaturin(tag);
        core.endGroup();

        // Setup additional env vars for macOS universal2 build
        const isUniversal2 = args.includes('--universal2');
        const env: Record<string, string> = {};
        for (const [k, v] of Object.entries(process.env)) {
            if (v !== undefined) {
                env[k] = v;
            }
        }
        if (isUniversal2) {
            core.startGroup('Prepare macOS universal2 build environment')
            await installRustTarget('x86_64-apple-darwin', rustToolchain);
            await installRustTarget('aarch64-apple-darwin', rustToolchain);
            env.DEVELOPER_DIR = '/Applications/Xcode.app/Contents/Developer';
            env.MACOSX_DEPLOYMENT_TARGET = '10.9';
            env.PYO3_CROSS_LIB_DIR = '/Applications/Xcode.app/Contents/Developer/Library/Frameworks/Python3.framework/Versions/3.8/lib';
            core.endGroup();
        }
        exitCode = await exec.exec(
            maturinPath,
            args,
            { env }
        );
    }
    if (exitCode != 0) {
        throw `maturin: returned ${exitCode}`;
    }
}

async function main() {
    try {
        await innerMain();
    } catch (error) {
        core.setFailed(error.message);
    }
}

main();
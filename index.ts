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

async function findVersion(): Promise<string> {
    const version = core.getInput('maturin-version');
    if (version !== 'latest') {
        return version;
    }

    core.info('Searching the latest version of maturin ...');
    const http = new httpclient.HttpClient('messense/maturin-action', [], {
        allowRetries: false
    });
    const response = await http.get('https://api.github.com/repos/PyO3/maturin/releases/latest');
    const body = await response.readBody();
    return Promise.resolve(JSON.parse(body).tag_name);
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
        return await io.which('maturin', true);
    } catch (error) {
        const exe = await downloadMaturin(tag);
        core.addPath(path.dirname(exe));
        return exe;
    }
}

async function dockerBuild(tag: string, args: string[]) {
    let image: string;
    const container = core.getInput('container');
    if (container.indexOf(':') !== -1) {
        image = container;
    } else {
        image = `${container}:${tag}`;
    }
    core.info(`Using ${image} Docker image`);
    const workspace = process.env.GITHUB_WORKSPACE!;

    const commands = ['#!/bin/bash'];
    const target = core.getInput('target');
    if (target.length > 0) {
        commands.push(`rustup target add ${target}`);
    }
    commands.push(`maturin ${args.join(' ')}`);
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
            '--entrypoint',
            '/bin/bash',
            '--workdir',
            workspace,
            '-v',
            `${workspace}:${workspace}`,
            image,
            scriptPath
        ]
    );
}

/**
 * Install Rust target using rustup
 * @param target Rust target name
 */
async function installRustTarget(target: string) {
    if (!target || target.length == 0) {
        return;
    }
    await exec.exec('rustup', ['target', 'add', target]);
}

async function innerMain() {
    const inputArgs = core.getInput('args');
    const args = stringArgv(inputArgs);
    const command = core.getInput('command');
    args.unshift(command);

    const manylinux = core.getInput('manylinux');
    const container = core.getInput('container')
    // User can force non-Docker manylinux build by clearing the `container` input
    let useDocker = IS_LINUX && manylinux.length > 0 && container.length > 0;
    // Only build and publish commands has --manylinux and --target options
    if (['build', 'publish'].includes(command)) {
        if (manylinux.length > 0 && IS_LINUX) {
            args.push('--manylinux', manylinux);
            useDocker = true;
        }

        const target = core.getInput('target');
        if (target.length > 0) {
            args.push('--target', target);
        }
        if (!useDocker) {
            await installRustTarget(target);
        }
    }

    const tag = await findVersion();

    let exitCode: number;
    if (useDocker) {
        exitCode = await dockerBuild(tag, args);
    } else {
        core.startGroup('install maturin');
        core.info(`Installing 'maturin' from tag '${tag}'`);
        const maturinPath = await installMaturin(tag);
        core.info(`Installed 'maturin' to ${maturinPath}`);
        core.endGroup();

        exitCode = await exec.exec(
            maturinPath,
            args
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
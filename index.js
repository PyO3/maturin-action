import * as core from '@actions/core';
import * as httpclient from '@actions/http-client';
import { promises as fs } from 'fs';
import * as tc from '@actions/tool-cache';
import * as exec from '@actions/exec';
import * as path from 'path';
import stringArgv from "string-argv";

const IS_MACOS = process.platform == 'darwin';
const IS_WINDOWS = process.platform == 'win32';
const IS_LINUX = process.platform == 'linux';

async function findVersion() {
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
async function downloadMaturin(tag) {
    let name;
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
    let toolPath;
    if (zip) {
        toolPath = await tc.extractZip(tool);
    } else {
        toolPath = await tc.extractTar(tool);
    }

    let exe;
    if (!IS_WINDOWS) {
        exe = path.join(toolPath, 'maturin');
        await fs.chmod(exe, 0o755);
    } else {
        exe = path.join(toolPath, 'maturin.exe');
    }
    return Promise.resolve(exe);
}

async function dockerBuild(tag, args) {
    let image;
    const container = core.getInput('container');
    if (container.indexOf(':') !== -1) {
        image = container;
    } else {
        image = `${container}:${tag}`;
    }
    core.info(`Using ${image} Docker image`);
    // Copy environment variables from parent process
    const env = { ...process.env };
    const workspace = env.GITHUB_WORKSPACE;
    let exitCode = await exec.exec(
        'docker',
        [
            'run',
            '--rm',
            '--workdir',
            workspace,
            '-v',
            `${workspace}:${workspace}`,
            image,
            ...args
        ],
        { env }
    );
    if (exitCode != 0) {
        throw `maturin: returned ${exitCode}`;
    }
}

async function innerMain() {
    const inputArgs = core.getInput('args');
    const args = stringArgv(inputArgs);
    const command = core.getInput('command');
    args.unshift(command);

    const tag = await findVersion();

    const manylinux = core.getInput('manylinux');
    if (manylinux.length > 0 && IS_LINUX) {
        // build using docker
        args.push('--manylinux', manylinux);
        await dockerBuild(tag, args);
    } else {
        core.info(`Downloading 'maturin' from tag '${tag}'`);
        const maturinPath = await downloadMaturin(tag);
        core.info(`Downloaded 'maturin' to ${maturinPath}`);

        let exitCode = await exec.exec(
            maturinPath,
            args
        );
        if (exitCode != 0) {
            throw `maturin: returned ${exitCode}`;
        }
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
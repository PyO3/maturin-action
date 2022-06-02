/* eslint-disable i18n-text/no-en */
import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as glob from '@actions/glob'
import * as io from '@actions/io'
import * as mexec from './exec'
import * as path from 'path'
import * as tc from '@actions/tool-cache'
import {existsSync, promises as fs, writeFileSync} from 'fs'
import os from 'os'
import stringArgv from 'string-argv'

const IS_MACOS = process.platform === 'darwin'
const IS_WINDOWS = process.platform === 'win32'
const IS_LINUX = process.platform === 'linux'

const DEFAULT_TARGET: Record<string, string> = {
  x64: 'x86_64-unknown-linux-gnu',
  arm64: 'aarch64-unknown-linux-gnu'
}

const DEFAULT_CONTAINERS: Record<string, Record<string, string>> = {
  'x86_64-unknown-linux-gnu': {
    auto: 'quay.io/pypa/manylinux2010_x86_64:latest',
    '2010': 'quay.io/pypa/manylinux2010_x86_64:latest',
    '2_12': 'quay.io/pypa/manylinux2010_x86_64:latest',
    '2014': 'quay.io/pypa/manylinux2014_x86_64:latest',
    '2_17': 'quay.io/pypa/manylinux2014_x86_64:latest',
    '2_24': 'quay.io/pypa/manylinux_2_24_x86_64:latest',
    '2_28': 'quay.io/pypa/manylinux_2_28_x86_64:latest'
  },
  'x86_64-unknown-linux-musl': {
    auto: 'messense/rust-musl-cross:x86_64-musl',
    musllinux_1_1: 'messense/rust-musl-cross:x86_64-musl',
    musllinux_1_2: 'messense/rust-musl-cross:x86_64-musl'
  },
  'i686-unknown-linux-gnu': {
    auto: 'quay.io/pypa/manylinux2010_i686:latest',
    '2010': 'quay.io/pypa/manylinux2010_i686:latest',
    '2_12': 'quay.io/pypa/manylinux2010_i686:latest',
    '2014': 'quay.io/pypa/manylinux2014_i686:latest',
    '2_17': 'quay.io/pypa/manylinux2014_i686:latest',
    '2_24': 'quay.io/pypa/manylinux_2_24_i686:latest'
  },
  'i686-unknown-linux-musl': {
    auto: 'messense/rust-musl-cross:i686-musl',
    musllinux_1_1: 'messense/rust-musl-cross:i686-musl',
    musllinux_1_2: 'messense/rust-musl-cross:i686-musl'
  },
  'aarch64-unknown-linux-gnu': {
    auto: 'messense/manylinux2014-cross:aarch64',
    '2014': 'messense/manylinux2014-cross:aarch64',
    '2_17': 'messense/manylinux2014-cross:aarch64',
    '2_24': 'messense/manylinux_2_24-cross:aarch64',
    '2_28': 'messense/manylinux_2_28-cross:aarch64'
  },
  'aarch64-unknown-linux-musl': {
    auto: 'messense/rust-musl-cross:aarch64-musl',
    musllinux_1_1: 'messense/rust-musl-cross:aarch64-musl',
    musllinux_1_2: 'messense/rust-musl-cross:aarch64-musl'
  },
  'armv7-unknown-linux-gnueabihf': {
    auto: 'messense/manylinux2014-cross:armv7',
    '2014': 'messense/manylinux2014-cross:armv7',
    '2_17': 'messense/manylinux2014-cross:armv7',
    '2_24': 'messense/manylinux_2_24-cross:armv7',
    '2_28': 'messense/manylinux_2_24-cross:armv7'
  },
  'armv7-unknown-linux-musleabihf': {
    auto: 'messense/rust-musl-cross:armv7-musleabihf',
    musllinux_1_1: 'messense/rust-musl-cross:armv7-musleabihf',
    musllinux_1_2: 'messense/rust-musl-cross:armv7-musleabihf'
  },
  'powerpc64-unknown-linux-gnu': {
    auto: 'messense/manylinux2014-cross:ppc64',
    '2014': 'messense/manylinux2014-cross:ppc64',
    '2_17': 'messense/manylinux2014-cross:ppc64'
  },
  'powerpc64le-unknown-linux-gnu': {
    auto: 'messense/manylinux2014-cross:ppc64le',
    '2014': 'messense/manylinux2014-cross:ppc64le',
    '2_17': 'messense/manylinux2014-cross:ppc64le',
    '2_24': 'messense/manylinux_2_24-cross:ppc64le',
    '2_28': 'messense/manylinux_2_24-cross:ppc64le'
  },
  'powerpc64le-unknown-linux-musl': {
    auto: 'messense/rust-musl-cross:powerpc64le-musl',
    musllinux_1_1: 'messense/rust-musl-cross:powerpc64le-musl',
    musllinux_1_2: 'messense/rust-musl-cross:powerpc64le-musl'
  },
  's390x-unknown-linux-gnu': {
    auto: 'messense/manylinux2014-cross:s390x',
    '2014': 'messense/manylinux2014-cross:s390x',
    '2_17': 'messense/manylinux2014-cross:s390x',
    '2_24': 'messense/manylinux_2_24-cross:s390x',
    '2_28': 'messense/manylinux_2_24-cross:s390x'
  }
}

const DEFAULT_CONTAINER = DEFAULT_CONTAINERS[DEFAULT_TARGET[process.arch]]

/**
 * Rust target aliases by platform
 */
const TARGET_ALIASES: Record<string, Record<string, string>> = {
  darwin: {
    x64: 'x86_64-apple-darwin',
    x86_64: 'x86_64-apple-darwin',
    aarch64: 'aarch64-apple-darwin'
  },
  manylinux: {
    x64: 'x86_64-unknown-linux-gnu',
    x86_64: 'x86_64-unknown-linux-gnu',
    i686: 'i686-unknown-linux-gnu',
    x86: 'i686-unknown-linux-gnu',
    aarch64: 'aarch64-unknown-linux-gnu',
    armv7: 'armv7-unknown-linux-gnueabihf',
    armv7l: 'armv7-unknown-linux-gnueabihf',
    ppc64le: 'powerpc64le-unknown-linux-gnu',
    ppc64: 'powerpc64-unknown-linux-gnu',
    s390x: 's390x-unknown-linux-gnu'
  },
  musllinux: {
    x64: 'x86_64-unknown-linux-musl',
    x86_64: 'x86_64-unknown-linux-musl',
    i686: 'i686-unknown-linux-musl',
    x86: 'i686-unknown-linux-musl',
    aarch64: 'aarch64-unknown-linux-musl',
    armv7: 'armv7-unknown-linux-musleabihf',
    armv7l: 'armv7-unknown-linux-musleabihf',
    ppc64le: 'powerpc64le-unknown-linux-musl'
  },
  win32: {
    x64: 'x86_64-pc-windows-msvc',
    x86_64: 'x86_64-pc-windows-msvc',
    i686: 'i686-pc-windows-msvc',
    x86: 'i686-pc-windows-msvc',
    aarch64: 'aarch64-pc-windows-msvc'
  }
}

/**
 * Get Rust target full name
 */
function getRustTarget(args: string[]): string {
  let target = core.getInput('target')
  if (!target && args.length > 0) {
    const val = getCliValue(args, '--target')
    if (val && val.length > 0) {
      target = val
    }
  }
  if (process.platform === 'linux') {
    const manylinux = core.getInput('manylinux')
    if (manylinux.startsWith('musllinux')) {
      return TARGET_ALIASES['musllinux']?.[target] || target
    } else {
      return TARGET_ALIASES['manylinux']?.[target] || target
    }
  }
  return TARGET_ALIASES[process.platform]?.[target] || target
}

function getCargoHome(): string {
  const home = os.homedir()
  return process.env.CARGO_HOME || path.join(home, '.cargo')
}

function getCargoCachePaths(): string[] {
  const cargoHome = getCargoHome()
  const paths = []
  if (existsSync(path.join(cargoHome, 'registry'))) {
    paths.push(path.join(cargoHome, 'registry'))
  }
  if (existsSync(path.join(cargoHome, 'git'))) {
    paths.push(path.join(cargoHome, 'git'))
  }
  if (existsSync(path.join(cargoHome, '.crates2.json'))) {
    paths.push(path.join(cargoHome, '.crates2.json'))
  }
  if (existsSync(path.join(cargoHome, '.crates.toml'))) {
    paths.push(path.join(cargoHome, '.crates.toml'))
  }
  return paths
}

function getCliValue(args: string[], key: string): string | undefined {
  const index = args.indexOf(key)
  if (index !== -1 && args[index + 1] !== undefined) {
    return args[index + 1]
  }
  return undefined
}

function getCargoTargetDir(args: string[]): string {
  let targetDir = 'target'
  const val = getCliValue(args, '--target-dir')
  const manifestPath =
    getCliValue(args, '--manifest-path') || getCliValue(args, '-m')
  if (val && val.length > 0) {
    targetDir = val
  } else if (
    process.env.CARGO_TARGET_DIR &&
    process.env.CARGO_TARGET_DIR.length > 0
  ) {
    targetDir = process.env.CARGO_TARGET_DIR
  } else if (manifestPath && manifestPath.length > 0) {
    targetDir = path.join(path.dirname(manifestPath), 'target')
  }
  return targetDir
}

/**
 * Find maturin version
 */
function findVersion(): string {
  const version = core.getInput('maturin-version').toLowerCase()
  if (version !== 'latest') {
    if (!version.startsWith('v')) {
      return `v${version}`
    }
  }
  return version
}

/**
 * Download and return the path to an executable maturin tool
 * @param string tag The tag to download
 */
async function downloadMaturin(tag: string): Promise<string> {
  let name: string
  let zip = false
  const arch = process.arch === 'arm64' ? 'aarch64' : 'x86_64'
  if (IS_WINDOWS) {
    name = `maturin-${arch}-pc-windows-msvc.zip`
    zip = true
  } else if (IS_MACOS) {
    name = `maturin-${arch}-apple-darwin.tar.gz`
  } else {
    name = `maturin-${arch}-unknown-linux-musl.tar.gz`
  }
  const url =
    tag === 'latest'
      ? `https://github.com/PyO3/maturin/releases/latest/download/${name}`
      : `https://github.com/PyO3/maturin/releases/download/${tag}/${name}`
  const tool = await tc.downloadTool(url)
  let toolPath: string
  if (zip) {
    toolPath = await tc.extractZip(tool)
  } else {
    toolPath = await tc.extractTar(tool)
  }

  let exe: string
  if (!IS_WINDOWS) {
    exe = path.join(toolPath, 'maturin')
    await fs.chmod(exe, 0o755)
  } else {
    exe = path.join(toolPath, 'maturin.exe')
  }
  return Promise.resolve(exe)
}

async function installMaturin(tag: string): Promise<string> {
  try {
    const exe = await io.which('maturin', true)
    core.info(`Found 'maturin' at ${exe}`)
    return exe
  } catch (error) {
    const exe = await downloadMaturin(tag)
    core.info(`Installed 'maturin' to ${exe}`)
    core.addPath(path.dirname(exe))
    return exe
  }
}

/**
 * Build manylinux wheel using Docker
 * @param tag maturin release tag, ie. version
 * @param args Docker args
 */
async function dockerBuild(
  tag: string,
  manylinux: string,
  args: string[]
): Promise<number> {
  // Strip `manylinux` and `manylinx_` prefix
  const target = getRustTarget(args)
  let container = core.getInput('container')
  if (container.length === 0) {
    // Get default Docker container with fallback
    container =
      DEFAULT_CONTAINERS[target]?.[manylinux] || DEFAULT_CONTAINER[manylinux]
  }

  const dockerArgs = []
  let image: string
  if (
    container.startsWith('pyo3/maturin') ||
    container.startsWith('konstin2/maturin')
  ) {
    if (container.includes(':')) {
      image = container
    } else {
      // pyo3/maturin support
      image = `${container}:${tag}`
      // override entrypoint
      dockerArgs.push('--entrypoint', '/bin/bash')
    }
  } else {
    image = container
  }

  const imageExists =
    (await exec.exec('docker', ['inspect', '--type=image', image], {
      silent: true,
      ignoreReturnCode: true
    })) === 0
  if (!imageExists) {
    core.startGroup('Pull Docker image')
    core.info(`Using ${image} Docker image`)
    const exitCode = await exec.exec('docker', ['pull', image])
    if (exitCode !== 0) {
      throw new Error(`maturin: 'docker pull' returned ${exitCode}`)
    }
    core.endGroup()
  } else {
    core.info(`Using existing ${image} Docker image`)
  }

  const dockerEnvs = []
  for (const env of Object.keys(process.env)) {
    if (
      env.startsWith('CARGO_') ||
      env.startsWith('RUST') ||
      env.startsWith('MATURIN_') ||
      env.startsWith('PYO3_')
    ) {
      dockerEnvs.push('-e')
      dockerEnvs.push(env)
    }
  }

  let cargoHomeBin = '$HOME/.cargo/bin'
  const cargoCachePaths = getCargoCachePaths()
  if (cargoCachePaths.length > 0) {
    const cargoHome = getCargoHome()
    dockerEnvs.push('-e')
    dockerEnvs.push(`CARGO_HOME=${cargoHome}`)
    cargoHomeBin = path.join(cargoHome, 'bin')
  }

  const dockerVolumes = []
  for (const vol of cargoCachePaths) {
    dockerVolumes.push('-v')
    dockerVolumes.push(`${vol}:${vol}`)
  }

  const arch = process.arch === 'arm64' ? 'aarch64' : 'x86_64'
  const url =
    tag === 'latest'
      ? `https://github.com/PyO3/maturin/releases/latest/download/maturin-${arch}-unknown-linux-musl.tar.gz`
      : `https://github.com/PyO3/maturin/releases/download/${tag}/maturin-${arch}-unknown-linux-musl.tar.gz`
  // Defaults to stable for Docker build
  const rustToolchain = core.getInput('rust-toolchain') || 'stable'
  const rustupComponents = core.getInput('rustup-components')
  const commands = [
    '#!/bin/bash',
    // Stop on first error
    'set -e',
    // Install Rust
    'echo "::group::Install Rust"',
    `which rustup > /dev/null || curl --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain ${rustToolchain}`,
    `export PATH="${cargoHomeBin}:$PATH"`,
    `rustup override set ${rustToolchain}`,
    `rustup component add llvm-tools-preview || true`,
    'echo "::endgroup::"',
    // Add all supported python versions to PATH
    'export PATH="$PATH:/opt/python/cp36-cp36m/bin:/opt/python/cp37-cp37m/bin:/opt/python/cp38-cp38/bin:/opt/python/cp39-cp39/bin"',
    // Install maturin
    'echo "::group::Install maturin"',
    `curl -L ${url} | tar -xz -C /usr/local/bin`,
    'maturin --version || true',
    'which patchelf > /dev/null || python3 -m pip install patchelf',
    'echo "::endgroup::"'
  ]
  if (args.includes('--zig')) {
    commands.push(
      'echo "::group::Install Zig"',
      'python3 -m pip install ziglang',
      'echo "::endgroup::"'
    )
  }
  if (target.length > 0) {
    commands.push(
      'echo "::group::Install Rust target"',
      `if [[ ! -d $(rustc --print target-libdir --target ${target}) ]]; then rustup target add ${target}; fi`,
      'echo "::endgroup::"'
    )
  }
  if (rustupComponents.length > 0) {
    commands.push(
      'echo "::group::Install Extra Rust components"',
      `rustup component add ${rustupComponents}`,
      'echo "::endgroup::"'
    )
  }
  commands.push(`maturin ${args.join(' ')}`)

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const workspace = process.env.GITHUB_WORKSPACE!
  const scriptPath = path.join(workspace, 'run-maturin-action.sh')
  writeFileSync(scriptPath, commands.join('\n'))
  await fs.chmod(scriptPath, 0o755)

  const targetDir = getCargoTargetDir(args)

  core.startGroup('Cleanup build scripts artifact directory')
  const debugBuildDir = path.join(targetDir, 'debug', 'build')
  if (existsSync(debugBuildDir)) {
    await exec.exec('sudo', ['rm', '-rf', debugBuildDir], {
      ignoreReturnCode: true
    })
  }
  const releaseBuildDir = path.join(targetDir, 'release', 'build')
  if (existsSync(debugBuildDir)) {
    await exec.exec('sudo', ['rm', '-rf', releaseBuildDir], {
      ignoreReturnCode: true
    })
  }
  core.endGroup()

  const exitCode = await exec.exec('docker', [
    'run',
    '--rm',
    '--workdir',
    workspace,
    // A list of environment variables
    '-e',
    'DEBIAN_FRONTEND=noninteractive',
    '-e',
    'ARCHFLAGS',
    '-e',
    '_PYTHON_SYSCONFIGDATA_NAME',
    ...dockerEnvs,
    // Mount $GITHUB_WORKSPACE at the same path
    '-v',
    `${workspace}:${workspace}`,
    ...dockerVolumes,
    ...dockerArgs,
    image,
    scriptPath
  ])
  // Fix file permissions
  if (IS_LINUX || IS_MACOS) {
    core.startGroup('Fix file permissions')
    core.info(`Fixing file permissions for target directory: ${targetDir}`)
    const uid = process.getuid()
    const gid = process.getgid()
    await exec.exec('sudo', ['chown', `${uid}:${gid}`, '-R', targetDir], {
      ignoreReturnCode: true
    })
    core.endGroup()
  }
  return exitCode
}

/**
 * Install Rust target using rustup
 * @param target Rust target name
 */
async function installRustTarget(
  target: string,
  toolchain: string
): Promise<void> {
  if (!target || target.length === 0) {
    return
  }
  const args = ['--print', 'target-libdir', '--target', target]
  if (toolchain.length > 0) {
    args.unshift(`+${toolchain}`)
  }
  const res = await mexec.exec('rustc', args, true)
  if (res.stderr !== '' && !res.success) {
    throw new Error(res.stderr)
  } else if (existsSync(res.stdout.trim())) {
    // Target already installed
    return
  }
  if (toolchain.length > 0) {
    await exec.exec('rustup', [
      'target',
      'add',
      '--toolchain',
      toolchain,
      target
    ])
  } else {
    await exec.exec('rustup', ['target', 'add', target])
  }
}

async function addToolCachePythonVersionsToPath(): Promise<void> {
  const allPythonVersions = tc.findAllVersions('python')
  for (const ver of allPythonVersions) {
    const installDir = tc.find('Python', ver)
    if (installDir) {
      core.info(`Python version ${ver} was found in the local cache`)
      core.addPath(installDir)
      core.addPath(path.join(installDir, 'bin'))
    }
  }
}

async function innerMain(): Promise<void> {
  const rustToolchain = core.getInput('rust-toolchain')
  const rustupComponents = core.getInput('rustup-components')
  const inputArgs = core.getInput('args')
  const args = stringArgv(inputArgs)
  const command = core.getInput('command')
  args.unshift(command)
  const target = getRustTarget(args)

  let useDocker = false
  // Only build and publish commands has --manylinux and --target options
  let manylinux = core.getInput('manylinux').replace(/^manylinux_?/, '')
  if (['build', 'publish'].includes(command)) {
    // manylinux defaults to auto for the publish command
    if (command === 'publish' && !manylinux) {
      manylinux = 'auto'
    }
    // manylinux defaults to auto if cross compiling
    if (
      process.arch === 'x64' &&
      !manylinux &&
      target.includes('linux') &&
      !(target.includes('x86_64') || target.includes('i686'))
    ) {
      manylinux = 'auto'
    }

    if (manylinux.length > 0 && IS_LINUX) {
      if (manylinux !== 'auto') {
        // Use lowest compatible manylinux version
        args.push('--manylinux', manylinux)
      }
      // User can disable Docker build by set manylinux/container to off
      useDocker = manylinux !== 'off' && core.getInput('container') !== 'off'
    }

    if (target.length > 0 && !args.includes('--target')) {
      args.push('--target', target)
    }
    if (!useDocker) {
      core.startGroup('Install Rust target')
      if (rustToolchain.length > 0) {
        await exec.exec('rustup', ['override', 'set', rustToolchain])
        await exec.exec('rustup', ['component', 'add', 'llvm-tools-preview'], {
          ignoreReturnCode: true
        })
      }
      if (rustupComponents.length > 0) {
        const rustupArgs = ['component', 'add'].concat(
          rustupComponents.split(' ')
        )
        await exec.exec('rustup', rustupArgs)
      }
      await installRustTarget(target, rustToolchain)
      core.endGroup()
    }
  }

  const tag = findVersion()

  let exitCode: number
  if (useDocker) {
    exitCode = await dockerBuild(tag, manylinux, args)
  } else {
    if (IS_MACOS && !process.env.pythonLocation) {
      addToolCachePythonVersionsToPath()
    }

    core.startGroup('Install maturin')
    core.info(`Installing 'maturin' from tag '${tag}'`)
    const maturinPath = await installMaturin(tag)
    await exec.exec(maturinPath, ['--version'], {ignoreReturnCode: true})
    if (IS_LINUX) {
      await exec.exec('python3', ['-m', 'pip', 'install', 'patchelf'])
    }
    core.endGroup()
    if (args.includes('--zig')) {
      core.startGroup('Install Zig')
      await exec.exec('python3', ['-m', 'pip', 'install', 'ziglang'])
      core.endGroup()
    }

    // Setup additional env vars for macOS arm64/universal2 build
    const isUniversal2 = args.includes('--universal2')
    const isArm64 = IS_MACOS && target.startsWith('aarch64')
    const env: Record<string, string> = {}
    for (const [k, v] of Object.entries(process.env)) {
      if (v !== undefined) {
        env[k] = v
      }
    }
    if (isUniversal2 || isArm64) {
      const buildEnvName = isUniversal2 ? 'universal2' : 'arm64'
      core.startGroup(`Prepare macOS ${buildEnvName} build environment`)
      if (isUniversal2) {
        await installRustTarget('x86_64-apple-darwin', rustToolchain)
      }
      await installRustTarget('aarch64-apple-darwin', rustToolchain)
      env.DEVELOPER_DIR = '/Applications/Xcode.app/Contents/Developer'
      env.SDKROOT =
        '/Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX.sdk'
      env.MACOSX_DEPLOYMENT_TARGET = '10.9'
      core.endGroup()
    }

    let fullCommand = `${maturinPath} ${args.join(' ')}`
    if (command === 'upload') {
      // Expand globs for upload command
      const uploadArgs = []
      for (const arg of args.slice(1)) {
        if (arg.startsWith('-')) {
          uploadArgs.push(arg)
        } else {
          const globber = await glob.create(arg)
          for await (const file of globber.globGenerator()) {
            uploadArgs.push(file)
          }
        }
      }
      fullCommand = `${maturinPath} ${command} ${uploadArgs.join(' ')}`
    }
    exitCode = await exec.exec(fullCommand, undefined, {env})
  }
  if (exitCode !== 0) {
    throw new Error(`maturin: returned ${exitCode}`)
  }
}

async function main(): Promise<void> {
  try {
    await innerMain()
  } catch (err: unknown) {
    if (err instanceof Error) {
      core.setFailed(err.message)
    }
  }
}

main()

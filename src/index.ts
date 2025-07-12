import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as glob from '@actions/glob'
import * as mexec from './exec'
import * as path from 'path'
import * as tc from '@actions/tool-cache'
import * as os from 'os'
import {existsSync, promises as fs, writeFileSync} from 'fs'
import stringArgv from 'string-argv'
import {JsonMap, parse as parseTOML} from '@iarna/toml'

const TOKEN = core.getInput('token') || process.env.GITHUB_TOKEN
const AUTH = !TOKEN ? undefined : `token ${TOKEN}`

const IS_MACOS = process.platform === 'darwin'
const IS_WINDOWS = process.platform === 'win32'
const IS_LINUX = process.platform === 'linux'

const DEFAULT_TARGET: Record<string, string> = {
  x64: 'x86_64-unknown-linux-gnu',
  arm64: 'aarch64-unknown-linux-gnu'
}

const DEFAULT_CONTAINERS: Record<
  string,
  Record<string, Record<string, string>>
> = {
  x64: {
    'x86_64-unknown-linux-gnu': {
      auto: 'quay.io/pypa/manylinux2014_x86_64:latest',
      '2010': 'quay.io/pypa/manylinux2010_x86_64:latest',
      '2_12': 'quay.io/pypa/manylinux2010_x86_64:latest',
      '2014': 'quay.io/pypa/manylinux2014_x86_64:latest',
      '2_17': 'quay.io/pypa/manylinux2014_x86_64:latest',
      '2_24': 'quay.io/pypa/manylinux_2_24_x86_64:latest',
      '2_28': 'quay.io/pypa/manylinux_2_28_x86_64:latest',
      '2_34': 'quay.io/pypa/manylinux_2_34_x86_64:latest'
    },
    'x86_64-unknown-linux-musl': {
      auto: 'ghcr.io/rust-cross/rust-musl-cross:x86_64-musl',
      musllinux_1_1: 'ghcr.io/rust-cross/rust-musl-cross:x86_64-musl',
      musllinux_1_2: 'ghcr.io/rust-cross/rust-musl-cross:x86_64-musl'
    },
    'i686-unknown-linux-gnu': {
      auto: 'quay.io/pypa/manylinux2014_i686:latest',
      '2010': 'quay.io/pypa/manylinux2010_i686:latest',
      '2_12': 'quay.io/pypa/manylinux2010_i686:latest',
      '2014': 'quay.io/pypa/manylinux2014_i686:latest',
      '2_17': 'quay.io/pypa/manylinux2014_i686:latest',
      '2_24': 'quay.io/pypa/manylinux_2_24_i686:latest'
    },
    'i686-unknown-linux-musl': {
      auto: 'ghcr.io/rust-cross/rust-musl-cross:i686-musl',
      musllinux_1_1: 'ghcr.io/rust-cross/rust-musl-cross:i686-musl',
      musllinux_1_2: 'ghcr.io/rust-cross/rust-musl-cross:i686-musl'
    },
    'aarch64-unknown-linux-gnu': {
      auto: 'ghcr.io/rust-cross/manylinux2014-cross:aarch64',
      '2014': 'ghcr.io/rust-cross/manylinux2014-cross:aarch64',
      '2_17': 'ghcr.io/rust-cross/manylinux2014-cross:aarch64',
      '2_24': 'messense/manylinux_2_24-cross:aarch64',
      '2_28': 'ghcr.io/rust-cross/manylinux_2_28-cross:aarch64'
    },
    'aarch64-unknown-linux-musl': {
      auto: 'ghcr.io/rust-cross/rust-musl-cross:aarch64-musl',
      musllinux_1_1: 'ghcr.io/rust-cross/rust-musl-cross:aarch64-musl',
      musllinux_1_2: 'ghcr.io/rust-cross/rust-musl-cross:aarch64-musl'
    },
    'arm-unknown-linux-musleabihf': {
      auto: 'ghcr.io/rust-cross/rust-musl-cross:arm-musleabihf',
      musllinux_1_1: 'ghcr.io/rust-cross/rust-musl-cross:arm-musleabihf',
      musllinux_1_2: 'ghcr.io/rust-cross/rust-musl-cross:arm-musleabihf'
    },
    'armv7-unknown-linux-gnueabihf': {
      auto: 'ghcr.io/rust-cross/manylinux2014-cross:armv7',
      '2014': 'ghcr.io/rust-cross/manylinux2014-cross:armv7',
      '2_17': 'ghcr.io/rust-cross/manylinux2014-cross:armv7',
      '2_24': 'messense/manylinux_2_24-cross:armv7',
      '2_28': 'ghcr.io/rust-cross/manylinux_2_28-cross:armv7'
    },
    'armv7-unknown-linux-musleabihf': {
      auto: 'ghcr.io/rust-cross/rust-musl-cross:armv7-musleabihf',
      musllinux_1_1: 'ghcr.io/rust-cross/rust-musl-cross:armv7-musleabihf',
      musllinux_1_2: 'ghcr.io/rust-cross/rust-musl-cross:armv7-musleabihf'
    },
    'powerpc64-unknown-linux-gnu': {
      auto: 'ghcr.io/rust-cross/manylinux2014-cross:ppc64',
      '2014': 'ghcr.io/rust-cross/manylinux2014-cross:ppc64',
      '2_17': 'ghcr.io/rust-cross/manylinux2014-cross:ppc64'
    },
    'powerpc64le-unknown-linux-gnu': {
      auto: 'ghcr.io/rust-cross/manylinux2014-cross:ppc64le',
      '2014': 'ghcr.io/rust-cross/manylinux2014-cross:ppc64le',
      '2_17': 'ghcr.io/rust-cross/manylinux2014-cross:ppc64le',
      '2_24': 'messense/manylinux_2_24-cross:ppc64le',
      '2_28': 'ghcr.io/rust-cross/manylinux_2_28-cross:ppc64le'
    },
    'powerpc64le-unknown-linux-musl': {
      auto: 'ghcr.io/rust-cross/rust-musl-cross:powerpc64le-musl',
      musllinux_1_1: 'ghcr.io/rust-cross/rust-musl-cross:powerpc64le-musl',
      musllinux_1_2: 'ghcr.io/rust-cross/rust-musl-cross:powerpc64le-musl'
    },
    's390x-unknown-linux-gnu': {
      auto: 'ghcr.io/rust-cross/manylinux2014-cross:s390x',
      '2014': 'ghcr.io/rust-cross/manylinux2014-cross:s390x',
      '2_17': 'ghcr.io/rust-cross/manylinux2014-cross:s390x',
      '2_24': 'messense/manylinux_2_24-cross:s390x',
      '2_28': 'ghcr.io/rust-cross/manylinux_2_28-cross:s390x'
    },
    'riscv64gc-unknown-linux-gnu': {
      auto: 'ghcr.io/rust-cross/manylinux_2_31-cross:riscv64',
      '2_31': 'ghcr.io/rust-cross/manylinux_2_31-cross:riscv64'
    },
    'loongarch64-unknown-linux-gnu': {
      auto: 'ghcr.io/rust-cross/manylinux_2_36-cross:loongarch64',
      '2_36': 'ghcr.io/rust-cross/manylinux_2_36-cross:loongarch64'
    }
  },
  arm64: {
    'x86_64-unknown-linux-gnu': {
      auto: 'ghcr.io/rust-cross/manylinux2014-cross:x86_64',
      '2014': 'ghcr.io/rust-cross/manylinux2014-cross:x86_64',
      '2_17': 'ghcr.io/rust-cross/manylinux2014-cross:x86_64',
      '2_28': 'ghcr.io/rust-cross/manylinux_2_28-cross:x86_64'
    },
    'x86_64-unknown-linux-musl': {
      auto: 'ghcr.io/rust-cross/rust-musl-cross:x86_64-musl',
      musllinux_1_1: 'ghcr.io/rust-cross/rust-musl-cross:x86_64-musl',
      musllinux_1_2: 'ghcr.io/rust-cross/rust-musl-cross:x86_64-musl'
    },
    'i686-unknown-linux-gnu': {
      auto: 'ghcr.io/rust-cross/manylinux2014-cross:i686',
      '2014': 'ghcr.io/rust-cross/manylinux2014-cross:i686',
      '2_17': 'ghcr.io/rust-cross/manylinux2014-cross:i686'
    },
    'i686-unknown-linux-musl': {
      auto: 'ghcr.io/rust-cross/rust-musl-cross:i686-musl',
      musllinux_1_1: 'ghcr.io/rust-cross/rust-musl-cross:i686-musl',
      musllinux_1_2: 'ghcr.io/rust-cross/rust-musl-cross:i686-musl'
    },
    'aarch64-unknown-linux-gnu': {
      auto: 'quay.io/pypa/manylinux2014_aarch64:latest',
      '2014': 'quay.io/pypa/manylinux2014_aarch64:latest',
      '2_17': 'quay.io/pypa/manylinux2014_aarch64:latest',
      '2_28': 'quay.io/pypa/manylinux_2_28_aarch64:latest',
      '2_34': 'quay.io/pypa/manylinux_2_34_aarch64:latest'
    },
    'aarch64-unknown-linux-musl': {
      auto: 'ghcr.io/rust-cross/rust-musl-cross:aarch64-musl',
      musllinux_1_1: 'ghcr.io/rust-cross/rust-musl-cross:aarch64-musl',
      musllinux_1_2: 'ghcr.io/rust-cross/rust-musl-cross:aarch64-musl'
    },
    'arm-unknown-linux-musleabihf': {
      auto: 'ghcr.io/rust-cross/rust-musl-cross:arm-musleabihf',
      musllinux_1_1: 'ghcr.io/rust-cross/rust-musl-cross:arm-musleabihf',
      musllinux_1_2: 'ghcr.io/rust-cross/rust-musl-cross:arm-musleabihf'
    },
    'armv7-unknown-linux-gnueabihf': {
      auto: 'ghcr.io/rust-cross/manylinux2014-cross:armv7',
      '2014': 'ghcr.io/rust-cross/manylinux2014-cross:armv7',
      '2_17': 'ghcr.io/rust-cross/manylinux2014-cross:armv7',
      '2_28': 'ghcr.io/rust-cross/manylinux_2_28-cross:armv7'
    },
    'armv7-unknown-linux-musleabihf': {
      auto: 'ghcr.io/rust-cross/rust-musl-cross:armv7-musleabihf',
      musllinux_1_1: 'ghcr.io/rust-cross/rust-musl-cross:armv7-musleabihf',
      musllinux_1_2: 'ghcr.io/rust-cross/rust-musl-cross:armv7-musleabihf'
    },
    'powerpc64-unknown-linux-gnu': {
      auto: 'ghcr.io/rust-cross/manylinux2014-cross:ppc64',
      '2014': 'ghcr.io/rust-cross/manylinux2014-cross:ppc64',
      '2_17': 'ghcr.io/rust-cross/manylinux2014-cross:ppc64'
    },
    'powerpc64le-unknown-linux-gnu': {
      auto: 'ghcr.io/rust-cross/manylinux2014-cross:ppc64le',
      '2014': 'ghcr.io/rust-cross/manylinux2014-cross:ppc64le',
      '2_17': 'ghcr.io/rust-cross/manylinux2014-cross:ppc64le',
      '2_28': 'ghcr.io/rust-cross/manylinux_2_28-cross:ppc64le'
    },
    'powerpc64le-unknown-linux-musl': {
      auto: 'ghcr.io/rust-cross/rust-musl-cross:powerpc64le-musl',
      musllinux_1_1: 'ghcr.io/rust-cross/rust-musl-cross:powerpc64le-musl',
      musllinux_1_2: 'ghcr.io/rust-cross/rust-musl-cross:powerpc64le-musl'
    },
    's390x-unknown-linux-gnu': {
      auto: 'ghcr.io/rust-cross/manylinux2014-cross:s390x',
      '2014': 'ghcr.io/rust-cross/manylinux2014-cross:s390x',
      '2_17': 'ghcr.io/rust-cross/manylinux2014-cross:s390x',
      '2_28': 'ghcr.io/rust-cross/manylinux_2_28-cross:s390x'
    },
    'riscv64gc-unknown-linux-gnu': {
      auto: 'ghcr.io/rust-cross/manylinux_2_31-cross:riscv64',
      '2_31': 'ghcr.io/rust-cross/manylinux_2_31-cross:riscv64'
    },
    'loongarch64-unknown-linux-gnu': {
      auto: 'ghcr.io/rust-cross/manylinux_2_36-cross:loongarch64',
      '2_36': 'ghcr.io/rust-cross/manylinux_2_36-cross:loongarch64'
    }
  }
}

const DEFAULT_CONTAINER =
  DEFAULT_CONTAINERS[process.arch][DEFAULT_TARGET[process.arch]]

/**
 * Rust target aliases by platform
 */
const TARGET_ALIASES: Record<string, Record<string, string>> = {
  darwin: {
    x64: 'x86_64-apple-darwin',
    x86_64: 'x86_64-apple-darwin',
    aarch64: 'aarch64-apple-darwin',
    universal2: 'universal2-apple-darwin'
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
    arm: 'arm-unknown-linux-musleabihf',
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
 * Allowed prefixes for env variables to pass to docker
 */
const ALLOWED_ENV_PREFIXES: string[] = [
  'ACTIONS_',
  'CARGO_',
  'CC',
  'CFLAGS',
  'CMAKE_',
  'CPPFLAGS',
  'CXX',
  'CXXFLAGS',
  'GITHUB_',
  'JEMALLOC_',
  'LDFLAGS',
  'LD_',
  'MATURIN_',
  'PYO3_',
  'RUST',
  'SCCACHE_',
  'TARGET_'
]

/**
 * Forbidden env variables that should not be passed to docker
 */
const FORBIDDEN_ENVS: string[] = ['CARGO_HOME']

/**
 * Does the target has Zig cross compilation support
 */
function hasZigSupport(target: string): boolean {
  if (target.startsWith('s390x')) {
    return false
  }
  return true
}

/**
 * Get Rust target full name
 */
function getRustTarget(args: string[]): string {
  let target = core.getInput('target')
  if (!target && args.length > 0) {
    const val = getCliValue(args, '--target') || getCliValue(args, '--target=')
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

function getWorkingDirectory(): string {
  const workspace = process.env.GITHUB_WORKSPACE!
  let workdir = core.getInput('working-directory')
  if (workdir.length > 0) {
    if (!path.isAbsolute(workdir)) {
      workdir = path.join(workspace, workdir)
    }
  } else {
    workdir = workspace
  }
  return workdir
}

function getManifestDir(args: string[]): string {
  const workdir = getWorkingDirectory()
  const manifestPath =
    getCliValue(args, '--manifest-path') || getCliValue(args, '-m')
  return manifestPath ? path.dirname(path.join(workdir, manifestPath)) : workdir
}

function parseRustToolchain(content: string): string {
  const toml = parseTOML(content.toString())
  const toolchain = toml?.toolchain as JsonMap
  return (toolchain?.channel as string) || ''
}

async function getRustToolchain(args: string[]): Promise<string> {
  let rustToolchain = core.getInput('rust-toolchain')
  if (rustToolchain.length > 0) {
    return rustToolchain
  }

  const root = process.env.GITHUB_WORKSPACE!
  const manifestDir = getManifestDir(args)
  let currentDir = manifestDir

  while (true) {
    const toolchainToml = path.join(currentDir, 'rust-toolchain.toml')
    const toolchain = path.join(currentDir, 'rust-toolchain')
    if (existsSync(toolchainToml)) {
      const content = await fs.readFile(toolchainToml)
      rustToolchain = parseRustToolchain(content.toString())
      core.info(`Found Rust toolchain ${rustToolchain} in rust-toolchain.toml `)
      break
    } else {
      core.debug(`${toolchainToml} doesn't exist`)
    }
    if (existsSync(toolchain)) {
      rustToolchain = (await fs.readFile(toolchain)).toString().trim()
      if (rustToolchain.includes('[toolchain]')) {
        rustToolchain = parseRustToolchain(rustToolchain)
      }
      core.info(`Found Rust toolchain ${rustToolchain} in rust-toolchain `)
      break
    } else {
      core.debug(`${toolchain} doesn't exist`)
    }
    if (currentDir === root) {
      core.debug(
        `No rust-toolchain.toml or rust-toolchain found inside ${root}`
      )
      break
    }
    currentDir = path.dirname(currentDir)
  }
  return rustToolchain
}

function getCliValue(args: string[], key: string): string | undefined {
  const index = args.indexOf(key)
  if (index !== -1) {
    if (key.endsWith('=')) {
      return args[index].slice(key.length)
    } else if (args[index + 1] !== undefined) {
      return args[index + 1]
    }
  }
  return undefined
}

async function getCargoTargetDir(args: string[]): Promise<string> {
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
    const res = await mexec.exec(
      'cargo',
      ['metadata', '--format-version', '1', '--manifest-path', manifestPath],
      true
    )
    if (res.success) {
      const metadata = JSON.parse(res.stdout)
      targetDir = metadata.target_directory
    } else {
      core.warning('Failed to get Cargo target directory from `cargo metadata`')
      core.debug(res.stderr)
      targetDir = path.join(path.dirname(manifestPath), 'target')
    }
  }
  return targetDir
}

/**
 * Python's prelease versions look like `3.7.0b2`.
 * This is the one part of Python versioning that does not look like semantic versioning, which specifies `3.7.0-b2`.
 * If the version spec contains prerelease versions, we need to convert them to the semantic version equivalent.
 */
function pythonVersionToSemantic(versionSpec: string): string {
  const prereleaseVersion = /(\d+\.\d+\.\d+)((?:a|b|rc)\d*)/g
  return versionSpec.replace(prereleaseVersion, '$1-$2')
}

async function findReleaseFromManifest(
  semanticVersionSpec: string,
  architecture: string
): Promise<tc.IToolRelease | undefined> {
  const manifest: tc.IToolRelease[] = await tc.getManifestFromRepo(
    'PyO3',
    'maturin-action',
    AUTH,
    'main'
  )
  return await tc.findFromManifest(
    semanticVersionSpec,
    false,
    manifest,
    architecture
  )
}

/**
 * Find maturin version
 */
async function findVersion(args: string[]): Promise<string> {
  let version = core.getInput('maturin-version').toLowerCase()
  if (!version) {
    const manifestDir = getManifestDir(args)
    const pyprojectToml = path.join(manifestDir, 'pyproject.toml')
    if (existsSync(pyprojectToml)) {
      const content = await fs.readFile(pyprojectToml)
      const toml = parseTOML(content.toString())
      const buildSystem = (toml['build-system'] || {}) as JsonMap
      const requires = (buildSystem['requires'] || []) as string[]
      const maturin = requires.find(req => req.startsWith('maturin'))
      if (maturin) {
        core.info(
          `Found maturin version requirement ${maturin} specified in pyproject.toml`
        )
        const versionSpec = pythonVersionToSemantic(
          maturin.replace('maturin', '').replace(',', ' ').replace('==', '=')
        )
        core.debug(`maturin version spec: ${versionSpec}`)
        const release = await findReleaseFromManifest(versionSpec, 'x64')
        if (release) {
          version = `v${release.version}`
          core.info(`Found maturin release from manifest: ${version}`)
        } else {
          core.warning(
            `No maturin release found from requirement ${maturin}, fallback to latest`
          )
          version = 'latest'
        }
      } else {
        core.info(
          'maturin not found in [build-system.requires] section at ${pyprojectToml}, fallback to latest'
        )
        version = 'latest'
      }
    } else {
      core.info(
        `No pyproject.toml found at ${pyprojectToml}, fallback to latest`
      )
      version = 'latest'
    }
  } else if (version !== 'latest') {
    if (!version.startsWith('v')) {
      return `v${version}`
    }
  }
  return version
}

/**
 * Download and return the path to an executable maturin tool
 * @param tag string The tag to download
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
  const tool = await tc.downloadTool(url, undefined, AUTH)
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
  const versionSpec = tag.startsWith('v') ? tag.slice(1) : tag
  const installDir = tc.find('maturin', versionSpec, 'x64')
  if (installDir) {
    const binaryExtension = IS_WINDOWS ? '.exe' : ''
    const exe = path.join(installDir, `maturin${binaryExtension}`)
    core.addPath(installDir)
    return exe
  } else {
    const exe = await downloadMaturin(tag)
    core.info(`Installed 'maturin' to ${exe}`)
    core.addPath(path.dirname(exe))
    return exe
  }
}

async function getDockerContainer(
  target: string,
  manylinux: string,
  container: string
): Promise<string> {
  if (
    container.length === 0 ||
    container === 'on' ||
    container === 'auto' ||
    container === 'true'
  ) {
    // Get default Docker container with fallback
    container =
      DEFAULT_CONTAINERS[process.arch][target]?.[manylinux] ||
      DEFAULT_CONTAINER[manylinux]
  }
  return container
}

function xdg_config_home(): string {
  const config_home = process.env.XDG_CONFIG_HOME
  if (config_home) return config_home
  return `${os.homedir()}/.config`
}

function getBeforeScript(): string {
  // Only Linux is supported for now
  if (IS_LINUX) {
    return core.getInput('before-script-linux') || ''
  }
  return ''
}

/**
 * Build manylinux wheel using Docker
 * @param maturinRelease maturin release tag, ie. version
 * @param args Docker args
 */
async function dockerBuild(
  container: string,
  maturinRelease: string,
  hostHomeMount: string,
  args: string[]
): Promise<number> {
  const target = getRustTarget(args)
  const rustToolchain = (await getRustToolchain(args)) || 'stable'
  const dockerArgs = stringArgv(core.getInput('docker-options') || '')
  const sccache = core.getBooleanInput('sccache')

  const targetOrHostTriple = target ? target : DEFAULT_TARGET[process.arch]
  let image: string
  if (
    container.startsWith('ghcr.io/pyo3/maturin') ||
    container.startsWith('konstin2/maturin')
  ) {
    if (container.includes(':')) {
      image = container
    } else {
      // pyo3/maturin support
      image = `${container}:${maturinRelease}`
      // override entrypoint
      dockerArgs.push('--entrypoint', '/bin/bash')
    }
  } else if (
    !container.includes(':') &&
    DEFAULT_CONTAINERS[process.arch][targetOrHostTriple]?.[container]
  ) {
    // Use default container for example when `container: 2_27`
    image = DEFAULT_CONTAINERS[process.arch][targetOrHostTriple][container]
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

  const arch = process.arch === 'arm64' ? 'aarch64' : 'x86_64'
  const url =
    maturinRelease === 'latest'
      ? `https://github.com/PyO3/maturin/releases/latest/download/maturin-${arch}-unknown-linux-musl.tar.gz`
      : `https://github.com/PyO3/maturin/releases/download/${maturinRelease}/maturin-${arch}-unknown-linux-musl.tar.gz`
  const rustupComponents = core.getInput('rustup-components')
  const commands = [
    '#!/bin/bash',
    // Stop on first error
    'set -euo pipefail'
  ]
  if (
    target.length > 0 &&
    target.includes('linux') &&
    target.includes('i686')
  ) {
    commands.push(
      'echo "::group::Install libatomic"',
      'if command -v yum &> /dev/null; then yum install -y libatomic; else apt-get update && apt-get install -y libatomic1; fi',
      'echo "::endgroup::"'
    )
  }
  commands.push(
    // Install Rust
    'echo "::group::Install Rust"',
    // refer to https://github.com/rust-lang/rustup/issues/1167#issuecomment-367061388
    `command -v rustup &> /dev/null && { rm -frv ~/.rustup/toolchains/; rustup toolchain install stable; } || curl --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal`,
    'export PATH="$HOME/.cargo/bin:$HOME/.local/bin:$PATH"',
    `echo "Install Rust toolchain ${rustToolchain}"`,
    `rustup update --no-self-update ${rustToolchain}`,
    `rustup override set ${rustToolchain}`,
    `rustup component add llvm-tools-preview || true`,
    'echo "::endgroup::"',
    // Add all supported python versions to PATH
    'export PATH="$PATH:/opt/python/cp37-cp37m/bin:/opt/python/cp38-cp38/bin:/opt/python/cp39-cp39/bin:/opt/python/cp310-cp310/bin:/opt/python/cp311-cp311/bin:/opt/python/cp312-cp312/bin"',
    // Install maturin
    'echo "::group::Install maturin"',
    `curl -L ${url} | tar -xz -C /usr/local/bin`,
    'maturin --version || true',
    // Install uv
    'which uv > /dev/null || curl -LsSf https://astral.sh/uv/install.sh | sh',
    'which patchelf > /dev/null || uv tool install patchelf',
    'python3 -m pip install --user cffi || true', // Allow failure for now
    'echo "::endgroup::"'
  )
  if (args.includes('--zig')) {
    commands.push(
      'echo "::group::Install Zig"',
      'uv pip install --system --break-system-packages "ziglang<0.14.0"',
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
    const components = rustupComponents.split(/\s+/).join(' ')
    commands.push(
      'echo "::group::Install Extra Rust components"',
      `rustup component add ${components}`,
      'echo "::endgroup::"'
    )
  }

  const beforeScript = getBeforeScript()
  if (beforeScript.length > 0) {
    commands.push(
      'echo "::group::Run before script"',
      ...beforeScript.split('\n'),
      'echo "::endgroup::"'
    )
  }

  if (sccache) {
    commands.push(
      'echo "::group::Install sccache"',
      'uv tool install "sccache>=0.10.0"',
      'sccache --version',
      'echo "::endgroup::"'
    )
    setupSccacheEnv()
  }

  commands.push(`maturin ${args.join(' ')}`)
  if (sccache) {
    commands.push(
      'echo "::group::sccache stats"',
      'sccache --show-stats',
      'echo "::endgroup::"'
    )
  }

  const workspace = process.env.GITHUB_WORKSPACE!
  const scriptPath = path.join(
    process.env.RUNNER_TEMP!,
    'run-maturin-action.sh'
  )
  writeFileSync(scriptPath, commands.join('\n'))
  await fs.chmod(scriptPath, 0o755)

  const hostWorkspace = path.join(hostHomeMount, workspace)
  const hostScriptPath = path.join(hostHomeMount, scriptPath)

  const targetDir = await getCargoTargetDir(args)

  core.startGroup('Cleanup build scripts artifact directory')
  const debugBuildDir = path.join(targetDir, 'debug', 'build')
  if (existsSync(debugBuildDir)) {
    if (process.env.RUNNER_ALLOW_RUNASROOT === '1') {
      await exec.exec('rm', ['-rf', debugBuildDir], {
        ignoreReturnCode: true
      })
    } else {
      await exec.exec('sudo', ['rm', '-rf', debugBuildDir], {
        ignoreReturnCode: true
      })
    }
  }
  const releaseBuildDir = path.join(targetDir, 'release', 'build')
  if (existsSync(debugBuildDir)) {
    if (process.env.RUNNER_ALLOW_RUNASROOT === '1') {
      await exec.exec('rm', ['-rf', releaseBuildDir], {
        ignoreReturnCode: true
      })
    } else {
      await exec.exec('sudo', ['rm', '-rf', releaseBuildDir], {
        ignoreReturnCode: true
      })
    }
  }
  core.endGroup()

  const dockerEnvs = []
  for (const env of Object.keys(process.env)) {
    if (isDockerEnv(env)) {
      dockerEnvs.push('-e')
      dockerEnvs.push(env)
    }
  }

  const workdir = getWorkingDirectory()
  const dockerVolumes = []

  // forward ssh agent
  const ssh_auth_sock = process.env.SSH_AUTH_SOCK
  if (ssh_auth_sock) {
    dockerVolumes.push('-v')
    dockerVolumes.push(`${ssh_auth_sock}:/ssh-agent`)
    dockerEnvs.push('-e')
    dockerEnvs.push('SSH_AUTH_SOCK=/ssh-agent')
  }

  // mount git credentials
  const git_credentials = path.join(xdg_config_home(), 'git', 'credentials')
  const git_config = path.join(os.homedir(), '.gitconfig')
  if (existsSync(git_credentials) && existsSync(git_config)) {
    dockerVolumes.push('-v')
    dockerVolumes.push(`${git_config}:/root/.gitconfig`)
    dockerVolumes.push('-v')
    dockerVolumes.push(`${git_credentials}:/root/.config/git/.git-credentials`)
  }

  const exitCode = await exec.exec('docker', [
    'run',
    '--rm',
    '--workdir',
    workdir,
    // A list of environment variables
    '-e',
    'DEBIAN_FRONTEND=noninteractive',
    '-e',
    'ARCHFLAGS',
    '-e',
    '_PYTHON_SYSCONFIGDATA_NAME',
    ...dockerEnvs,
    '-v',
    `${hostScriptPath}:${scriptPath}`,
    // Mount $GITHUB_WORKSPACE at the same path
    '-v',
    `${hostWorkspace}:${workspace}`,
    ...dockerVolumes,
    ...dockerArgs,
    image,
    scriptPath
  ])
  // Fix file permissions
  if (process.getuid && process.getgid) {
    core.startGroup('Fix file permissions')
    core.info(`Fixing file permissions for target directory: ${targetDir}`)
    const uid = process.getuid()
    const gid = process.getgid()
    if (process.env.RUNNER_ALLOW_RUNASROOT === '1') {
      await exec.exec('chown', [`${uid}:${gid}`, '-R', targetDir], {
        ignoreReturnCode: true
      })
    } else {
      await exec.exec('sudo', ['chown', `${uid}:${gid}`, '-R', targetDir], {
        ignoreReturnCode: true
      })
    }

    const outDir = getCliValue(args, '--out') || getCliValue(args, '-o')
    if (outDir && existsSync(outDir)) {
      core.info(`Fixing file permissions for output directory: ${outDir}`)
      if (process.env.RUNNER_ALLOW_RUNASROOT === '1') {
        await exec.exec('chown', [`${uid}:${gid}`, '-R', outDir], {
          ignoreReturnCode: true
        })
      } else {
        await exec.exec('sudo', ['chown', `${uid}:${gid}`, '-R', outDir], {
          ignoreReturnCode: true
        })
      }
    }
    core.endGroup()
  }
  return exitCode
}

/**
 * Check if an environment variable should be passed to docker
 * @param env The name of the environment variable
 */
function isDockerEnv(env: string): boolean {
  if (!FORBIDDEN_ENVS.includes(env)) {
    for (const prefix of ALLOWED_ENV_PREFIXES) {
      if (env.startsWith(prefix)) {
        return true
      }
    }
  }
  return false
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
  if (toolchain && toolchain.length > 0) {
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
  const allPythonVersions = tc.findAllVersions('Python')
  for (const ver of allPythonVersions) {
    const installDir = tc.find('Python', ver)
    if (installDir) {
      core.info(`Python version ${ver} was found in the local cache`)
      core.addPath(installDir)
      core.addPath(path.join(installDir, 'bin'))
    }
  }
  const allPyPyVersions = tc.findAllVersions('PyPy')
  for (const ver of allPyPyVersions) {
    const installDir = tc.find('PyPy', ver)
    if (installDir) {
      core.info(`Python version ${ver} was found in the local cache`)
      core.addPath(installDir)
      core.addPath(path.join(installDir, 'bin'))
    }
  }
}

function setupSccacheEnv(): void {
  core.exportVariable('ACTIONS_CACHE_URL', process.env.ACTIONS_CACHE_URL || '')
  core.exportVariable(
    'ACTIONS_RUNTIME_TOKEN',
    process.env.ACTIONS_RUNTIME_TOKEN || ''
  )
  core.exportVariable('SCCACHE_GHA_ENABLED', 'true')
  core.exportVariable('RUSTC_WRAPPER', 'sccache')
}

/**
 * Build on host
 * @param maturinRelease maturin release tag, ie. version
 * @param args Docker args
 * @returns exit code
 */
async function hostBuild(
  maturinRelease: string,
  args: string[]
): Promise<number> {
  const command = core.getInput('command')
  const target = getRustTarget(args)
  // rust toolchain doesn't have a default version so we can use the one
  // that's already installed
  const rustToolchain = await getRustToolchain(args)
  const rustupComponents = core.getInput('rustup-components')
  const workdir = getWorkingDirectory()
  const sccache = core.getBooleanInput('sccache')
  const isUniversal2 =
    args.includes('--universal2') || target === 'universal2-apple-darwin'

  core.startGroup('Install Rust target')
  if (rustToolchain && rustToolchain.length > 0) {
    core.info(`Installing Rust toolchain ${rustToolchain}`)
    await exec.exec('rustup', ['update', '--no-self-update', rustToolchain])
    await exec.exec('rustup', ['override', 'set', rustToolchain])
    await exec.exec('rustup', ['component', 'add', 'llvm-tools-preview'], {
      ignoreReturnCode: true
    })
  }
  if (rustupComponents.length > 0) {
    const rustupArgs = ['component', 'add'].concat(
      rustupComponents.split(/\s+/)
    )
    await exec.exec('rustup', rustupArgs)
  }
  if (!isUniversal2) {
    await installRustTarget(target, rustToolchain)
  }
  core.endGroup()

  if (IS_MACOS && !process.env.pythonLocation) {
    addToolCachePythonVersionsToPath()
  }

  core.startGroup('Install maturin')
  core.info(`Installing 'maturin' from tag '${maturinRelease}'`)
  const maturinPath = await installMaturin(maturinRelease)
  await exec.exec(maturinPath, ['--version'], {ignoreReturnCode: true})
  await exec.exec('python3', ['-m', 'pip', 'install', 'cffi'], {
    ignoreReturnCode: true
  })
  // TODO: switch to uv tool install
  if (IS_LINUX) {
    await exec.exec('python3', ['-m', 'pip', 'install', 'patchelf'])
  }
  core.endGroup()
  if (args.includes('--zig')) {
    core.startGroup('Install Zig')
    await exec.exec('python3', ['-m', 'pip', 'install', 'ziglang<0.14.0'])
    core.endGroup()
  }
  if (sccache) {
    core.startGroup('Install sccache')
    await exec.exec('python3', ['-m', 'pip', 'install', 'sccache>=0.10.0'])
    await exec.exec('sccache', ['--version'])
    setupSccacheEnv()
    core.endGroup()
  }

  // Setup additional env vars for macOS arm64/universal2 build
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
    if (!env.DEVELOPER_DIR) {
      env.DEVELOPER_DIR = '/Applications/Xcode.app/Contents/Developer'
    }
    if (!env.SDKROOT) {
      env.SDKROOT =
        '/Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX.sdk'
    }
    core.endGroup()
  }

  const beforeScript = getBeforeScript()
  if (beforeScript.length > 0) {
    core.startGroup('Run before script')
    await exec.exec('bash', ['-c', beforeScript], {
      env,
      cwd: workdir
    })
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
        const cwd = process.cwd()
        process.chdir(workdir)

        const globber = await glob.create(arg)
        for await (const file of globber.globGenerator()) {
          uploadArgs.push(file)
        }

        process.chdir(cwd)
      }
    }
    fullCommand = `${maturinPath} ${command} ${uploadArgs.join(' ')}`
  }
  const exitCode = await exec.exec(fullCommand, undefined, {env, cwd: workdir})
  if (sccache) {
    core.startGroup('sccache stats')
    await exec.exec('sccache', ['--show-stats'])
    core.endGroup()
  }
  return exitCode
}

async function innerMain(): Promise<void> {
  const inputArgs = core.getInput('args')
  const args = stringArgv(inputArgs)
  const command = core.getInput('command')
  const target = getRustTarget(args)
  const hostHomeMount = core.getInput('host-home-mount')
  let container = core.getInput('container')

  if (process.env.CARGO_INCREMENTAL === undefined) {
    core.exportVariable('CARGO_INCREMENTAL', '0')
  }
  if (process.env.CARGO_TERM_COLOR === undefined) {
    core.exportVariable('CARGO_TERM_COLOR', 'always')
  }

  // Check Zig support and remove --zig when unsupported
  const zigIndex = args.indexOf('--zig')
  if (zigIndex > -1) {
    if (hasZigSupport(target)) {
      // Build on host by default when using --zig
      if (container !== 'on' && container !== 'true') {
        container = 'off'
      }
    } else {
      args.splice(zigIndex, 1)
      core.info('Zig is not supported on this target, ignoring --zig.')
    }
  }

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

    if (IS_LINUX) {
      if (manylinux.length > 0 && manylinux !== 'auto') {
        args.unshift('--manylinux', manylinux)
      }
      // User can disable Docker build by set manylinux/container to off
      if (container !== 'off') {
        if (container.length > 0) {
          useDocker = true
        } else {
          useDocker = manylinux.length > 0 && manylinux !== 'off'
        }
      }
    }

    if (target.length > 0 && !args.includes('--target')) {
      args.unshift('--target', target)
    }
  }

  const maturinRelease = await findVersion(args)
  args.unshift(command)

  let exitCode: number
  if (useDocker) {
    const dockerContainer = await getDockerContainer(
      target,
      manylinux,
      container
    )
    if (dockerContainer) {
      exitCode = await dockerBuild(
        dockerContainer,
        maturinRelease,
        hostHomeMount,
        args
      )
    } else {
      core.info('No Docker container found, fallback to build on host')
      exitCode = await hostBuild(maturinRelease, args)
    }
  } else {
    exitCode = await hostBuild(maturinRelease, args)
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
      console.error(err)
      core.setFailed(err.message)
    }
  }
}

main()

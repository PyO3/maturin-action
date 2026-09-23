# maturin-action

[![GitHub Actions](https://github.com/PyO3/maturin-action/actions/workflows/test.yml/badge.svg)](https://github.com/PyO3/maturin-action/actions?query=workflow%3ATest)

GitHub Action to install and run a custom [maturin](https://github.com/PyO3/maturin) command with built-in support for cross compilation.

## Usage

```yaml
- uses: PyO3/maturin-action@v1
  with:
    command: build
    args: --release
```

**To generate a GitHub Actions workflow for your project, try the `maturin generate-ci github` command.**

```bash
mkdir -p .github/workflows
maturin generate-ci github > .github/workflows/CI.yml
```

### Examples

If you want to build and publish a Python extension module for common Python versions, operating systems, and CPU architectures,
take a look at the following examples:

* [messense/crfs-rs](https://github.com/messense/crfs-rs/blob/main/.github/workflows/Python.yml): PyO3 abi3 wheel example
* [messense/rjmespath-rs](https://github.com/messense/rjmespath-py/blob/main/.github/workflows/CI.yml): PyO3 abi3 wheel with Rust nightly toolchain example
* [astral-sh/uv](https://github.com/astral-sh/uv/blob/main/.github/workflows/build-release-binaries.yml): Hardened binary publishing example
* [milesgranger/pyrus-cramjam](https://github.com/milesgranger/pyrus-cramjam/blob/master/.github/workflows/CI.yml): PyO3 non-abi3 wheel example
* [messense/auditwheel-symbols](https://github.com/messense/auditwheel-symbols/blob/master/.github/workflows/CI.yml): `bin` binding example using MUSL libc
* [adriangb/graphlib2](https://github.com/adriangb/graphlib2/blob/main/.github/workflows/python.yaml): PyO3 abi3 wheel
* [pydantic/pydantic-core](https://github.com/pydantic/pydantic/blob/main/.github/workflows/ci.yml): PyO3 non-abi3 wheel with PyPy support example
* [messense/py-dissimilar](https://github.com/messense/py-dissimilar/blob/main/.github/workflows/CI.yml): PyO3 non-abi3 wheel with PyPy support example

## Inputs

| Name                | Required | Description                                                                                                        | Type    | Default                                                                                                                            |
| ------------------- | :------: | ------------------------------------------------------------------------------------------------------------------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| command             |    No    | `maturin` command to run                                                                                           | string  | `build`                                                                                                                            |
| args                |    No    | Arguments to pass to `maturin` subcommand                                                                          | string  |                                                                                                                                    |
| maturin-version     |    No    | The version of `maturin` to use. Must match a [tagged release]                                                     | string  | `latest`                                                                                                                           |
| manylinux           |    No    | Control the manylinux platform tag on linux, ignored on other platforms, use `auto` to build for lowest compatible | string  | Defaults to `auto` for the `publish` command                                                                                       |
| target              |    No    | The `--target` option for Cargo                                                                                    | string  |                                                                                                                                    |
| container           |    No    | manylinux docker container image name                                                                              | string  | Default depends on `target` and `manylinux` options, Set to `off` to disable manylinux docker build and build on the host instead. |
| docker-options      |    No    | Additional Docker run options, for passing environment variables and etc.                                          | string  |
| rust-toolchain      |    No    | Rust toolchain name.                                                                                               | string  | Defaults to `stable` for Docker build. To use the latest available version for the host build, the user must specify this in the CI config or repo config. |
| rustup-components   |    No    | Rustup components                                                                                                  | string  | Defaults to empty                                                                                                                  |
| working-directory   |    No    | The working directory to run the command in                                                                        | string  | Defaults to the root of the repository                                                                                             |
| sccache             |    No    | Enable sccache for faster builds                                                                                   | boolean | Defaults to `false`                                                                                                                |
| before-script-linux |    No    | Script to run before the maturin command on Linux                                                                  | string  |                                                                                                                                    |


## `manylinux` Docker container

If a `manylinux` version is specified and the target is a Linux target (whether set explicitly via the `target` input or implied from the host), this action will run the `maturin` command in a manylinux docker container.

For native host builds the `pypa` manylinux docker images are used. For cross compilation, images from `rust-cross` are typically used by default. This can be overridden by specifying the `container` input.

Here is a table detailing examples of the default selected containers:

| Target architecture | Runner architecture | manylinux version | Default container                                   | Requires QEMU |
| ------------------- | ------------------- | ----------------- | --------------------------------------------------- | ------------- |
| x86_64              | x86_64              | 2014/2_17         | quay.io/pypa/manylinux2014_x86_64:latest            | No            |
| x86_64              | x86_64              | 2_28              | quay.io/pypa/manylinux_2_28_x86_64:latest           | No            |
| x86_64              | x86_64              | 2_34              | quay.io/pypa/manylinux_2_34_x86_64:latest           | No            |
| x86_64              | aarch64             | 2014/2_17         | ghcr.io/rust-cross/manylinux2014-cross:x86_64       | No            |
| x86_64              | aarch64             | 2_28              | ghcr.io/rust-cross/manylinux_2_28-cross:x86_64      | No            |
| i686                | x86_64              | 2014/2_17         | quay.io/pypa/manylinux2014_i686:latest              | No            |
| i686                | x86_64              | 2_28              | quay.io/pypa/manylinux_2_28_i686:latest             | No            |
| i686                | x86_64              | 2_34              | quay.io/pypa/manylinux_2_34_i686:latest             | No            |
| i686                | aarch64             | 2014/2_17         | ghcr.io/rust-cross/manylinux2014-cross:i686         | No            |
| aarch64             | x86_64              | 2014/2_17         | ghcr.io/rust-cross/manylinux2014-cross:aarch64      | No            |
| aarch64             | x86_64              | 2_28              | ghcr.io/rust-cross/manylinux_2_28-cross:aarch64     | No            |
| aarch64             | aarch64             | 2014/2_17         | quay.io/pypa/manylinux2014_aarch64:latest           | No            |
| aarch64             | aarch64             | 2_28              | quay.io/pypa/manylinux_2_28_aarch64:latest          | No            |
| aarch64             | aarch64             | 2_34              | quay.io/pypa/manylinux_2_34_aarch64:latest          | No            |
| armv7l              | x86_64, aarch64     | 2014/2_17         | ghcr.io/rust-cross/manylinux2014-cross:armv7        | No            |
| armv7l              | x86_64, aarch64     | 2_28              | ghcr.io/rust-cross/manylinux_2_28-cross:armv7       | No            |
| ppc64le             | x86_64, aarch64     | 2014/2_17         | ghcr.io/rust-cross/manylinux2014-cross:ppc64le      | No            |
| ppc64le             | x86_64, aarch64     | 2_28              | ghcr.io/rust-cross/manylinux_2_28-cross:ppc64le     | No            |
| ppc64               | x86_64, aarch64     | 2014/2_17         | ghcr.io/rust-cross/manylinux2014-cross:ppc64        | No            |
| s390x               | x86_64, aarch64     | 2014/2_17         | ghcr.io/rust-cross/manylinux2014-cross:s390x        | No            |
| s390x               | x86_64, aarch64     | 2_28              | ghcr.io/rust-cross/manylinux_2_28-cross:s390x       | No            |
| riscv64             | x86_64, aarch64     | 2_31              | ghcr.io/rust-cross/manylinux_2_31-cross:riscv64     | No            |
| riscv64             | x86_64, aarch64     | 2_39              | quay.io/pypa/manylinux_2_39_riscv64:latest          | Yes           |
| riscv64             | riscv64             | 2_39              | quay.io/pypa/manylinux_2_39_riscv64:latest          | No            |
| loongarch64         | x86_64, aarch64     | 2_36              | ghcr.io/rust-cross/manylinux_2_36-cross:loongarch64 | No            |

You can override it by supplying the `container` input.

If you use wish to use an official manylinux image for a different architecture from the runner, you will need to
set up QEMU before using this action, for example

```yaml
- name: Setup QEMU
  uses: docker/setup-qemu-action@v3
- uses: PyO3/maturin-action@v1
  with:
    command: build
    args: --release
```

Note that the `actions/setup-python` action won't affect manylinux build since it's containerized,
so if you want to build for certain Python version for Linux, use `-i pythonX.Y` in the `args` option in
`PyO3/maturin-action` instead, for example

```yaml
- uses: PyO3/maturin-action@v1
  with:
    args: --release -i python3.10
```

To build for every available interpreter at once — including the free-threaded builds — use
`--find-interpreter`; see [Free-threaded CPython](#free-threaded-cpython) below.

## Free-threaded CPython

[maturin](https://github.com/PyO3/maturin) builds wheels for the free-threaded ("no-GIL") CPython
builds automatically when you pass `--find-interpreter` and a free-threaded interpreter is
available. Free-threaded interpreters carry a `t` suffix (`python3.14t`, `python3.15t`, …); maturin
discovers the officially supported ones (CPython 3.14 and newer) the same way it discovers the
regular builds — the experimental 3.13t is not discovered automatically. Discovery needs a
reasonably recent maturin, which the action installs by default.

### Linux (manylinux)

No configuration needed — the default manylinux containers ship the free-threaded interpreters, and
the action puts every interpreter under `/opt/python` on `PATH`, so `--find-interpreter` finds them:

```yaml
- uses: PyO3/maturin-action@v1
  with:
    command: build
    args: --release --find-interpreter
```

### macOS, Windows, and non-manylinux Linux (`manylinux: off`)

These run on the host, so the interpreters come from your own `actions/setup-python` step. Install
the free-threaded build alongside the regular one:

```yaml
- uses: actions/setup-python@v6
  with:
    python-version: |
      3.14
      3.14t
- uses: PyO3/maturin-action@v1
  with:
    command: build
    args: --release --find-interpreter
```

`setup-python` exposes the free-threaded build under its `t`-suffixed name (`python3.14t`, or
`python3.14t.exe` on Windows), which is what `--find-interpreter` looks for.

### Windows: build the regular and free-threaded interpreters in separate jobs

On Windows, co-installing the regular and free-threaded interpreters of the same minor version in
one `setup-python` step can fail
([python/cpython#127294](https://github.com/python/cpython/issues/127294),
[#313](https://github.com/PyO3/maturin-action/issues/313)). Use a matrix with one interpreter per
job instead.

### Stable ABI (abi3 / abi3t)

The free-threaded build has its own stable ABI, **abi3t**
([PEP 803](https://peps.python.org/pep-0803/), added in CPython 3.15), distinct from the
GIL-enabled **abi3**. PyO3 exposes both as Cargo features, and projects can enable both when they
want stable ABI wheels by default:

```toml
pyo3 = { version = "0.29", features = ["abi3-py310", "abi3t-py315"] }
```

One maturin invocation selects at most one stable ABI family, so do not expect one
`--find-interpreter` build to emit both forward-compatible wheels. To publish a complete wheel set
for current non-EOL CPython releases, run separate maturin builds with different interpreters. The
same default Cargo features can be used for each build:

```yaml
- name: Build abi3 wheel
  uses: PyO3/maturin-action@v1
  with:
    args: --release -i python3.10

- name: Build CPython 3.14t wheel
  uses: PyO3/maturin-action@v1
  with:
    args: --release -i python3.14t

- name: Build abi3t wheel
  uses: PyO3/maturin-action@v1
  with:
    args: --release -i python3.15t
```

The `abi3-py310` wheel supports GIL-enabled CPython 3.10 and newer. The `abi3t-py315` wheel
supports CPython 3.15 and newer, both GIL-enabled and free-threaded. Free-threaded CPython 3.14
predates `abi3t`, so the `python3.14t` build produces the version-specific `cp314-cp314t` wheel.

If stable ABI support is behind a project feature, pass that feature to both builds.
If a project enables only `abi3` (no `abi3t`), `--find-interpreter` builds no free-threaded stable
ABI wheel; request a version-specific free-threaded wheel explicitly with, e.g., `-i python3.14t`.

## Hardening Release pipelines

We recommend the following steps for hardening release pipelines:
* When targeting PyPI, set `--compatibility pypi` to activate its pre-upload check
* Set an explicit `manylinux:` version for each target to prevent silent regressions
* Pin both maturin-action and maturin version, and use a service such as renovate to update them

```yaml
strategy:
  matrix:
    platform:
      - target: aarch64-unknown-linux-gnu
        arch: aarch64
        manylinux: 2_28
      - target: armv7-unknown-linux-gnueabihf
        arch: armv7
        manylinux: 2_17

steps:
  # [...]
  - name: "Build wheels"
    uses: PyO3/maturin-action@86b9d133d34bc1b40018696f782949dac11bd380 # v1.49.4
    with:
      maturin-version: v1.11.5
      target: ${{ matrix.platform.target }}
      manylinux: ${{ matrix.platform.manylinux }}
      args: --release --locked --compatibility pypi
```

An example renovate configuration

```json5
// Maturin version used in maturin-action
{
  customType: "regex",
  managerFilePatterns: ["/.github/workflows/.*\\.yml$/"],
  matchStrings: ["maturin-version: (?<currentValue>v\\d+\\.\\d+\\.\\d+)"],
  depNameTemplate: "maturin",
  packageNameTemplate: "PyO3/maturin",
  datasourceTemplate: "github-releases",
},
```

## Contributing

To build after code changes:

```bash
npm run all
```

## License

This work is released under the MIT license. A copy of the license is provided in the [LICENSE](./LICENSE) file.

[tagged release]: https://github.com/PyO3/maturin/releases

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
* [milesgranger/pyrus-cramjam](https://github.com/milesgranger/pyrus-cramjam/blob/master/.github/workflows/CI.yml): PyO3 non-abi3 wheel example
* [messense/auditwheel-symbols](https://github.com/messense/auditwheel-symbols/blob/master/.github/workflows/CI.yml): `bin` binding example using MUSL libc
* [adriangb/graphlib2](https://github.com/adriangb/graphlib2/blob/main/.github/workflows/python.yaml): PyO3 abi3 wheel
* [pydantic/pydantic-core](https://github.com/pydantic/pydantic-core/blob/main/.github/workflows/ci.yml): PyO3 non-abi3 wheel with PyPy support example
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

By default, this action uses the following containers for supported architectures and manylinux versions.

| Architecture | Manylinux version | Default container                               | Note       |
| ------------ | ----------------- | ----------------------------------------------- | ---------- |
| x86_64       | 2010/2_12         | quay.io/pypa/manylinux2010_x86_64:latest        |            |
| x86_64       | 2014/2_17         | quay.io/pypa/manylinux2014_x86_64:latest        |            |
| x86_64       | 2_24              | quay.io/pypa/manylinux_2_24_x86_64:latest       | Deprecated |
| x86_64       | 2_28              | quay.io/pypa/manylinux_2_28_x86_64:latest       |            |
| i686         | 2010/2_12         | quay.io/pypa/manylinux2010_i686:latest          |            |
| i686         | 2014/2_17         | quay.io/pypa/manylinux2014_i686:latest          |            |
| i686         | 2_24              | quay.io/pypa/manylinux_2_24_i686:latest         | Deprecated |
| aarch64      | 2014/2_17         | ghcr.io/rust-cross/manylinux2014-cross:aarch64  |            |
| aarch64      | 2_24              | messense/manylinux_2_24-cross:aarch64           | Deprecated |
| aarch64      | 2_28              | ghcr.io/rust-cross/manylinux_2_28-cross:aarch64 |            |
| armv7l       | 2014/2_17         | ghcr.io/rust-cross/manylinux2014-cross:armv7    |            |
| armv7l       | 2_24              | messense/manylinux_2_24-cross:armv7             | Deprecated |
| armv7l       | 2_28              | ghcr.io/rust-cross/manylinux_2_28-cross:armv7   |            |
| ppc64le      | 2014/2_17         | ghcr.io/rust-cross/manylinux2014-cross:ppc64le  |            |
| ppc64le      | 2_24              | messense/manylinux_2_24-cross:ppc64le           | Deprecated |
| ppc64le      | 2_28              | ghcr.io/rust-cross/manylinux_2_28-cross:ppc64le |            |
| ppc64        | 2014/2_17         | ghcr.io/rust-cross/manylinux2014-cross:ppc64    |            |
| s390x        | 2014/2_17         | ghcr.io/rust-cross/manylinux2014-cross:s390x    |            |
| s390x        | 2_24              | messense/manylinux_2_24-cross:s390x             | Deprecated |
| s390x        | 2_28              | ghcr.io/rust-cross/manylinux_2_28-cross:s390x   |            |

You can override it by supplying the `container` input.
Note that if use official manylinux docker images for platforms other than `x86_64` and `i686`,
you will need to setup QEMU before using this action, for example

```yaml
- name: Setup QEMU
  uses: docker/setup-qemu-action@v1
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

## Contributing

To build after code changes:

```bash
npm run all
```

## License

This work is released under the MIT license. A copy of the license is provided in the [LICENSE](./LICENSE) file.

[tagged release]: https://github.com/PyO3/maturin/releases

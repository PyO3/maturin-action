# maturin-action

[![GitHub Actions](https://github.com/messense/maturin-action/actions/workflows/test.yml/badge.svg)](https://github.com/messense/maturin-action/actions?query=workflow%3ATest)

GitHub Action to install and run a custom [maturin](https://github.com/PyO3/maturin) command

## Usage

```yaml
- uses: actions-rs/toolchain@v1
  with:
    profile: minimal
    toolchain: stable
    override: true
# Use QEMU for platforms lacks cross compilers
- name: Set up QEMU
  id: qemu
  uses: docker/setup-qemu-action@v1
  with:
    image: tonistiigi/binfmt:latest
    platforms: all
- uses: messense/maturin-action@v1
  with:
    maturin-version: latest
    command: build
    args: --release
```

### Examples

* [messense/crfs-rs](https://github.com/messense/crfs-rs/blob/main/.github/workflows/Python.yml): PyO3 abi3 wheel example
* [milesgranger/pyrus-cramjam](https://github.com/milesgranger/pyrus-cramjam/blob/master/.github/workflows/CI.yml): PyO3 non-abi3 wheel example
* [messense/auditwheel-symbols](https://github.com/messense/auditwheel-symbols/blob/master/.github/workflows/CI.yml): `bin` binding example using MUSL libc

## Inputs

| Name            | Required | Description                                                                                                        | Type                                  | Default                                                                                                                            |
| --------------- | :------: | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| command         |    No    | `maturin` command to run                                                                                           | string                                | `build`                                                                                                                            |
| args            |    No    | Arguments to pass to `maturin` subcommand                                                                          | string                                |                                                                                                                                    |
| maturin-version |    No    | The version of `maturin` to use. Must match a [tagged release]                                                     | string                                | `latest`                                                                                                                           |
| manylinux       |    No    | Control the manylinux platform tag on linux, ignored on other platforms, use `auto` to build for lowest compatible | string                                |                                                                                                                                    |
| target          |    No    | The `--target` option for Cargo                                                                                    | string                                |                                                                                                                                    |
| container       |    No    | manylinux docker container image name                                                                              | string                                | Default depends on `target` and `manylinux` options, Set to `off` to disable manylinux docker build and build on the host instead. |
| rust-toolchain  |    No    | Rust toolchain name                                                                                                | Defaults to `stable` for Docker build |

## `manylinux` Docker container

By default, this action uses the following containers for supported architectures and manylinux versions.

| Architecture | Manylinux version | Default container                          | Requires QEMU |
| ------------ | ----------------- | ------------------------------------------ | ------------- |
| x86_64       | 2010/2_12         | quay.io/pypa/manylinux2010_x86_64:latest   | No            |
| x86_64       | 2014/2_17         | quay.io/pypa/manylinux2014_x86_64:latest   | No            |
| x86_64       | 2_24              | quay.io/pypa/manylinux_2_24_x86_64:latest  | No            |
| i686         | 2010/2_12         | quay.io/pypa/manylinux2010_i686:latest     | No            |
| i686         | 2014/2_17         | quay.io/pypa/manylinux2014_i686:latest     | No            |
| i686         | 2_24              | quay.io/pypa/manylinux_2_24_i686:latest    | No            |
| aarch64      | 2014/2_27         | messense/manylinux2014-cross:aarch64       | No            |
| aarch64      | 2_24              | quay.io/pypa/manylinux_2_24_aarch64:latest | Yes           |
| armv7l       | 2014/2_17         | messense/manylinux2014-cross:armv7         | No            |
| ppc64le      | 2014/2_17         | messense/manylinux2014-cross:ppc64le       | No            |
| ppc64le      | 2_24              | messense/manylinux_2_24-cross:ppc64le      | No            |
| ppc64        | 2104/2_b7         | messense/manylinux2014-cross:ppc64         | No            |
| s390x        | 2014/2_27         | messense/manylinux2014-cross:s390x         | No            |
| s390x        | 2_24              | quay.io/pypa/manylinux_2_24_s390x:latest   | Yes           |

You can override it by supplying the `container` input.

## License

This work is released under the MIT license. A copy of the license is provided in the [LICENSE](./LICENSE) file.

[tagged release]: https://github.com/PyO3/maturin/releases

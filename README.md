# maturin-action

[![GitHub Actions](https://github.com/messense/maturin-action/actions/workflows/test.yml/badge.svg)](https://github.com/messense/maturin-action/actions?query=workflow%3ATest)

GitHub Action to install and run a custom [maturin](https://github.com/PyO3/maturin) command

## Inputs

### `command`

**Optional** `maturin` command to run. Defaults to `build`.

### `args`

**Optional** Arguments to pass to the `maturin` command.

### `maturin-version`

**Optional** The version of `maturin` to use. Must match a tagged release. Defaults to `latest`.

See: https://github.com/PyO3/maturin/releases

## Usage

```yaml
- uses: actions-rs/toolchain@v1
  with:
    profile: minimal
    toolchain: stable
    override: true
- uses: messense/maturin-action@main
  with:
    maturin-version: latest
    command: build
    args: --release
```

## License

This work is released under the MIT license. A copy of the license is provided in the [LICENSE](./LICENSE) file.
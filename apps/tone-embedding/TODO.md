# TODO

## Fix Local Editable CLI Runs

`uv run tone-embedding ...` currently fails in local dev unless `--no-editable` is used because the editable install does not reliably make `src/tone_embedding` importable to the generated console script.

Current workaround:

```bash
uv run --no-editable tone-embedding --help
uv run --no-editable --extra openai tone-embedding analyze video --help
```

Desired local dev behavior:

```bash
uv run tone-embedding --help
uv run --extra openai tone-embedding analyze video --help
```

Investigate why the editable install `.pth` file is not being applied consistently by the venv Python, then fix packaging or uv configuration so normal editable local runs work without `PYTHONPATH` and without `--no-editable`.

Keep production/Lambda docs free to use non-editable installs if that remains the deploy target.

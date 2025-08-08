# Hello World Action

A simple composite action that demonstrates the shared GitHub Actions infrastructure with Claude-Flow SPARC integration.

## Usage

```yaml
- name: Say Hello
  uses: ./src/actions/composite/hello-world
  with:
    name: 'GitHub Actions'
    greeting: 'Welcome'
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `name` | Name to greet | true | `World` |
| `greeting` | Greeting to use | false | `Hello` |

## Outputs

| Output | Description |
|--------|-------------|
| `message` | The complete greeting message |
| `timestamp` | ISO timestamp when greeting was generated |

## Example

```yaml
name: Test Hello World

on: [push]

jobs:
  hello:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Greet the world
        id: hello
        uses: ./src/actions/composite/hello-world
        with:
          name: 'Open Source Community'
          greeting: 'Greetings'
      
      - name: Use outputs
        run: |
          echo "Message: ${{ steps.hello.outputs.message }}"
          echo "Created: ${{ steps.hello.outputs.timestamp }}"
```

## Features

- ✅ Input validation
- ✅ Structured outputs
- ✅ Error handling
- ✅ Claude-Flow integration ready
- ✅ SPARC methodology compatible

This action serves as a template and proof-of-concept for the shared GitHub Actions infrastructure.
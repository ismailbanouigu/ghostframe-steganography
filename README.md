# GhostFrame — AI Steganography Hide & Seek

[![Made with pollinations.ai](https://raw.githubusercontent.com/pollinations/pollinations/main/packages/ui/src/brand/badge-made-with.svg)](https://pollinations.ai/?ref=badge)

GhostFrame is a browser-based hide-and-seek lab for messages concealed in images. A Pollinations LLM draws an SVG that encodes a secret, the browser rasterizes it so the source code cannot leak the answer, and a fresh multimodal model gets only the pixels and tries to recover the message.

Built for [Pollinations Quest #18367](https://github.com/pollinations/pollinations/issues/18367).

## What makes it different

- **Blind handoff:** the seeker receives a PNG, never the SVG source or original secret.
- **Two model lanes:** use low-cost GPT-5.4 Nano with Quest Pollen, or reproduce the inspiration with Claude Fable 5.1 and Paid Pollen.
- **Five encoding families:** skyline heights, colour channels, Morse spacing, rotation, and visual acrostics.
- **Transparent grading:** normalized similarity, exact-match status, confidence, and the model's claimed decoding method.
- **Offline specimen:** a deterministic skyline challenge demonstrates the mechanic without signing in.
- **Bring Your Own Pollen:** visitors approve their own capped, temporary Pollinations budget.

## Run locally

Serve `dist/` with any static server, for example:

```bash
npx serve dist
```

The production redirect URL must be registered on the Pollinations App Key.

## Test

```bash
npm test
```

## Privacy

The secret and generated image are sent only when the visitor explicitly runs a model. The scoped Pollinations key stays in session memory through the official connect component. No secret keys are committed.

## License

MIT


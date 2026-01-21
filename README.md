# Verifire

Verifire is a Chrome Extension that verifies AI-generated responses in real time.  
Whenever an AI tool (like ChatGPT) gives an answer, Verifire analyzes it and produces a **reliability score between 0 and 1**, helping users judge how trustworthy the response is.

---

## What Problem Does Verifire Solve?

AI responses can:
- Use outdated information
- Rely on untrusted or unknown sources
- Contain mathematical or logical errors
- Sound confident while being incorrect

Verifire adds a second layer of validation so users do not blindly trust AI outputs.

---

## How Verifire Works

For every AI-generated response, Verifire performs the following checks:

### Source Validation
- Detects referenced sources (explicit or implicit)
- Verifies whether sources are:
  - Trusted (official, academic, reputed)
  - Outdated or recently updated
- Flags missing or unverifiable sources

### Freshness Check
- Identifies time-sensitive information
- Detects potentially outdated claims

### Mathematical and Logical Consistency
- Detects calculation mistakes
- Identifies logical fallacies
- Finds internal contradictions

### Final Confidence Score
- Outputs a score between 0.0 and 1.0
  - 1.0 → Highly reliable
  - 0.0 → Very unreliable
- Provides a reasoning breakdown behind the score

---

## Example Output




---

## Features

- Real-time AI response verification
- Runs directly inside the browser
- Lightweight Chrome Extension
- Clear scoring system (0 → 1)
- Transparent reasoning for every score

---

## Tech Stack (Current / Planned)

- Chrome Extension (Manifest V3)
- JavaScript / TypeScript
- LLM-based analysis layer
- Free verification resources only:
  - Open-source fact-check datasets
  - Public knowledge bases (Wikipedia, government portals)
  - Rule-based mathematical validation

No paid APIs are required for the core version.

---

## Installation (Development)


1. Open Chrome and go to `chrome://extensions`
2. Enable Developer mode
3. Click **Load unpacked**
4. Select the `verifire` directory

---

## Use Cases

- Students validating AI-generated answers
- Developers verifying technical explanations
- Researchers checking AI summaries
- Anyone who wants reliability, not just fluent text

---

## Roadmap

- Per-claim reliability scoring
- Visual highlighting of unreliable sections
- Support for multiple AI platforms
- Offline lightweight verification mode
- Open-source verification rule engine

---

## Contributing

Contributions are welcome.

You can help by:
- Improving verification logic
- Adding trusted-source datasets
- Enhancing UI/UX
- Reporting edge cases

---

## License

MIT License

---

## Why Verifire?

AI can be fast. Verifire makes it reliable.
